import { contextBridge, ipcRenderer } from 'electron';

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('inspira', {
  // 文件夹选择
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 文件选择
  selectFiles: () => ipcRenderer.invoke('select-files'),

  // 获取设置
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // 保存设置
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // 更新素材元数据
  updateMedia: (id, metadata) => ipcRenderer.invoke('update-media', id, metadata),

  // 删除素材
  deleteMedia: (id) => ipcRenderer.invoke('delete-media', id),

  // 重新分析
  reanalyze: (id) => ipcRenderer.invoke('reanalyze', id),

  // 开始拖拽图片
  startDragImage: (filePath) => ipcRenderer.invoke('start-drag-image', filePath),
});
