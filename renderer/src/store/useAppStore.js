import { create } from 'zustand';

function getErrorMessage(error) {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  return error.message || '请求失败';
}

export const useAppStore = create((set, get) => ({
  query: '',
  selectedTag: null,
  page: 1,
  pageSize: 50,
  result: { total: 0, items: [] },
  availableTags: [],
  selectedImageId: null,
  detail: null,
  settings: null,
  loading: false,
  importing: false,
  importProgress: null,
  detailLoading: false,
  saving: false,
  error: null,

  setQuery(query) {
    set({ query });
  },

  async runSearch() {
    set({ page: 1 });
    return get().refreshSearch();
  },

  async selectTag(tagName) {
    set({ selectedTag: tagName, page: 1 });
    return get().refreshSearch();
  },

  async clearTag() {
    set({ selectedTag: null, page: 1 });
    return get().refreshSearch();
  },

  async refreshSearch() {
    const { query, selectedTag, page, pageSize, selectedImageId } = get();
    set({ loading: true, error: null });

    try {
      const selectedTags = selectedTag ? [selectedTag] : [];
      const [result, availableTags] = await Promise.all([
        window.inspira.search({ query, selectedTags, page, pageSize }),
        window.inspira.getFilterTags(query),
      ]);

      set({
        result,
        availableTags,
        loading: false,
      });

      if (selectedImageId) {
        const stillExists = result.items.some((item) => item.id === selectedImageId);
        if (!stillExists) {
          set({ selectedImageId: null, detail: null });
        }
      }

      if (get().selectedImageId) {
        await get().reloadSelectedDetail();
      } else {
        set({ detail: null });
      }
    } catch (error) {
      set({
        loading: false,
        error: getErrorMessage(error),
      });
    }
  },

  async init() {
    await Promise.all([get().refreshSearch(), get().loadSettings()]);
  },

  async loadSettings() {
    try {
      const settings = await window.inspira.getSettings();
      set({ settings });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  async saveSettings(payload) {
    set({ saving: true, error: null });
    try {
      const settings = await window.inspira.updateSettings(payload);
      set({ settings, saving: false });
      await get().refreshSearch();
      return settings;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async importFolder() {
    set({ importing: true, error: null });
    try {
      const result = await window.inspira.importFolder();
      set({ importing: false });
      if (!result?.canceled) {
        await get().refreshSearch();
      }
      return result;
    } catch (error) {
      set({ importing: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async importFile() {
    set({ importing: true, error: null });
    try {
      const result = await window.inspira.importFile();
      set({ importing: false });
      if (!result?.canceled) {
        await get().refreshSearch();
      }
      return result;
    } catch (error) {
      set({ importing: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async selectImage(imageId) {
    set({ selectedImageId: imageId });
    await get().reloadSelectedDetail();
  },

  async reloadSelectedDetail() {
    const imageId = get().selectedImageId;
    if (!imageId) {
      set({ detail: null });
      return;
    }

    set({ detailLoading: true });
    try {
      const detail = await window.inspira.getImageDetail(imageId);
      set({ detail, detailLoading: false });
    } catch (error) {
      set({ detailLoading: false, error: getErrorMessage(error) });
    }
  },

  async saveMetadata(imageId, { caption, tags }) {
    if (!imageId) return;

    set({ saving: true, error: null });
    try {
      await Promise.all([
        window.inspira.updateImageCaption(imageId, caption),
        window.inspira.updateImageTags(imageId, tags),
      ]);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async rebuildAnalysis() {
    const imageId = get().selectedImageId;
    if (!imageId) return;

    set({ saving: true, error: null });
    try {
      await window.inspira.rebuildImageAnalysis(imageId);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
    }
  },

  async deleteSelected() {
    const imageId = get().selectedImageId;
    if (!imageId) return;

    set({ saving: true, error: null });
    try {
      await window.inspira.deleteImage(imageId);
      set({ selectedImageId: null, detail: null });
      await get().refreshSearch();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
    }
  },
}));
