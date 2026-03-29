import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as electron from 'electron';
import { InspiraDBApp } from '../src/index.js';
import { MAX_IMAGE_COUNT } from '../src/core/config.js';
import { createLogger } from '../src/utils/logger.js';
import {
  getSecurityScopedBookmark,
  hasDialogSelection,
  withSecurityScopedAccess,
  withSecurityScopedDialogOptions,
} from './security-scoped.js';
import { fileToDataUrl, fileToPreviewDataUrl } from './image-data-url.js';
import { createSingleImageExportHandler } from './export-image.js';
import { createFolderImportHandler } from './import-folder.js';
import { resolveCompatibleUserDataPath } from './user-data-path.js';

const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
} = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'bmp'];

let mainWindow = null;
let inspiraApp = null;
const logger = createLogger('electron-main');

function createAppError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function wrapMainProcessError(error, fallbackCode) {
  if (error?.code || error?.message === fallbackCode) {
    return error;
  }

  const wrapped = createAppError(fallbackCode);
  wrapped.cause = error;
  return wrapped;
}

function isImageLimitReachedError(error) {
  return error?.code === 'IMAGE_LIMIT_REACHED' || error?.message === 'IMAGE_LIMIT_REACHED';
}

async function showImageLimitReachedDialog() {
  await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['知道了'],
    defaultId: 0,
    title: '提示',
    message: `已达到产品性能极限 ${Math.trunc(MAX_IMAGE_COUNT / 10_000)} 万张，有扩容需求请联系开发者`,
  });
}

function emitImportProgress(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('inspiradb:import-progress', payload);
}

function readClipboardImage(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw createAppError('IMAGE_FILE_MISSING');
  }

  const image = nativeImage.createFromPath(filePath);
  if (!image || image.isEmpty()) {
    throw createAppError('COPY_IMAGE_FAILED');
  }

  return image;
}

function decorateSearchItems(result) {
  return {
    ...result,
    items: (result.items || []).map((item) => ({
      ...item,
      thumbnail_data_url: fileToDataUrl(item.thumbnail_path),
    })),
  };
}

function decorateImageDetail(detail) {
  const originalExt = path.extname(String(detail?.image?.original_file_name || detail?.image?.library_path || '')).toLowerCase();
  const previewSourcePath = originalExt === '.heic'
    ? (detail.image.preview_path || detail.image.thumbnail_path)
    : detail.image.library_path;

  return {
    ...detail,
    image: {
      ...detail.image,
      preview_data_url: fileToPreviewDataUrl(previewSourcePath),
      thumbnail_data_url: fileToDataUrl(detail.image.thumbnail_path),
    },
  };
}

async function withDialogScopedAccess(dialogResult, run) {
  return withSecurityScopedAccess(app, getSecurityScopedBookmark(dialogResult), run);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#ecf1eb',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }
}

function createInspiraApp() {
  const userDataPath = resolveCompatibleUserDataPath({
    userDataPath: app.getPath('userData'),
    logger,
  });
  return new InspiraDBApp({
    dbPath: path.join(userDataPath, 'inspiradb.sqlite'),
    libraryRootPath: path.join(userDataPath, 'library'),
    thumbnailRootPath: path.join(userDataPath, 'thumbnails'),
    previewRootPath: path.join(userDataPath, 'previews'),
    autoStartQueue: true,
  });
}

function createMenu() {
  const template = [
    // App 菜单
    {
      label: 'InspiraDB',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // Edit 菜单
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    // Window 菜单 - 关键修复
    {
      label: 'Window',
      submenu: [
        {
          label: 'Show Main Window',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isDestroyed()) {
                createMainWindow();
              } else {
                mainWindow.show();
                mainWindow.focus();
              }
            } else {
              createMainWindow();
            }
          }
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerIpcHandlers() {
  ipcMain.handle('inspiradb:import-folder', createFolderImportHandler({
    dialog,
    getMainWindow: () => mainWindow,
    getInspiraApp: () => inspiraApp,
    withScopedAccess: withDialogScopedAccess,
    withSecurityScopedDialogOptions,
    hasDialogSelection,
    maxImageCount: MAX_IMAGE_COUNT,
    showImageLimitReachedDialog,
    emitImportProgress,
    isImageLimitReachedError,
    logger,
  }));

  ipcMain.handle('inspiradb:import-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, withSecurityScopedDialogOptions({
      title: '选择要导入的图片',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    }));

    if (!hasDialogSelection(result)) {
      return { canceled: true };
    }

    if (inspiraApp.getImageCount() >= MAX_IMAGE_COUNT) {
      await showImageLimitReachedDialog();
      return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
    }

    emitImportProgress({ mode: 'single', phase: 'started', current: 0, total: 1 });

    try {
      const importResult = await withDialogScopedAccess(result, () => inspiraApp.importFile(result.filePaths[0]));
      if (importResult?.status === 'imported' && importResult?.image?.id) {
        emitImportProgress({
          mode: 'single',
          phase: 'analyzing',
          current: 0,
          total: 1,
          readyCount: 0,
          failedCount: 0,
        });

        await inspiraApp.waitForImportedImagesSettled([importResult.image.id], (progress) => {
          emitImportProgress({
            mode: 'single',
            phase: 'analyzing',
            ...progress,
          });
        });
      }

      emitImportProgress({ mode: 'single', phase: 'completed', current: 1, total: 1, status: importResult?.status });
      return importResult;
    } catch (error) {
      if (isImageLimitReachedError(error)) {
        emitImportProgress({ mode: 'single', phase: 'error', current: 1, total: 1, message: 'IMAGE_LIMIT_REACHED' });
        await showImageLimitReachedDialog();
        return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
      }

      emitImportProgress({ mode: 'single', phase: 'error', current: 1, total: 1, message: String(error?.message || error) });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:export-image', createSingleImageExportHandler({
    app,
    dialog,
    imageExtensions: IMAGE_EXTENSIONS,
    getMainWindow: () => mainWindow,
    getInspiraApp: () => inspiraApp,
    withScopedAccess: withDialogScopedAccess,
    wrapMainProcessError,
    logger,
  }));

  ipcMain.handle('inspiradb:export-images', async (_, payload = {}) => {
    const imageIds = Array.isArray(payload.imageIds) ? payload.imageIds : [];
    if (!imageIds.length) {
      return { canceled: true, reason: 'EMPTY_EXPORT_SELECTION' };
    }

    let result;
    try {
      result = await dialog.showOpenDialog(mainWindow, withSecurityScopedDialogOptions({
        title: '选择导出目录',
        properties: ['openDirectory', 'createDirectory'],
      }));
    } catch (error) {
      throw wrapMainProcessError(error, 'EXPORT_DIALOG_FAILED');
    }

    if (!hasDialogSelection(result)) {
      return { canceled: true };
    }

    try {
      return await withDialogScopedAccess(result, () => inspiraApp.exportImages(imageIds, result.filePaths[0]));
    } catch (error) {
      throw wrapMainProcessError(error, 'EXPORT_FAILED');
    }
  });

  ipcMain.handle('inspiradb:copy-image', (_, imageId) => {
    const detail = inspiraApp.getImageDetail(imageId);
    const image = readClipboardImage(detail?.image?.library_path);
    clipboard.writeImage(image);
    return { imageId, copied: true };
  });

  ipcMain.handle('inspiradb:search', async (_, payload = {}) => {
    const searchResult = await inspiraApp.searchImages(
      payload.query,
      payload.selectedTagIds,
      payload.filterMode,
      {
      page: payload.page,
      pageSize: payload.pageSize,
      },
    );

    return decorateSearchItems(searchResult);
  });

  ipcMain.handle('inspiradb:detail', (_, imageId) => {
    return decorateImageDetail(inspiraApp.getImageDetail(imageId));
  });

  ipcMain.handle('inspiradb:update-caption', (_, payload = {}) => {
    return inspiraApp.updateImageCaption(payload.imageId, payload.content);
  });

  ipcMain.handle('inspiradb:update-tags', (_, payload = {}) => {
    return inspiraApp.updateImageTags(payload.imageId, payload.tagIds);
  });

  ipcMain.handle('inspiradb:reanalyze', (_, imageId) => {
    return inspiraApp.rebuildImageAnalysis(imageId);
  });

  ipcMain.handle('inspiradb:delete', (_, imageId) => {
    return inspiraApp.deleteImage(imageId);
  });

  ipcMain.handle('inspiradb:filter-tags', (_, payload = {}) => {
    return inspiraApp.getFilterTags(payload.query, payload.selectedTagIds, payload.filterMode);
  });

  ipcMain.handle('inspiradb:list-tag-tree', () => {
    return inspiraApp.listTagTree();
  });

  ipcMain.handle('inspiradb:create-tag', (_, payload = {}) => {
    return inspiraApp.createTag(payload);
  });

  ipcMain.handle('inspiradb:update-tag', (_, payload = {}) => {
    return inspiraApp.updateTag(payload);
  });

  ipcMain.handle('inspiradb:delete-tag', (_, tagId) => {
    return inspiraApp.deleteTag(tagId);
  });

  ipcMain.handle('inspiradb:preview-tag-organization', async () => {
    logger.info('preview-tag-organization-ipc-received');
    try {
      const result = await inspiraApp.previewTagOrganization();
      logger.info('preview-tag-organization-ipc-succeeded', {
        operationCount: Array.isArray(result?.operations) ? result.operations.length : 0,
        affectedImageCount: Number(result?.affectedImageCount || 0),
      });
      return result;
    } catch (error) {
      logger.error('preview-tag-organization-ipc-failed', {
        error: String(error?.message || error),
        code: error?.code || '',
      });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:apply-tag-organization-plan', (_, payload = {}) => {
    const operationCount = Array.isArray(payload)
      ? payload.length
      : Array.isArray(payload?.operations)
        ? payload.operations.length
        : 0;
    logger.info('apply-tag-organization-plan-ipc-received', { operationCount });
    try {
      const result = inspiraApp.applyTagOrganizationPlan(payload);
      logger.info('apply-tag-organization-plan-ipc-succeeded', {
        appliedCount: Number(result?.appliedCount || 0),
        skippedCount: Number(result?.skippedCount || 0),
        affectedImageCount: Number(result?.affectedImageCount || 0),
      });
      return result;
    } catch (error) {
      logger.error('apply-tag-organization-plan-ipc-failed', {
        error: String(error?.message || error),
        code: error?.code || '',
      });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:get-tag-organization-status', () => {
    return inspiraApp.getTagOrganizationStatus();
  });

  ipcMain.handle('inspiradb:get-tag-filter-mode', () => {
    return inspiraApp.getTagFilterMode();
  });

  ipcMain.handle('inspiradb:set-tag-filter-mode', (_, mode) => {
    return inspiraApp.setTagFilterMode(mode);
  });

  ipcMain.handle('inspiradb:get-setting', (_, key, fallback) => {
    return inspiraApp.getSetting(key, fallback);
  });

  ipcMain.handle('inspiradb:set-setting', (_, key, value) => {
    return inspiraApp.setSetting(key, value);
  });

  // ==================== 标签协同进化 (OpenClaw) ====================

  ipcMain.handle('inspiradb:check-openclaw-status', async () => {
    try {
      return await inspiraApp.checkOpenClawStatus();
    } catch (error) {
      return { available: false, error: error.message };
    }
  });

  ipcMain.handle('inspiradb:start-co-evolution', async () => {
    logger.info('start-co-evolution-ipc-received');
    try {
      const result = await inspiraApp.startCoEvolution();
      logger.info('start-co-evolution-succeeded', {
        sessionId: result.sessionId,
        suggestionCount: result.suggestions?.length,
      });
      return result;
    } catch (error) {
      logger.error('start-co-evolution-failed', {
        error: String(error?.message || error),
        code: error?.code || '',
      });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:get-co-evolution-session', () => {
    return inspiraApp.getCoEvolutionSession();
  });

  ipcMain.handle('inspiradb:apply-co-evolution-suggestions', async (_, payload = {}) => {
    const { selectedIds, userRating, userComments } = payload;
    logger.info('apply-co-evolution-suggestions-ipc-received', {
      selectedCount: selectedIds?.length,
      userRating,
    });
    try {
      const result = await inspiraApp.applyCoEvolutionSuggestions(selectedIds, {
        userRating,
        userComments,
      });
      logger.info('apply-co-evolution-suggestions-succeeded', {
        appliedCount: result?.appliedCount,
      });
      return result;
    } catch (error) {
      logger.error('apply-co-evolution-suggestions-failed', {
        error: String(error?.message || error),
        code: error?.code || '',
      });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:cancel-co-evolution', () => {
    inspiraApp.cancelCoEvolution();
    return { cancelled: true };
  });

}

app.whenReady().then(() => {
  inspiraApp = createInspiraApp();
  registerIpcHandlers();
  createMainWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch((error) => {
  console.error('app-startup-failed', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (inspiraApp) {
    inspiraApp.close();
  }
});
