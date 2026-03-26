import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreviewPath,
  buildHeicJpegConversionArgs,
  HEIC_PREVIEW_MAX_DIMENSION,
  HEIC_PREVIEW_QUALITY,
} from '../src/utils/files.js';

test('buildPreviewPath uses a stable jpg cache path under the hashed prefix', () => {
  const previewPath = buildPreviewPath('/tmp/previews', 'abcdef1234567890');

  assert.equal(previewPath, '/tmp/previews/ab/abcdef1234567890.jpg');
});

test('buildHeicJpegConversionArgs encodes preview conversions with the expected size and quality', () => {
  const args = buildHeicJpegConversionArgs('/tmp/source.heic', '/tmp/previews/out.jpg', {
    quality: HEIC_PREVIEW_QUALITY,
    maxDimension: HEIC_PREVIEW_MAX_DIMENSION,
  });

  assert.deepEqual(args, [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(HEIC_PREVIEW_QUALITY),
    '-Z', String(HEIC_PREVIEW_MAX_DIMENSION),
    '/tmp/source.heic',
    '--out',
    '/tmp/previews/out.jpg',
  ]);
});
