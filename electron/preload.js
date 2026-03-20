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
  updateImageTags(imageId, tagIds) {
    return ipcRenderer.invoke('inspiradb:update-tags', { imageId, tagIds });
  },
  rebuildImageAnalysis(imageId) {
    return ipcRenderer.invoke('inspiradb:reanalyze', imageId);
  },
  deleteImage(imageId) {
    return ipcRenderer.invoke('inspiradb:delete', imageId);
  },
  getFilterTags(payload) {
    return ipcRenderer.invoke('inspiradb:filter-tags', payload);
  },
  listTagTree() {
    return ipcRenderer.invoke('inspiradb:list-tag-tree');
  },
  createTag(payload) {
    return ipcRenderer.invoke('inspiradb:create-tag', payload);
  },
  updateTag(payload) {
    return ipcRenderer.invoke('inspiradb:update-tag', payload);
  },
  deleteTag(tagId) {
    return ipcRenderer.invoke('inspiradb:delete-tag', tagId);
  },
  previewTagOrganization() {
    return ipcRenderer.invoke('inspiradb:preview-tag-organization');
  },
  applyTagOrganizationPlan(payload) {
    return ipcRenderer.invoke('inspiradb:apply-tag-organization-plan', payload);
  },
  getTagOrganizationStatus() {
    return ipcRenderer.invoke('inspiradb:get-tag-organization-status');
  },
  getTagFilterMode() {
    return ipcRenderer.invoke('inspiradb:get-tag-filter-mode');
  },
  setTagFilterMode(mode) {
    return ipcRenderer.invoke('inspiradb:set-tag-filter-mode', mode);
  },
  getSetting(key, fallback) {
    return ipcRenderer.invoke('inspiradb:get-setting', key, fallback);
  },
  setSetting(key, value) {
    return ipcRenderer.invoke('inspiradb:set-setting', key, value);
  },
});
