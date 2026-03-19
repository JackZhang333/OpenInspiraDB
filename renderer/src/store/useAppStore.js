import { create } from 'zustand';

const ERROR_MESSAGES = {
  EMPTY_CAPTION: '描述不能为空',
  EMPTY_TAG_NAME: '标签名称不能为空',
  IMAGE_NOT_FOUND: '图片不存在，可能已被删除',
  TAG_NOT_FOUND: '标签不存在或已被删除',
  TAG_LEVEL_INVALID: '只能选择二级标签',
  TAG_ALREADY_EXISTS: '标签名称已存在',
  PARENT_TAG_NOT_FOUND: '父标签不存在',
  SYSTEM_TAG_LOCKED: '系统标签不可修改',
  TAG_HAS_CHILDREN: '请先删除或移动该一级标签下的二级标签',
  TAG_IN_USE: '该标签仍被图片使用，暂时不能删除',
  TARGET_TAG_NOT_FOUND: '目标标签不存在，整理方案已过期，请重新生成',
  EMPTY_EXPORT_SELECTION: '当前列表没有可导出的图片',
  EXPORT_PATH_REQUIRED: '导出路径不能为空',
  COPY_IMAGE_FAILED: '当前图片暂时无法复制，请改用导出后再粘贴',
  IMAGE_FILE_MISSING: '图片原文件不存在，可能已被移动或删除',
  IMAGE_LIMIT_REACHED: '已达到产品性能极限 5 万张，有扩容需求请联系开发者',
  DESKTOP_BRIDGE_OUTDATED: '客户端桥接未更新，请重启应用后再试',
  DESKTOP_BRIDGE_UNAVAILABLE: '桌面桥接未就绪，请重启应用后再试',
  ZHIPU_API_KEY_MISSING: '请先在 src/model-config.js 或 ZHIPU_API_KEY 环境变量中配置智谱 API Key',
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

function getInspiraMethod(methodName, channelName = '', mapArgsToPayload = (...args) => args[0]) {
  const bridge = window?.inspira;
  if (bridge && typeof bridge[methodName] === 'function') {
    return (...args) => bridge[methodName](...args);
  }

  if (bridge && typeof bridge.invoke === 'function' && channelName) {
    return (...args) => bridge.invoke(channelName, mapArgsToPayload(...args));
  }

  const error = new Error('DESKTOP_BRIDGE_OUTDATED');
  error.code = 'DESKTOP_BRIDGE_OUTDATED';
  throw error;
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

function normalizeMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'or' ? 'or' : 'and';
}

function flattenChildTags(tagTree = []) {
  return tagTree.flatMap((group) => group.children || []);
}

function deriveSelectedTags(tagTree, selectedTagIds) {
  const selectedSet = new Set((selectedTagIds || []).map((id) => Number(id)));
  return flattenChildTags(tagTree).filter((tag) => selectedSet.has(Number(tag.id)));
}

function deriveExpandedParents(tagTree, currentExpandedIds = [], selectedTagIds = []) {
  const next = new Set((currentExpandedIds || []).map((id) => Number(id)));
  const selectedSet = new Set((selectedTagIds || []).map((id) => Number(id)));

  for (const group of tagTree || []) {
    if ((group.children || []).some((tag) => selectedSet.has(Number(tag.id)))) {
      next.add(Number(group.id));
    }
  }

  if (!next.size) {
    for (const group of (tagTree || []).slice(0, 4)) {
      next.add(Number(group.id));
    }
  }

  return Array.from(next);
}

let importProgressUnsubscribe = null;
let importAutoRefreshInFlight = false;
let copyFeedbackTimeout = null;

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
    queuedCount: Number(payload.queuedCount || 0),
    analyzingCount: Number(payload.analyzingCount || 0),
    message: String(payload.message || ''),
  };
}

export const useAppStore = create((set, get) => ({
  query: '',
  selectedTagIds: [],
  selectedTags: [],
  expandedParentTagIds: [],
  tagFilterMode: 'and',
  page: 1,
  pageSize: 50,
  result: { total: 0, items: [] },
  availableTags: [],
  selectedImageId: null,
  detail: null,
  loading: false,
  importing: false,
  importProgress: null,
  detailLoading: false,
  saving: false,
  reanalyzing: false,
  error: null,
  copiedImageId: null,

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
      const isActive = progress.phase === 'started'
        || progress.phase === 'processing'
        || progress.phase === 'importing'
        || progress.phase === 'analyzing';

      set({
        importProgress: progress,
        importing: isActive,
      });

      if (progress.phase === 'completed' && !importAutoRefreshInFlight) {
        importAutoRefreshInFlight = true;
        get().refreshSearch().finally(() => {
          importAutoRefreshInFlight = false;
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

  async toggleTagSelection(tagId) {
    const normalizedTagId = Number(tagId);
    const selectedTagIds = get().selectedTagIds || [];
    const nextTagIds = selectedTagIds.includes(normalizedTagId)
      ? selectedTagIds.filter((id) => id !== normalizedTagId)
      : [...selectedTagIds, normalizedTagId];

    set({ selectedTagIds: nextTagIds, page: 1 });
    return get().refreshSearch();
  },

  async clearTags() {
    set({ selectedTagIds: [], selectedTags: [], page: 1 });
    return get().refreshSearch();
  },

  toggleParentExpanded(parentTagId) {
    const normalizedParentId = Number(parentTagId);
    set((state) => ({
      expandedParentTagIds: state.expandedParentTagIds.includes(normalizedParentId)
        ? state.expandedParentTagIds.filter((id) => id !== normalizedParentId)
        : [...state.expandedParentTagIds, normalizedParentId],
    }));
  },

  async setFilterMode(mode) {
    const nextMode = normalizeMode(mode);
    set({ tagFilterMode: nextMode, page: 1 });

    try {
      await getBridge().setTagFilterMode(nextMode);
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }

    return get().refreshSearch();
  },

  async loadMore() {
    const { loading, page } = get();
    if (loading) return;
    set({ page: page + 1 });
    return get().refreshSearch();
  },

  async refreshSearch() {
    const {
      query,
      selectedTagIds,
      tagFilterMode,
      page,
      pageSize,
      selectedImageId,
      expandedParentTagIds,
    } = get();
    set({ loading: true, error: null });

    try {
      const bridge = getBridge();
      const [result, availableTags] = await Promise.all([
        bridge.search({ query, selectedTagIds, filterMode: tagFilterMode, page, pageSize }),
        bridge.getFilterTags({ query, selectedTagIds, filterMode: tagFilterMode }),
      ]);

      const currentItems = page === 1 ? [] : get().result.items;
      const selectedTags = deriveSelectedTags(availableTags, selectedTagIds);
      const normalizedSelectedTagIds = selectedTags.map((tag) => Number(tag.id));
      const nextExpandedParentTagIds = deriveExpandedParents(availableTags, expandedParentTagIds, selectedTagIds);

      set({
        result: {
          ...result,
          items: [...currentItems, ...result.items],
        },
        availableTags,
        selectedTagIds: normalizedSelectedTagIds,
        selectedTags,
        expandedParentTagIds: nextExpandedParentTagIds,
        loading: false,
      });

      if (selectedImageId) {
        const stillExists = result.items.some((item) => item.id === selectedImageId)
          || currentItems.some((item) => item.id === selectedImageId);
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

    try {
      const mode = await getBridge().getTagFilterMode();
      set({ tagFilterMode: normalizeMode(mode) });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }

    await get().refreshSearch();
  },

  async importFolder() {
    get().ensureImportProgressListener();
    set({ importing: true, error: null });

    try {
      const bridge = getBridge();
      const hasProgressBridge = typeof bridge.onImportProgress === 'function';
      const result = await bridge.importFolder();
      if (result?.canceled || !hasProgressBridge) {
        set({ importing: false, importProgress: null });
      }
      if (!result?.canceled && !hasProgressBridge) {
        await get().refreshSearch();
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
      const hasProgressBridge = typeof bridge.onImportProgress === 'function';
      const result = await bridge.importFile();
      if (result?.canceled || !hasProgressBridge) {
        set({ importing: false, importProgress: null });
      }
      if (!result?.canceled && !hasProgressBridge) {
        await get().refreshSearch();
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

  async saveMetadata(imageId, { caption, tagIds }) {
    if (!imageId) {
      return;
    }

    set({ saving: true, error: null });
    try {
      const bridge = getBridge();
      await bridge.updateImageCaption(imageId, caption);
      await bridge.updateImageTags(imageId, tagIds);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async createTag(payload) {
    set({ saving: true, error: null });
    try {
      const tag = await getBridge().createTag(payload);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
      return tag;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async updateTag(payload) {
    set({ saving: true, error: null });
    try {
      const tag = await getBridge().updateTag(payload);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
      return tag;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async deleteTag(tagId) {
    set({ saving: true, error: null });
    try {
      const result = await getBridge().deleteTag(tagId);
      set((state) => ({
        selectedTagIds: state.selectedTagIds.filter((id) => id !== Number(tagId)),
      }));
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
      return result;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async getTagOrganizationStatus() {
    try {
      return await getBridge().getTagOrganizationStatus();
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  async previewTagOrganization() {
    try {
      return await getBridge().previewTagOrganization();
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  async applyTagOrganizationPlan(payload) {
    set({ saving: true, error: null });
    try {
      const result = await getBridge().applyTagOrganizationPlan(payload);
      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({ saving: false });
      return result;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async exportImage(imageId) {
    if (!imageId) {
      return { canceled: true };
    }

    set({ saving: true, error: null });
    try {
      const callExportImage = getInspiraMethod('exportImage', 'inspiradb:export-image');
      const result = await callExportImage(imageId);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async exportCurrentResultBatch() {
    const imageIds = (get().result?.items || []).map((item) => item.id).filter(Boolean);
    if (!imageIds.length) {
      set({ error: ERROR_MESSAGES.EMPTY_EXPORT_SELECTION });
      return { canceled: true, reason: 'EMPTY_EXPORT_SELECTION' };
    }

    set({ saving: true, error: null });
    try {
      const callExportImages = getInspiraMethod(
        'exportImages',
        'inspiradb:export-images',
        (ids) => ({ imageIds: ids }),
      );
      const result = await callExportImages(imageIds);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  async copyImage(imageId) {
    if (!imageId) {
      return { copied: false };
    }

    if (copyFeedbackTimeout) {
      clearTimeout(copyFeedbackTimeout);
      copyFeedbackTimeout = null;
    }

    set({ saving: true, error: null });
    try {
      const callCopyImage = getInspiraMethod('copyImage', 'inspiradb:copy-image');
      const result = await callCopyImage(imageId);
      set({ saving: false, copiedImageId: imageId });
      copyFeedbackTimeout = setTimeout(() => {
        copyFeedbackTimeout = null;
        if (get().copiedImageId === imageId) {
          set({ copiedImageId: null });
        }
      }, 1800);
      return result;
    } catch (error) {
      set({ saving: false, copiedImageId: null, error: getErrorMessage(error) });
      throw error;
    }
  },

  async rebuildAnalysis() {
    const imageId = get().selectedImageId;
    if (!imageId) {
      return;
    }

    set({ reanalyzing: true, error: null });
    try {
      const result = await getBridge().rebuildImageAnalysis(imageId);

      if (result?.status === 'ready') {
        set({ selectedImageId: null, detail: null });
        await get().refreshSearch();
        set({ reanalyzing: false });
        return result;
      }

      await get().refreshSearch();
      await get().reloadSelectedDetail();
      set({
        reanalyzing: false,
        error: result?.status === 'failed' ? '重新分析失败，请稍后重试' : null,
      });
      return result;
    } catch (error) {
      set({ reanalyzing: false, error: getErrorMessage(error) });
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
