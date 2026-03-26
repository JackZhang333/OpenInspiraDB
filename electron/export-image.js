import path from 'node:path';

import {
  getSecurityScopedBookmark,
  hasDialogSelection,
  withSecurityScopedDialogOptions,
} from './security-scoped.js';

export function sanitizeDialogFileName(fileName, fallback = 'image.jpg') {
  const cleaned = String(fileName || '')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_');
  return cleaned || fallback;
}

export function resolveSingleImageExportPath(filePath, originalFileName) {
  const resolvedPath = path.resolve(String(filePath || ''));
  if (path.extname(resolvedPath)) {
    return resolvedPath;
  }

  const originalExt = path.extname(String(originalFileName || '')).toLowerCase();
  if (!originalExt) {
    return resolvedPath;
  }

  return `${resolvedPath}${originalExt}`;
}

export function buildSingleImageSaveDialogOptions({
  downloadsPath,
  imageId,
  originalFileName,
  imageExtensions,
} = {}) {
  const defaultFileName = sanitizeDialogFileName(
    originalFileName,
    `image-${Number(imageId) || 'export'}.jpg`,
  );

  return {
    title: '导出图片',
    defaultPath: path.join(downloadsPath, defaultFileName),
    filters: [{ name: 'Images', extensions: imageExtensions }],
    showOverwriteConfirmation: true,
  };
}

export function createSingleImageExportHandler({
  app,
  dialog,
  imageExtensions,
  getMainWindow,
  getInspiraApp,
  withScopedAccess,
  wrapMainProcessError,
  logger,
}) {
  return async (_, imageId) => {
    const inspiraApp = getInspiraApp();
    const detail = inspiraApp.getImageDetail(imageId);
    const saveDialogOptions = withSecurityScopedDialogOptions(
      buildSingleImageSaveDialogOptions({
        downloadsPath: app.getPath('downloads'),
        imageId,
        originalFileName: detail?.image?.original_file_name,
        imageExtensions,
      }),
    );

    let saveResult;
    try {
      saveResult = await dialog.showSaveDialog(getMainWindow(), saveDialogOptions);
    } catch (error) {
      const wrappedError = wrapMainProcessError(error, 'EXPORT_DIALOG_FAILED');
      logger?.error?.('export-image-ipc-dialog-failed', {
        imageId,
        code: wrappedError?.code || wrappedError?.message || 'EXPORT_DIALOG_FAILED',
        error: String(error?.message || error),
      });
      throw wrappedError;
    }

    if (!hasDialogSelection(saveResult)) {
      return { canceled: true };
    }

    const targetFilePath = resolveSingleImageExportPath(
      saveResult.filePath,
      detail?.image?.original_file_name,
    );
    const scopedDialogResult = targetFilePath === saveResult.filePath
      ? saveResult
      : { ...saveResult, filePath: targetFilePath };
    const bookmark = getSecurityScopedBookmark(saveResult);

    logger?.info?.('export-image-ipc-selected', {
      imageId,
      selectedPath: String(saveResult.filePath || ''),
      targetFilePath,
      hasBookmark: Boolean(bookmark),
    });

    try {
      const result = await withScopedAccess(scopedDialogResult, () => (
        inspiraApp.exportImage(imageId, targetFilePath)
      ));
      logger?.info?.('export-image-ipc-succeeded', {
        imageId,
        selectedPath: String(saveResult.filePath || ''),
        targetFilePath,
        hasBookmark: Boolean(bookmark),
        warningCount: Array.isArray(result?.warnings) ? result.warnings.length : 0,
      });
      return result;
    } catch (error) {
      const wrappedError = wrapMainProcessError(error, 'EXPORT_FAILED');
      logger?.error?.('export-image-ipc-failed', {
        imageId,
        selectedPath: String(saveResult.filePath || ''),
        targetFilePath,
        hasBookmark: Boolean(bookmark),
        code: wrappedError?.code || wrappedError?.message || 'EXPORT_FAILED',
        error: String(error?.message || error),
      });
      throw wrappedError;
    }
  };
}
