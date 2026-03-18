import { create } from 'zustand';

const ERROR_MESSAGES = {
  EMPTY_CAPTION: '描述不能为空',
  IMAGE_NOT_FOUND: '图片不存在，可能已被删除',
  DESKTOP_BRIDGE_UNAVAILABLE: '桌面桥接未就绪，请重启应用后再试',
  ZHIPU_API_KEY_MISSING: '请先在设置中填写智谱 API Key，或配置 ZHIPU_API_KEY 环境变量',
  ZHIPU_API_REQUEST_FAILED: '智谱接口请求失败，请检查 API Key、网络或模型权限',
  ZHIPU_EMBEDDING_EMPTY: '智谱 embeddings 返回为空，请稍后重试',
};

function getBridge() {
  const bridge = window?.inspira;
  if (!bridge) {
    const error = new Error('DESKTOP_BRIDGE_UNAVAILABLE');
    error.code = 'DESKTOP_BRIDGE_UNAVAILABLE';
    throw error;
  }
  return bridge;
}

function getErrorKey(error) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.code === 'string' && error.code) {
    return error.code;
  }

  if (typeof error.message === 'string' && error.message) {
    return error.message;
  }

  return '';
}

function getErrorMessage(error) {
  const errorKey = getErrorKey(error);
  if (errorKey && ERROR_MESSAGES[errorKey]) {
    return ERROR_MESSAGES[errorKey];
  }

  if (!error) {
    return '未知错误';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return '请求失败';
}

let importProgressUnsubscribe = null;

function normalizeImportProgress(payload = {}) {
  const total = Number(payload.total);
  const current = Number(payload.current);

  return {
    mode: String(payload.mode || 'single'),
    phase: String(payload.phase || 'processing'),
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    current: Number.isFinite(current) && current >= 0 ? current : 0,
    importedCount: Number(payload.importedCount || 0),
    duplicateCount: Number(payload.duplicateCount || 0),
    skippedCount: Number(payload.skippedCount || 0),
    readyCount: Number(payload.readyCount || 0),
    failedCount: Number(payload.failedCount || 0),
    analyzingCount: Number(payload.analyzingCount || 0),
    message: String(payload.message || ''),
  };
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

  ensureImportProgressListener() {
    const bridge = window?.inspira;
    if (importProgressUnsubscribe || typeof bridge?.onImportProgress !== 'function') {
      return;
    }

    importProgressUnsubscribe = bridge.onImportProgress((payload = {}) => {
      const progress = normalizeImportProgress(payload);
      const isActive = ['started', 'processing'].includes(progress.phase);

      set({
        importProgress: progress,
        importing: isActive,
      });

      if (progress.phase === 'completed') {
        get().refreshSearch().finally(() => {
          set({ importing: false, importProgress: null });
        });
      }

      if (progress.phase === 'error') {
        set({ importing: false });
      }
    });
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
      const bridge = getBridge();
      const [result, availableTags] = await Promise.all([
        bridge.search({ query, selectedTags, page, pageSize }),
        bridge.getFilterTags(query),
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
    get().ensureImportProgressListener();
    await Promise.all([get().refreshSearch(), get().loadSettings()]);
  },

  async loadSettings() {
    try {
      const settings = await getBridge().getSettings();
      set({ settings });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  async saveSettings(payload) {
    set({ saving: true, error: null });
    try {
      const settings = await getBridge().updateSettings(payload);
      set({ settings, saving: false });
      return settings;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async importFolder() {
    get().ensureImportProgressListener();
    set({ importing: true, error: null });

    try {
      const bridge = getBridge();
      const result = await bridge.importFolder();
      if (result?.canceled) {
        set({ importing: false, importProgress: null });
      } else if (typeof bridge.onImportProgress !== 'function') {
        await get().refreshSearch();
        set({ importing: false, importProgress: null });
      }
      return result;
    } catch (error) {
      set({ importing: false, importProgress: null, error: getErrorMessage(error) });
      throw error;
    }
  },

  async importFile() {
    get().ensureImportProgressListener();
    set({ importing: true, error: null });

    try {
      const bridge = getBridge();
      const result = await bridge.importFile();
      if (result?.canceled) {
        set({ importing: false, importProgress: null });
      } else if (typeof bridge.onImportProgress !== 'function') {
        await get().refreshSearch();
        set({ importing: false, importProgress: null });
      }
      return result;
    } catch (error) {
      set({ importing: false, importProgress: null, error: getErrorMessage(error) });
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
      const detail = await getBridge().getImageDetail(imageId);
      set({ detail, detailLoading: false });
    } catch (error) {
      set({ detailLoading: false, error: getErrorMessage(error) });
    }
  },

  async saveMetadata(imageId, { caption, tags }) {
    if (!imageId) {
      return;
    }

    set({ saving: true, error: null });
    try {
      const bridge = getBridge();
      await bridge.updateImageCaption(imageId, caption);
      await bridge.updateImageTags(imageId, tags);
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
    if (!imageId) {
      return;
    }

    set({ saving: true, error: null });
    try {
      await getBridge().rebuildImageAnalysis(imageId);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
    }
  },

  async deleteSelected() {
    const imageId = get().selectedImageId;
    if (!imageId) {
      return;
    }

    set({ saving: true, error: null });
    try {
      await getBridge().deleteImage(imageId);
      set({ selectedImageId: null, detail: null });
      await get().refreshSearch();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
    }
  },
}));
