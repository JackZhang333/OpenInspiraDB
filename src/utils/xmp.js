import fs from 'node:fs';
import path from 'node:path';

const XMP_APP1_PREFIX = Buffer.from('http://ns.adobe.com/xap/1.0/\u0000', 'ascii');

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueNonEmpty(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function isJpegBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0xff
    && buffer[1] === 0xd8;
}

function extractJpegEmbeddedXmpPacket(buffer) {
  if (!isJpegBuffer(buffer)) {
    return '';
  }

  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const isStandalone = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isStandalone) {
      offset += 2;
      continue;
    }

    if (offset + 3 >= buffer.length) {
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      break;
    }

    const segmentEnd = offset + 2 + length;
    if (segmentEnd > buffer.length) {
      break;
    }

    if (marker === 0xe1) {
      const prefixEnd = offset + 4 + XMP_APP1_PREFIX.length;
      if (prefixEnd <= segmentEnd && buffer.slice(offset + 4, prefixEnd).equals(XMP_APP1_PREFIX)) {
        return buffer.slice(prefixEnd, segmentEnd).toString('utf8');
      }
    }

    offset = segmentEnd;
  }

  return '';
}

function extractEmbeddedXmpPacket(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return '';
  }

  const jpegPacket = extractJpegEmbeddedXmpPacket(buffer);
  if (jpegPacket) {
    return jpegPacket;
  }

  const markers = [
    { start: '<x:xmpmeta', end: '</x:xmpmeta>' },
    { start: '<xmpmeta', end: '</xmpmeta>' },
  ];

  const text = buffer.toString('utf8');
  for (const marker of markers) {
    const startIndex = text.indexOf(marker.start);
    if (startIndex < 0) {
      continue;
    }

    const endIndex = text.indexOf(marker.end, startIndex);
    if (endIndex < 0) {
      continue;
    }

    return text.slice(startIndex, endIndex + marker.end.length);
  }

  return '';
}

function extractDcDescription(xml) {
  const descriptionMatch = xml.match(
    /<dc:description[\s\S]*?<rdf:Alt[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>[\s\S]*?<\/rdf:Alt>[\s\S]*?<\/dc:description>/i,
  );

  if (!descriptionMatch) {
    return '';
  }

  return decodeXmlEntities(descriptionMatch[1]).trim();
}

function extractDcTags(xml) {
  const subjectMatch = xml.match(
    /<dc:subject[\s\S]*?<rdf:Bag[\s\S]*?<\/rdf:Bag>[\s\S]*?<\/dc:subject>/i,
  );

  if (!subjectMatch) {
    return [];
  }

  const bagText = subjectMatch[0];
  const tags = [];
  const tagRegex = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi;
  let tagMatch = tagRegex.exec(bagText);
  while (tagMatch) {
    const tag = decodeXmlEntities(tagMatch[1]).trim();
    if (tag) {
      tags.push(tag);
    }
    tagMatch = tagRegex.exec(bagText);
  }

  return uniqueNonEmpty(tags);
}

function parseXmpPacket(packet) {
  const caption = extractDcDescription(packet);
  const tags = extractDcTags(packet);

  return {
    caption,
    tags,
    hasCaption: Boolean(caption),
    hasTags: tags.length > 0,
  };
}

function buildJpegXmpSegment(packet) {
  const payload = Buffer.concat([XMP_APP1_PREFIX, Buffer.from(packet, 'utf8')]);
  const length = payload.length + 2;
  if (length > 0xffff) {
    const error = new Error('XMP_PACKET_TOO_LARGE');
    error.code = 'XMP_PACKET_TOO_LARGE';
    throw error;
  }

  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = 0xe1;
  header.writeUInt16BE(length, 2);
  return Buffer.concat([header, payload]);
}

function embedXmpIntoJpegFile(imagePath, packet) {
  const buffer = fs.readFileSync(imagePath);
  if (!isJpegBuffer(buffer)) {
    const error = new Error('NOT_JPEG_IMAGE');
    error.code = 'NOT_JPEG_IMAGE';
    throw error;
  }

  const xmpSegment = buildJpegXmpSegment(packet);
  const chunks = [buffer.slice(0, 2)];

  let offset = 2;
  let inserted = false;

  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      if (!inserted) {
        chunks.push(xmpSegment);
        inserted = true;
      }
      chunks.push(buffer.slice(offset));
      offset = buffer.length;
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xda) {
      if (!inserted) {
        chunks.push(xmpSegment);
        inserted = true;
      }
      chunks.push(buffer.slice(offset));
      offset = buffer.length;
      break;
    }

    if (marker === 0xd9) {
      if (!inserted) {
        chunks.push(xmpSegment);
        inserted = true;
      }
      chunks.push(buffer.slice(offset, offset + 2));
      offset += 2;
      continue;
    }

    const isStandalone = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isStandalone) {
      chunks.push(buffer.slice(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 3 >= buffer.length) {
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      break;
    }

    const segmentEnd = offset + 2 + length;
    if (segmentEnd > buffer.length) {
      break;
    }

    const isXmpSegment = marker === 0xe1
      && offset + 4 + XMP_APP1_PREFIX.length <= segmentEnd
      && buffer.slice(offset + 4, offset + 4 + XMP_APP1_PREFIX.length).equals(XMP_APP1_PREFIX);

    if (!isXmpSegment) {
      chunks.push(buffer.slice(offset, segmentEnd));
    }

    offset = segmentEnd;
  }

  if (offset < buffer.length) {
    chunks.push(buffer.slice(offset));
  }

  if (!inserted) {
    chunks.push(xmpSegment);
  }

  fs.writeFileSync(imagePath, Buffer.concat(chunks));
}

export function buildXmpSidecarPathForImage(imagePath) {
  const parsed = path.parse(path.resolve(String(imagePath || '')));
  return path.join(parsed.dir, `${parsed.name}.xmp`);
}

function removeXmpSidecarIfExists(sidecarPath) {
  if (fs.existsSync(sidecarPath)) {
    fs.rmSync(sidecarPath, { force: true });
  }
}

export function readXmpMetadataForImage(imagePath) {
  const resolvedImagePath = path.resolve(String(imagePath || ''));
  const sidecarPath = buildXmpSidecarPathForImage(resolvedImagePath);

  if (fs.existsSync(sidecarPath)) {
    const packet = fs.readFileSync(sidecarPath, 'utf8');
    return {
      ...parseXmpPacket(packet),
      source: 'sidecar',
      sidecarPath,
    };
  }

  if (!fs.existsSync(resolvedImagePath)) {
    return {
      caption: '',
      tags: [],
      hasCaption: false,
      hasTags: false,
      source: 'none',
      sidecarPath: '',
    };
  }

  const packet = extractEmbeddedXmpPacket(fs.readFileSync(resolvedImagePath));
  if (packet) {
    return {
      ...parseXmpPacket(packet),
      source: 'embedded',
      sidecarPath: '',
    };
  }

  return {
    caption: '',
    tags: [],
    hasCaption: false,
    hasTags: false,
    source: 'none',
    sidecarPath: '',
  };
}

export function writeXmpForImage(imagePath, metadata = {}) {
  const resolvedPath = path.resolve(String(imagePath || ''));
  const caption = String(metadata.caption || '').trim();
  const tags = uniqueNonEmpty(metadata.tags || []);
  const sidecarPath = buildXmpSidecarPathForImage(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext !== '.jpg' && ext !== '.jpeg') {
    removeXmpSidecarIfExists(sidecarPath);
    return {
      embedded: false,
      mode: 'skipped',
      sidecarPath: '',
    };
  }

  const captionXml = escapeXml(caption);
  const tagsXml = tags
    .map((tag) => `        <rdf:li>${escapeXml(tag)}</rdf:li>`)
    .join('\n');

  const packet = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${captionXml}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <dc:subject>
        <rdf:Bag>
${tagsXml}
        </rdf:Bag>
      </dc:subject>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  embedXmpIntoJpegFile(resolvedPath, packet);
  removeXmpSidecarIfExists(sidecarPath);

  return {
    embedded: true,
    mode: 'embedded',
    sidecarPath: '',
  };
}
