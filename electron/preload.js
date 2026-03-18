import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('inspira', {
  invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
  },
  onImportProgress(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_, payload) => {
      callback(payload || {});
    };

    ipcRenderer.on('inspiradb:import-progress', listener);
    return () => {
      ipcRenderer.removeListener('inspiradb:import-progress', listener);
    };
  },
  importFolder() {
    return ipcRenderer.invoke('inspiradb:import-folder');
  },
  importFile() {
    return ipcRenderer.invoke('inspiradb:import-file');
  },
  exportImage(imageId) {
    return ipcRenderer.invoke('inspiradb:export-image', imageId);
  },
  exportImages(imageIds) {
    return ipcRenderer.invoke('inspiradb:export-images', { imageIds });
  },
  copyImage(imageId) {
    return ipcRenderer.invoke('inspiradb:copy-image', imageId);
  },
  search(payload) {
    return ipcRenderer.invoke('inspiradb:search', payload);
  },
  getImageDetail(imageId) {
    return ipcRenderer.invoke('inspiradb:detail', imageId);
  },
  updateImageCaption(imageId, content) {
    return ipcRenderer.invoke('inspiradb:update-caption', { imageId, content });
  },
  updateImageTags(imageId, tags) {
    return ipcRenderer.invoke('inspiradb:update-tags', { imageId, tags });
  },
  rebuildImageAnalysis(imageId) {
    return ipcRenderer.invoke('inspiradb:reanalyze', imageId);
  },
  deleteImage(imageId) {
    return ipcRenderer.invoke('inspiradb:delete', imageId);
  },
  getFilterTags(query) {
    return ipcRenderer.invoke('inspiradb:filter-tags', query);
  },
  getSettings() {
    return ipcRenderer.invoke('inspiradb:get-settings');
  },
  updateSettings(payload) {
    return ipcRenderer.invoke('inspiradb:update-settings', payload);
  },
});
