import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fileToDataUrl, fileToPreviewDataUrl } from './image-data-url.js';

test('fileToDataUrl returns the raw mime-based data URL for standard formats', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-data-url-test-'));
  const imagePath = path.join(tempDir, 'preview.jpg');
  fs.writeFileSync(imagePath, Buffer.from('preview-bytes'));

  const dataUrl = fileToDataUrl(imagePath);

  assert.match(dataUrl, /^data:image\/jpeg;base64,/);
});

test('fileToPreviewDataUrl returns a data URL for browser-friendly preview assets', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-preview-test-'));
  const imagePath = path.join(tempDir, 'preview.jpg');
  fs.writeFileSync(imagePath, Buffer.from('preview-bytes'));

  const dataUrl = fileToPreviewDataUrl(imagePath);

  assert.match(dataUrl, /^data:image\/jpeg;base64,/);
});

test('fileToPreviewDataUrl returns null for missing preview assets', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-preview-fallback-test-'));
  const imagePath = path.join(tempDir, 'missing-preview.jpg');

  const dataUrl = fileToPreviewDataUrl(imagePath);

  assert.equal(dataUrl, null);
});
