import test from 'node:test';
import assert from 'node:assert/strict';

import { createFolderImportHandler } from './import-folder.js';

function createLoggerHarness() {
  const entries = [];
  return {
    logger: {
      error(message, context = {}) {
        entries.push({ level: 'error', message, context });
      },
    },
    entries,
  };
}

function createHandlerHarness(options = {}) {
  const dialogCalls = [];
  const messageBoxCalls = [];
  const scopedCalls = [];
  const importCalls = [];
  const emittedProgress = [];
  const imageLimitDialogCalls = [];
  const { logger, entries } = createLoggerHarness();

  const handler = createFolderImportHandler({
    dialog: {
      async showOpenDialog(_window, dialogOptions) {
        dialogCalls.push(dialogOptions);
        return options.openDialogResult ?? {
          canceled: false,
          filePaths: ['/tmp/import-folder'],
          bookmark: 'bookmark-data',
        };
      },
      async showMessageBox(_window, dialogOptions) {
        messageBoxCalls.push(dialogOptions);
        return { response: 0 };
      },
    },
    getMainWindow: () => ({ id: 1 }),
    getInspiraApp: () => ({
      getImageCount() {
        return options.imageCount ?? 0;
      },
      async importFolder(folderPath, config = {}) {
        importCalls.push({ folderPath, config });
        if (typeof options.onImportFolder === 'function') {
          return options.onImportFolder({ folderPath, config });
        }
        return options.importSummary ?? {
          totalScanned: 0,
          importedCount: 0,
          duplicateCount: 0,
          skippedCount: 0,
          imported: [],
          duplicates: [],
          skipped: [],
        };
      },
    }),
    withScopedAccess: async (dialogResult, run) => {
      scopedCalls.push(dialogResult);
      return run();
    },
    withSecurityScopedDialogOptions(dialogOptions) {
      return { ...dialogOptions, securityScopedBookmarks: true };
    },
    hasDialogSelection(result) {
      return !result?.canceled && Array.isArray(result?.filePaths) && result.filePaths.length > 0;
    },
    maxImageCount: options.maxImageCount ?? 50_000,
    async showImageLimitReachedDialog() {
      imageLimitDialogCalls.push(true);
    },
    emitImportProgress(payload) {
      emittedProgress.push(payload);
    },
    isImageLimitReachedError(error) {
      return error?.code === 'IMAGE_LIMIT_REACHED' || error?.message === 'IMAGE_LIMIT_REACHED';
    },
    logger,
  });

  return {
    handler,
    dialogCalls,
    messageBoxCalls,
    scopedCalls,
    importCalls,
    emittedProgress,
    imageLimitDialogCalls,
    entries,
  };
}

test('folder import shows one summary dialog when six files fail due to unsupported formats', async () => {
  const harness = createHandlerHarness({
    importSummary: {
      totalScanned: 8,
      importedCount: 2,
      duplicateCount: 0,
      skippedCount: 6,
      imported: [],
      duplicates: [],
      skipped: Array.from({ length: 6 }, (_, index) => ({
        status: 'skipped',
        reason: 'UNSUPPORTED_FORMAT',
        filePath: `/tmp/image-${index}.gif`,
      })),
    },
  });

  const result = await harness.handler();

  assert.equal(result.skippedCount, 6);
  assert.equal(harness.importCalls.length, 1);
  assert.equal(harness.messageBoxCalls.length, 1);
  assert.match(harness.messageBoxCalls[0].message, /JPG\/JPEG\/PNG\/WEBP\/HEIC/);
  assert.match(harness.messageBoxCalls[0].message, /6 张图片导入失败/);
});

test('folder import does not show the unsupported format dialog when skips have other reasons only', async () => {
  const harness = createHandlerHarness({
    importSummary: {
      totalScanned: 3,
      importedCount: 1,
      duplicateCount: 0,
      skippedCount: 2,
      imported: [],
      duplicates: [],
      skipped: [
        { status: 'skipped', reason: 'FILE_TOO_LARGE', filePath: '/tmp/huge.psd' },
        { status: 'skipped', reason: 'HASH_COMPUTE_FAILED', filePath: '/tmp/bad.png' },
      ],
    },
  });

  await harness.handler();

  assert.equal(harness.messageBoxCalls.length, 0);
});

test('folder import summary dialog counts only unsupported format failures when reasons are mixed', async () => {
  const harness = createHandlerHarness({
    importSummary: {
      totalScanned: 5,
      importedCount: 2,
      duplicateCount: 1,
      skippedCount: 2,
      imported: [],
      duplicates: [],
      skipped: [
        { status: 'skipped', reason: 'UNSUPPORTED_FORMAT', filePath: '/tmp/a.gif' },
        { status: 'skipped', reason: 'FILE_TOO_LARGE', filePath: '/tmp/b.png' },
        { status: 'skipped', reason: 'UNSUPPORTED_FORMAT', filePath: '/tmp/c.bmp' },
      ],
    },
  });

  await harness.handler();

  assert.equal(harness.messageBoxCalls.length, 1);
  assert.match(harness.messageBoxCalls[0].message, /2 张图片导入失败/);
});

test('folder import does not show dialogs when the folder picker is canceled', async () => {
  const harness = createHandlerHarness({
    openDialogResult: { canceled: true, filePaths: [] },
  });

  const result = await harness.handler();

  assert.deepEqual(result, { canceled: true });
  assert.equal(harness.importCalls.length, 0);
  assert.equal(harness.messageBoxCalls.length, 0);
});

test('folder import keeps the image limit flow without showing the unsupported format summary', async () => {
  const harness = createHandlerHarness({
    imageCount: 50_000,
  });

  const result = await harness.handler();

  assert.deepEqual(result, { canceled: true, reason: 'IMAGE_LIMIT_REACHED' });
  assert.equal(harness.imageLimitDialogCalls.length, 1);
  assert.equal(harness.importCalls.length, 0);
  assert.equal(harness.messageBoxCalls.length, 0);
});

test('folder import errors do not show the unsupported format summary dialog', async () => {
  const harness = createHandlerHarness({
    onImportFolder() {
      throw new Error('boom');
    },
  });

  await assert.rejects(() => harness.handler(), /boom/);

  assert.equal(harness.messageBoxCalls.length, 0);
  assert.equal(harness.emittedProgress.length, 1);
  assert.equal(harness.emittedProgress[0].phase, 'error');
});
