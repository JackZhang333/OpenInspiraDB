export const SUPPORTED_BATCH_IMPORT_FORMATS_LABEL = 'JPG/JPEG/PNG/WEBP/HEIC';

export function countUnsupportedFormatImports(summary = {}) {
  return (summary.skipped || []).filter((item) => item?.reason === 'UNSUPPORTED_FORMAT').length;
}

export function buildFolderImportDialogOptions() {
  return {
    title: '选择要导入的图片文件夹',
    properties: ['openDirectory', 'createDirectory'],
  };
}

export function buildUnsupportedFormatSummaryDialogOptions(unsupportedCount) {
  return {
    type: 'warning',
    buttons: ['知道了'],
    defaultId: 0,
    title: '提示',
    message: `仅支持 ${SUPPORTED_BATCH_IMPORT_FORMATS_LABEL} 格式，${unsupportedCount} 张图片导入失败。`,
  };
}

export function createFolderImportHandler({
  dialog,
  getMainWindow,
  getInspiraApp,
  withScopedAccess,
  withSecurityScopedDialogOptions,
  hasDialogSelection,
  maxImageCount,
  showImageLimitReachedDialog,
  emitImportProgress,
  isImageLimitReachedError,
  logger,
}) {
  return async () => {
    const result = await dialog.showOpenDialog(
      getMainWindow(),
      withSecurityScopedDialogOptions(buildFolderImportDialogOptions()),
    );

    if (!hasDialogSelection(result)) {
      return { canceled: true };
    }

    const inspiraApp = getInspiraApp();
    if (inspiraApp.getImageCount() >= maxImageCount) {
      await showImageLimitReachedDialog();
      return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
    }

    try {
      const importSummary = await withScopedAccess(result, () => inspiraApp.importFolder(result.filePaths[0], {
        onProgress(progress) {
          emitImportProgress(progress);
        },
      }));
      const unsupportedCount = countUnsupportedFormatImports(importSummary);

      if (unsupportedCount > 0) {
        try {
          await dialog.showMessageBox(
            getMainWindow(),
            buildUnsupportedFormatSummaryDialogOptions(unsupportedCount),
          );
        } catch (error) {
          logger?.error?.('import-folder-unsupported-format-dialog-failed', {
            unsupportedCount,
            error: String(error?.message || error),
          });
        }
      }

      return importSummary;
    } catch (error) {
      if (isImageLimitReachedError(error)) {
        emitImportProgress({ mode: 'folder', phase: 'error', message: 'IMAGE_LIMIT_REACHED' });
        await showImageLimitReachedDialog();
        return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
      }

      emitImportProgress({ mode: 'folder', phase: 'error', message: String(error?.message || error) });
      throw error;
    }
  };
}
