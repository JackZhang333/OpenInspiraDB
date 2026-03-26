import fs from 'node:fs';
import path from 'node:path';

export function toMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.thumb') return 'image/jpeg';
  return 'application/octet-stream';
}

export function fileToDataUrl(filePath, options = {}) {
  const fsModule = options.fsModule || fs;

  if (!filePath || !fsModule.existsSync(filePath)) {
    return null;
  }

  const mimeType = toMimeType(filePath);
  const base64 = fsModule.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export function fileToPreviewDataUrl(filePath, options = {}) {
  return fileToDataUrl(filePath, options);
}
