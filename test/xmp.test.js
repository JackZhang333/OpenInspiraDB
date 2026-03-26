import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildXmpSidecarPathForImage,
  readXmpMetadataForImage,
  writeXmpForImage,
} from '../src/utils/xmp.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-xmp-test-'));
}

function createMinimalJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

test('writeXmpForImage skips non-jpeg files and removes any stale sidecar', () => {
  const rootDir = createTempDir();

  try {
    const imagePath = path.join(rootDir, 'poster.png');
    const sidecarPath = buildXmpSidecarPathForImage(imagePath);
    fs.writeFileSync(imagePath, 'png-content');
    fs.writeFileSync(sidecarPath, '<x:xmpmeta>stale</x:xmpmeta>');

    const result = writeXmpForImage(imagePath, {
      caption: 'caption',
      tags: ['tag-a'],
    });

    assert.deepEqual(result, {
      embedded: false,
      mode: 'skipped',
      sidecarPath: '',
    });
    assert.equal(fs.existsSync(sidecarPath), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('writeXmpForImage embeds metadata into jpeg files', () => {
  const rootDir = createTempDir();

  try {
    const imagePath = path.join(rootDir, 'poster.jpg');
    fs.writeFileSync(imagePath, createMinimalJpegBuffer());

    const result = writeXmpForImage(imagePath, {
      caption: 'caption',
      tags: ['tag-a', 'tag-b'],
    });
    const metadata = readXmpMetadataForImage(imagePath);

    assert.deepEqual(result, {
      embedded: true,
      mode: 'embedded',
      sidecarPath: '',
    });
    assert.equal(metadata.source, 'embedded');
    assert.equal(metadata.caption, 'caption');
    assert.deepEqual(metadata.tags.sort(), ['tag-a', 'tag-b']);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('writeXmpForImage surfaces jpeg embed failures instead of falling back to sidecar', () => {
  const rootDir = createTempDir();

  try {
    const imagePath = path.join(rootDir, 'broken.jpg');
    const sidecarPath = buildXmpSidecarPathForImage(imagePath);
    fs.writeFileSync(imagePath, 'not-a-real-jpeg');

    assert.throws(
      () => writeXmpForImage(imagePath, { caption: 'caption' }),
      (error) => error?.code === 'NOT_JPEG_IMAGE',
    );
    assert.equal(fs.existsSync(sidecarPath), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
