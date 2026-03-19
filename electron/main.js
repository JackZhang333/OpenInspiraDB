import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as electron from 'electron';
import { InspiraDBApp } from '../src/index.js';
import { MAX_IMAGE_COUNT } from '../src/core/config.js';
import { createLogger } from '../src/utils/logger.js';

const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
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

function toMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function fileToDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const mimeType = toMimeType(filePath);
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${base64}`;
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
  return {
    ...detail,
    image: {
      ...detail.image,
      preview_data_url: fileToDataUrl(detail.image.library_path),
      thumbnail_data_url: fileToDataUrl(detail.image.thumbnail_path),
    },
  };
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
  const userDataPath = app.getPath('userData');
  return new InspiraDBApp({
    dbPath: path.join(userDataPath, 'inspiradb.sqlite'),
    libraryRootPath: path.join(userDataPath, 'library'),
    thumbnailRootPath: path.join(userDataPath, 'thumbnails'),
    autoStartQueue: true,
  });
}

function registerIpcHandlers() {
  ipcMain.handle('inspiradb:import-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择要导入的图片文件夹',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    if (inspiraApp.getImageCount() >= MAX_IMAGE_COUNT) {
      await showImageLimitReachedDialog();
      return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
    }

    try {
      return await inspiraApp.importFolder(result.filePaths[0], {
        onProgress(progress) {
          emitImportProgress(progress);
        },
      });
    } catch (error) {
      if (isImageLimitReachedError(error)) {
        emitImportProgress({ mode: 'folder', phase: 'error', message: 'IMAGE_LIMIT_REACHED' });
        await showImageLimitReachedDialog();
        return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
      }

      emitImportProgress({ mode: 'folder', phase: 'error', message: String(error?.message || error) });
      throw error;
    }
  });

  ipcMain.handle('inspiradb:import-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择要导入的图片',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    if (inspiraApp.getImageCount() >= MAX_IMAGE_COUNT) {
      await showImageLimitReachedDialog();
      return { canceled: true, reason: 'IMAGE_LIMIT_REACHED' };
    }

    emitImportProgress({ mode: 'single', phase: 'started', current: 0, total: 1 });

    try {
      const importResult = await inspiraApp.importFile(result.filePaths[0]);
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

  ipcMain.handle('inspiradb:export-image', async (_, imageId) => {
    const detail = inspiraApp.getImageDetail(imageId);
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: '导出图片',
      defaultPath: path.join(app.getPath('downloads'), detail.image.original_file_name),
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      showOverwriteConfirmation: true,
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    return inspiraApp.exportImage(imageId, saveResult.filePath);
  });

  ipcMain.handle('inspiradb:export-images', async (_, payload = {}) => {
    const imageIds = Array.isArray(payload.imageIds) ? payload.imageIds : [];
    if (!imageIds.length) {
      return { canceled: true, reason: 'EMPTY_EXPORT_SELECTION' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择导出目录',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    return inspiraApp.exportImages(imageIds, result.filePaths[0]);
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

}

app.whenReady().then(() => {
  inspiraApp = createInspiraApp();
  registerIpcHandlers();
  createMainWindow();

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
