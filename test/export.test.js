import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { InspiraDBApp } from '../src/index.js';
import {
  buildXmpSidecarPathForImage,
  readXmpMetadataForImage,
} from '../src/utils/xmp.js';

function createTestApp() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-export-test-'));
  const app = new InspiraDBApp({
    rootDir,
    dbPath: path.join(rootDir, 'app.db'),
    libraryRootPath: path.join(rootDir, 'library'),
    thumbnailRootPath: path.join(rootDir, 'thumbs'),
    autoStartQueue: false,
  });

  return { app, rootDir };
}

function disposeTestApp(app, rootDir) {
  app.close();
  fs.rmSync(rootDir, { recursive: true, force: true });
}

function insertExportableImage(app, {
  fileName = 'image.png',
  content = 'fake-image-content',
  createSource = true,
  createLibrary = createSource,
  sourcePath = '',
} = {}) {
  const now = '2026-03-25T10:00:00.000Z';
  const resolvedSourcePath = sourcePath || path.join(os.tmpdir(), fileName);
  const libraryPath = path.join(app.paths.libraryRootPath, fileName);
  const thumbnailPath = path.join(app.paths.thumbnailRootPath, `${fileName}.thumb`);

  if (createSource) {
    fs.mkdirSync(path.dirname(resolvedSourcePath), { recursive: true });
    fs.writeFileSync(resolvedSourcePath, content);
  }
  if (createLibrary) {
    fs.mkdirSync(path.dirname(libraryPath), { recursive: true });
    fs.writeFileSync(libraryPath, content);
  }

  const result = app.db.run(
    `INSERT INTO images (
      original_file_name,
      source_path,
      library_path,
      thumbnail_path,
      md5_hash,
      file_size,
      width,
      height,
      import_status,
      analysis_status,
      active_tag_source,
      created_at,
      updated_at
    ) VALUES (
      :fileName,
      :sourcePath,
      :libraryPath,
      :thumbnailPath,
      :md5Hash,
      :fileSize,
      NULL,
      NULL,
      'imported',
      'ready',
      'ai',
      :createdAt,
      :updatedAt
    )`,
    {
      fileName,
      sourcePath: resolvedSourcePath,
      libraryPath,
      thumbnailPath,
      md5Hash: `${fileName}-${Date.now()}-${Math.random()}`,
      fileSize: (createSource || createLibrary) ? Buffer.byteLength(content) : 0,
      createdAt: now,
      updatedAt: now,
    },
  );

  return Number(result.lastInsertRowid);
}

function createMinimalJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

function stubEmbeddingRefresh(app) {
  app.refreshEmbeddingWithFallback = async () => ({
    embeddingStatus: 'refreshed',
    analysisStatus: 'ready',
  });
}

test('exportImage writes metadata into exported jpeg files when possible', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, {
      fileName: 'poster.jpg',
      content: createMinimalJpegBuffer(),
    });
    const destinationPath = path.join(rootDir, 'exports', 'poster-copy.jpg');
    const result = app.exportImage(imageId, destinationPath);
    const metadata = readXmpMetadataForImage(destinationPath);

    assert.equal(result.canceled, false);
    assert.equal(result.filePath, destinationPath);
    assert.deepEqual(result.warnings, []);
    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(result.sidecarPath, '');
    assert.equal(result.writeMode, 'embedded');
    assert.equal(result.embedded, true);
    assert.equal(metadata.source, 'embedded');
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage skips metadata write-back for non-jpeg exports without warnings', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, { fileName: 'poster.png' });
    const destinationPath = path.join(rootDir, 'exports', 'poster-copy.png');
    const result = app.exportImage(imageId, destinationPath);

    assert.equal(result.canceled, false);
    assert.equal(result.filePath, destinationPath);
    assert.deepEqual(result.warnings, []);
    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(result.sidecarPath, '');
    assert.equal(result.writeMode, 'skipped');
    assert.equal(result.embedded, false);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage removes an existing sidecar next to a non-jpeg export target', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, { fileName: 'poster.png' });
    const destinationPath = path.join(rootDir, 'exports', 'poster-copy.png');
    const sidecarPath = buildXmpSidecarPathForImage(destinationPath);
    fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
    fs.writeFileSync(sidecarPath, '<x:xmpmeta>stale</x:xmpmeta>');

    const result = app.exportImage(imageId, destinationPath);

    assert.equal(result.writeMode, 'skipped');
    assert.equal(fs.existsSync(sidecarPath), false);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage does not append the original extension when the destination path omits one', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, { fileName: 'poster.png' });
    const destinationPath = path.join(rootDir, 'exports', 'poster-copy');
    const result = app.exportImage(imageId, destinationPath);

    assert.equal(result.filePath, destinationPath);
    assert.equal(fs.existsSync(destinationPath), true);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage reports missing library files with a stable code', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, {
      fileName: 'missing.png',
      createSource: false,
    });

    assert.throws(
      () => app.exportImage(imageId, path.join(rootDir, 'exports', 'missing-copy')),
      (error) => error?.code === 'IMAGE_FILE_MISSING',
    );
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage heals the library copy from source_path before exporting', () => {
  const { app, rootDir } = createTestApp();

  try {
    const sourcePath = path.join(rootDir, 'source-images', 'recoverable.png');
    const imageId = insertExportableImage(app, {
      fileName: 'recoverable.png',
      content: 'recoverable-content',
      createSource: true,
      createLibrary: false,
      sourcePath,
    });

    const result = app.exportImage(imageId, path.join(rootDir, 'exports', 'recoverable-copy.png'));
    const storedImage = app.db.get(
      'SELECT library_path, thumbnail_path FROM images WHERE id = :imageId',
      { imageId },
    );

    assert.equal(result.canceled, false);
    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(fs.existsSync(storedImage.library_path), true);
    assert.equal(fs.existsSync(storedImage.thumbnail_path), true);
    assert.equal(fs.readFileSync(storedImage.library_path, 'utf8'), 'recoverable-content');
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage maps copy permission failures to EXPORT_PERMISSION_DENIED', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, { fileName: 'locked.png' });
    app.copyImageFileToDestination = () => {
      const error = new Error('denied');
      error.code = 'EACCES';
      throw error;
    };

    assert.throws(
      () => app.exportImage(imageId, path.join(rootDir, 'exports', 'locked-copy')),
      (error) => error?.code === 'EXPORT_PERMISSION_DENIED',
    );
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImage keeps the exported file when metadata write-back fails', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, {
      fileName: 'warn.jpg',
      content: createMinimalJpegBuffer(),
    });
    app.writeExportMetadata = () => {
      throw new Error('xmp-failed');
    };

    const result = app.exportImage(imageId, path.join(rootDir, 'exports', 'warn-copy'));

    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].code, 'EXPORT_METADATA_WRITE_FAILED');
    assert.equal(result.sidecarPath, '');
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImages avoids overwriting files when exported names collide', () => {
  const { app, rootDir } = createTestApp();

  try {
    const firstImageId = insertExportableImage(app, { fileName: 'poster.png', content: 'first' });
    const secondImageId = insertExportableImage(app, { fileName: 'poster.png', content: 'second' });
    const destinationDir = path.join(rootDir, 'exports');
    fs.mkdirSync(destinationDir, { recursive: true });

    const result = app.exportImages([firstImageId, secondImageId], destinationDir);
    const fileNames = result.exported.map((item) => path.basename(item.filePath)).sort();

    assert.equal(result.exportedCount, 2);
    assert.deepEqual(fileNames, ['poster-2.png', 'poster.png']);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('exportImages returns mixed failures and metadata warnings without reducing exportedCount', () => {
  const { app, rootDir } = createTestApp();

  try {
    const successImageId = insertExportableImage(app, { fileName: 'good.png' });
    const warningImageId = insertExportableImage(app, {
      fileName: 'warn-batch.jpg',
      content: createMinimalJpegBuffer(),
    });
    const missingImageId = insertExportableImage(app, {
      fileName: 'missing-batch.png',
      createSource: false,
    });
    const originalWriteMetadata = app.writeExportMetadata.bind(app);
    app.writeExportMetadata = (imageId, outputPath) => {
      if (imageId === warningImageId) {
        throw new Error('xmp-failed');
      }
      return originalWriteMetadata(imageId, outputPath);
    };

    const destinationDir = path.join(rootDir, 'exports');
    fs.mkdirSync(destinationDir, { recursive: true });

    const result = app.exportImages([successImageId, warningImageId, missingImageId], destinationDir);
    const warnedExport = result.exported.find((item) => item.imageId === warningImageId);

    assert.equal(result.exportedCount, 2);
    assert.equal(result.failedCount, 1);
    assert.equal(result.warningCount, 1);
    assert.equal(result.failed[0].imageId, missingImageId);
    assert.equal(result.failed[0].code, 'IMAGE_FILE_MISSING');
    assert.equal(warnedExport.warnings.length, 1);
    assert.equal(fs.existsSync(warnedExport.filePath), true);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('updateImageCaption removes any existing non-jpeg library sidecar and reports skipped write-back', async () => {
  const { app, rootDir } = createTestApp();

  try {
    stubEmbeddingRefresh(app);
    const imageId = insertExportableImage(app, { fileName: 'library.png' });
    const image = app.db.get('SELECT library_path FROM images WHERE id = :imageId', { imageId });
    const sidecarPath = buildXmpSidecarPathForImage(image.library_path);
    fs.writeFileSync(sidecarPath, '<x:xmpmeta>stale</x:xmpmeta>');

    const result = await app.updateImageCaption(imageId, 'updated caption');

    assert.equal(result.imageId, imageId);
    assert.equal(result.xmpSidecarPath, '');
    assert.equal(fs.existsSync(sidecarPath), false);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('updateImageTags removes any existing non-jpeg library sidecar and reports skipped write-back', async () => {
  const { app, rootDir } = createTestApp();

  try {
    stubEmbeddingRefresh(app);
    const imageId = insertExportableImage(app, { fileName: 'library.webp' });
    const image = app.db.get('SELECT library_path FROM images WHERE id = :imageId', { imageId });
    const sidecarPath = buildXmpSidecarPathForImage(image.library_path);
    fs.writeFileSync(sidecarPath, '<x:xmpmeta>stale</x:xmpmeta>');

    const result = await app.updateImageTags(imageId, []);

    assert.equal(result.imageId, imageId);
    assert.equal(result.xmpSidecarPath, '');
    assert.equal(fs.existsSync(sidecarPath), false);
  } finally {
    disposeTestApp(app, rootDir);
  }
});
