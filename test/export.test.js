import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { InspiraDBApp } from '../src/index.js';

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
} = {}) {
  const now = '2026-03-25T10:00:00.000Z';
  const libraryPath = path.join(app.paths.libraryRootPath, fileName);
  const thumbnailPath = path.join(app.paths.thumbnailRootPath, `${fileName}.thumb`);

  fs.mkdirSync(path.dirname(libraryPath), { recursive: true });
  if (createSource) {
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
      sourcePath: `/tmp/${fileName}`,
      libraryPath,
      thumbnailPath,
      md5Hash: `${fileName}-${Date.now()}-${Math.random()}`,
      fileSize: createSource ? Buffer.byteLength(content) : 0,
      createdAt: now,
      updatedAt: now,
    },
  );

  return Number(result.lastInsertRowid);
}

test('exportImage copies the file to the explicit destination path and writes metadata when possible', () => {
  const { app, rootDir } = createTestApp();

  try {
    const imageId = insertExportableImage(app, { fileName: 'poster.png' });
    const destinationPath = path.join(rootDir, 'exports', 'poster-copy.png');
    const result = app.exportImage(imageId, destinationPath);

    assert.equal(result.canceled, false);
    assert.equal(result.filePath, destinationPath);
    assert.deepEqual(result.warnings, []);
    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(fs.existsSync(result.sidecarPath), true);
    assert.equal(result.writeMode, 'sidecar');
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
    const imageId = insertExportableImage(app, { fileName: 'warn.png' });
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
    const warningImageId = insertExportableImage(app, { fileName: 'warn-batch.png' });
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
