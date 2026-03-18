import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择文件夹导入',
  });

  if (result.canceled) return null;

  return {
    folderPath: result.filePaths[0],
    files: [], // 实际应该扫描文件夹中的图片
  };
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
    ],
    title: '选择图片导入',
  });

  if (result.canceled) return null;

  return {
    filePaths: result.filePaths,
  };
});

ipcMain.handle('get-settings', async () => {
  // 从本地存储读取设置
  return {
    provider: 'zhipu',
    apiKey: '',
  };
});

ipcMain.handle('save-settings', async (event, settings) => {
  // 保存设置到本地存储
  console.log('保存设置:', settings);
  return true;
});

ipcMain.handle('start-drag-image', async (event, filePath) => {
  // 处理图片拖拽
  console.log('开始拖拽:', filePath);
});
