import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as electron from 'electron';
import { InspiraDBApp } from '../src/index.js';

const { app, BrowserWindow, dialog, ipcMain, safeStorage } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'bmp'];

let mainWindow = null;
let inspiraApp = null;

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
    secureStorePath: path.join(userDataPath, 'secure-store.json'),
    secretEncryption: {
      isEncryptionAvailable() {
        return safeStorage.isEncryptionAvailable();
      },
      encryptString(value) {
        return safeStorage.encryptString(value);
      },
      decryptString(buffer) {
        return safeStorage.decryptString(buffer);
      },
    },
    requireSecretEncryption: true,
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

    try {
      return await inspiraApp.importFolder(result.filePaths[0], {
        onProgress(progress) {
          emitImportProgress(progress);
        },
      });
    } catch (error) {
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

  ipcMain.handle('inspiradb:search', async (_, payload = {}) => {
    const searchResult = await inspiraApp.searchImages(payload.query, payload.selectedTags, {
      page: payload.page,
      pageSize: payload.pageSize,
    });

    return decorateSearchItems(searchResult);
  });

  ipcMain.handle('inspiradb:detail', (_, imageId) => {
    return decorateImageDetail(inspiraApp.getImageDetail(imageId));
  });

  ipcMain.handle('inspiradb:update-caption', (_, payload = {}) => {
    return inspiraApp.updateImageCaption(payload.imageId, payload.content);
  });

  ipcMain.handle('inspiradb:update-tags', (_, payload = {}) => {
    return inspiraApp.updateImageTags(payload.imageId, payload.tags);
  });

  ipcMain.handle('inspiradb:reanalyze', (_, imageId) => {
    return inspiraApp.rebuildImageAnalysis(imageId);
  });

  ipcMain.handle('inspiradb:delete', (_, imageId) => {
    return inspiraApp.deleteImage(imageId);
  });

  ipcMain.handle('inspiradb:filter-tags', (_, query = '') => {
    return inspiraApp.getFilterTags(query);
  });

  ipcMain.handle('inspiradb:get-settings', () => {
    return inspiraApp.getAppSettings();
  });

  ipcMain.handle('inspiradb:update-settings', (_, payload = {}) => {
    return inspiraApp.updateAppSettings(payload);
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
