import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  createSingleImageExportHandler,
  resolveSingleImageExportPath,
} from './export-image.js';

function createLoggerHarness() {
  const entries = [];
  return {
    logger: {
      info(message, context = {}) {
        entries.push({ level: 'info', message, context });
      },
      error(message, context = {}) {
        entries.push({ level: 'error', message, context });
      },
    },
    entries,
  };
}

test('resolveSingleImageExportPath preserves explicit extensions and appends the original extension when missing', () => {
  assert.equal(
    resolveSingleImageExportPath('/tmp/exported-image.png', 'poster.jpg'),
    path.resolve('/tmp/exported-image.png'),
  );
  assert.equal(
    resolveSingleImageExportPath('/tmp/exported-image', 'poster.jpg'),
    path.resolve('/tmp/exported-image.jpg'),
  );
});

test('single image export handler uses the save path as-is when the user keeps an extension', async () => {
  const dialogCalls = [];
  const scopedCalls = [];
  const exportCalls = [];
  const { logger, entries } = createLoggerHarness();
  const handler = createSingleImageExportHandler({
    app: {
      getPath(name) {
        assert.equal(name, 'downloads');
        return '/Users/test/Downloads';
      },
    },
    dialog: {
      async showSaveDialog(_window, options) {
        dialogCalls.push(options);
        return {
          canceled: false,
          filePath: '/tmp/review-export.png',
          bookmark: 'bookmark-data',
        };
      },
    },
    imageExtensions: ['jpg', 'jpeg', 'png'],
    getMainWindow: () => ({ id: 1 }),
    getInspiraApp: () => ({
      getImageDetail() {
        return { image: { original_file_name: 'poster.png' } };
      },
      exportImage(imageId, destinationPath) {
        exportCalls.push({ imageId, destinationPath });
        return { canceled: false, imageId, filePath: destinationPath, warnings: [] };
      },
    }),
    withScopedAccess: async (dialogResult, run) => {
      scopedCalls.push(dialogResult);
      return run();
    },
    wrapMainProcessError(error) {
      return error;
    },
    logger,
  });

  const result = await handler({}, 42);

  assert.equal(dialogCalls[0].defaultPath, path.join('/Users/test/Downloads', 'poster.png'));
  assert.equal(scopedCalls[0].filePath, '/tmp/review-export.png');
  assert.deepEqual(exportCalls[0], { imageId: 42, destinationPath: '/tmp/review-export.png' });
  assert.equal(result.filePath, '/tmp/review-export.png');
  assert.equal(entries.some((entry) => entry.message === 'export-image-ipc-succeeded'), true);
});

test('single image export handler appends the original extension before scoped access when the save path omits one', async () => {
  const scopedCalls = [];
  const exportCalls = [];
  const { logger, entries } = createLoggerHarness();
  const handler = createSingleImageExportHandler({
    app: {
      getPath() {
        return '/Users/test/Downloads';
      },
    },
    dialog: {
      async showSaveDialog() {
        return {
          canceled: false,
          filePath: '/tmp/review-export',
          bookmark: 'bookmark-data',
        };
      },
    },
    imageExtensions: ['jpg', 'jpeg', 'png'],
    getMainWindow: () => ({ id: 1 }),
    getInspiraApp: () => ({
      getImageDetail() {
        return { image: { original_file_name: 'poster.png' } };
      },
      exportImage(imageId, destinationPath) {
        exportCalls.push({ imageId, destinationPath });
        return { canceled: false, imageId, filePath: destinationPath, warnings: [] };
      },
    }),
    withScopedAccess: async (dialogResult, run) => {
      scopedCalls.push(dialogResult);
      return run();
    },
    wrapMainProcessError(error) {
      return error;
    },
    logger,
  });

  const result = await handler({}, 42);

  assert.equal(scopedCalls[0].filePath, path.resolve('/tmp/review-export.png'));
  assert.deepEqual(exportCalls[0], { imageId: 42, destinationPath: path.resolve('/tmp/review-export.png') });
  assert.equal(result.filePath, path.resolve('/tmp/review-export.png'));
  assert.equal(
    entries.some((entry) => entry.message === 'export-image-ipc-selected' && entry.context.targetFilePath.endsWith('.png')),
    true,
  );
});

test('single image export handler returns canceled when the save dialog is dismissed', async () => {
  let exportCalled = false;
  const handler = createSingleImageExportHandler({
    app: {
      getPath() {
        return '/Users/test/Downloads';
      },
    },
    dialog: {
      async showSaveDialog() {
        return { canceled: true };
      },
    },
    imageExtensions: ['jpg', 'jpeg', 'png'],
    getMainWindow: () => ({ id: 1 }),
    getInspiraApp: () => ({
      getImageDetail() {
        return { image: { original_file_name: 'poster.png' } };
      },
      exportImage() {
        exportCalled = true;
      },
    }),
    withScopedAccess: async (_dialogResult, run) => run(),
    wrapMainProcessError(error) {
      return error;
    },
    logger: null,
  });

  const result = await handler({}, 42);

  assert.deepEqual(result, { canceled: true });
  assert.equal(exportCalled, false);
});

test('single image export handler surfaces stable export error codes instead of dropping the reply', async () => {
  const { logger, entries } = createLoggerHarness();
  const handler = createSingleImageExportHandler({
    app: {
      getPath() {
        return '/Users/test/Downloads';
      },
    },
    dialog: {
      async showSaveDialog() {
        return {
          canceled: false,
          filePath: '/tmp/review-export.png',
          bookmark: 'bookmark-data',
        };
      },
    },
    imageExtensions: ['jpg', 'jpeg', 'png'],
    getMainWindow: () => ({ id: 1 }),
    getInspiraApp: () => ({
      getImageDetail() {
        return { image: { original_file_name: 'poster.png' } };
      },
      exportImage() {
        const error = new Error('EXPORT_PERMISSION_DENIED');
        error.code = 'EXPORT_PERMISSION_DENIED';
        throw error;
      },
    }),
    withScopedAccess: async (_dialogResult, run) => run(),
    wrapMainProcessError(error) {
      return error;
    },
    logger,
  });

  await assert.rejects(
    () => handler({}, 42),
    (error) => error?.code === 'EXPORT_PERMISSION_DENIED',
  );
  assert.equal(
    entries.some((entry) => entry.level === 'error' && entry.message === 'export-image-ipc-failed'),
    true,
  );
});
