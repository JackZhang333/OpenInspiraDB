import { create } from 'zustand';
import i18n from '../i18n/config.js';

const getErrorMessageKey = (code) => {
  const keyMap = {
    EMPTY_CAPTION: 'errors.emptyCaption',
    EMPTY_TAG_NAME: 'errors.emptyTagName',
    IMAGE_NOT_FOUND: 'errors.imageNotFound',
    TAG_NOT_FOUND: 'errors.tagNotFound',
    TAG_LEVEL_INVALID: 'errors.tagLevelInvalid',
    TAG_ALREADY_EXISTS: 'errors.tagAlreadyExists',
    PARENT_TAG_NOT_FOUND: 'errors.parentTagNotFound',
    SYSTEM_TAG_LOCKED: 'errors.systemTagLocked',
    TAG_HAS_CHILDREN: 'errors.tagHasChildren',
    TAG_IN_USE: 'errors.tagInUse',
    TARGET_TAG_NOT_FOUND: 'errors.targetTagNotFound',
    EMPTY_EXPORT_SELECTION: 'errors.emptyExportSelection',
    EXPORT_PATH_REQUIRED: 'errors.exportPathRequired',
    COPY_IMAGE_FAILED: 'errors.copyImageFailed',
    IMAGE_FILE_MISSING: 'errors.imageFileMissing',
    IMAGE_LIMIT_REACHED: 'errors.imageLimitReached',
    DESKTOP_BRIDGE_OUTDATED: 'errors.desktopBridgeOutdated',
    DESKTOP_BRIDGE_UNAVAILABLE: 'errors.desktopBridgeUnavailable',
    ZHIPU_API_KEY_MISSING: 'errors.zhipuApiKeyMissing',
    ZHIPU_API_REQUEST_FAILED: 'errors.zhipuApiRequestFailed',
    ZHIPU_EMBEDDING_EMPTY: 'errors.zhipuEmbeddingEmpty',
  };
  return keyMap[code] || null;
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
  const i18nKey = getErrorMessageKey(errorKey);
  if (i18nKey && i18n.exists(i18nKey)) {
    return i18n.t(i18nKey);
  }

  if (!error) {
    return i18n.t('errors.unknown');
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return i18n.t('errors.requestFailed');
}

function normalizeMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'or' ? 'or' : 'and';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
let toastTimeout = null;

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

function getExportWarningCount(result = {}) {
  const warningCount = Number(result?.warningCount);
  if (Number.isFinite(warningCount) && warningCount >= 0) {
    return warningCount;
  }

  if (Array.isArray(result?.warnings)) {
    return result.warnings.length;
  }

  if (Array.isArray(result?.exported)) {
    return result.exported.reduce(
      (count, item) => count + (Array.isArray(item?.warnings) ? item.warnings.length : 0),
      0,
    );
  }

  return 0;
}

function createSingleImportPendingProgress() {
  return normalizeImportProgress({
    mode: 'single',
    phase: 'started',
    current: 0,
    total: 1,
  });
}

async function waitForImportedImageVisible(get, imageId, options = {}) {
  const maxAttempts = Number(options.maxAttempts || 12);
  const retryDelayMs = Number(options.retryDelayMs || 150);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await get().refreshSearch();
    const hasImportedImage = (get().result?.items || []).some((item) => Number(item.id) === Number(imageId));
    if (hasImportedImage) {
      return true;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(retryDelayMs);
    }
  }

  return false;
}

function resetSingleImportSearchState(set) {
  set({
    query: '',
    selectedTagIds: [],
    selectedTags: [],
    expandedParentTagIds: [],
    page: 1,
  });
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
  toast: null,
  // 协同进化状态
  coEvolutionSession: null,
  coEvolutionLoading: false,
  coEvolutionError: null,
  openClawStatus: { available: false },

  setQuery(query) {
    set({ query });
  },

  showToast(message, type = 'success') {
    if (!message) {
      return;
    }

    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    set({ toast: { message: String(message), type: String(type || 'success') } });
    toastTimeout = setTimeout(() => {
      toastTimeout = null;
      set({ toast: null });
    }, 2400);
  },

  clearToast() {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    set({ toast: null });
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
      const shouldKeepImporting = isActive || (progress.mode === 'single' && progress.phase === 'completed');

      set({
        importProgress: progress,
        importing: shouldKeepImporting,
      });

      if (progress.phase === 'completed' && !importAutoRefreshInFlight) {
        if (progress.mode === 'folder') {
          importAutoRefreshInFlight = true;
          get().refreshSearch().finally(() => {
            importAutoRefreshInFlight = false;
            set({ importing: false, importProgress: null });
          });
        }
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

    try {
      const bridge = getBridge();
      const hasProgressBridge = typeof bridge.onImportProgress === 'function';
      set({
        importing: true,
        error: null,
        importProgress: hasProgressBridge ? createSingleImportPendingProgress() : null,
      });
      const result = await bridge.importFile();
      if (result?.canceled || !hasProgressBridge) {
        set({ importing: false, importProgress: null });
      }
      if (!result?.canceled) {
        const importedImageId = Number(result?.image?.id || 0) || null;
        resetSingleImportSearchState(set);
        if (importedImageId) {
          const visible = await waitForImportedImageVisible(get, importedImageId);
          if (!visible) {
            get().showToast(i18n.t('feedback.importImagePendingVisibility'), 'warning');
          }
        } else {
          await get().refreshSearch();
        }
      }
      if (!result?.canceled) {
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

  async createTag(payload, options = {}) {
    const shouldRefresh = options.refresh !== false;
    set({ saving: true, error: null });
    try {
      const tag = await getBridge().createTag(payload);
      if (shouldRefresh) {
        await get().refreshSearch();
        await get().reloadSelectedDetail();
      }
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
      if (!result?.canceled && result?.filePath) {
        const warningCount = getExportWarningCount(result);
        get().showToast(
          i18n.t(warningCount > 0 ? 'feedback.exportImageSuccessWithWarning' : 'feedback.exportImageSuccess'),
          warningCount > 0 ? 'warning' : 'success',
        );
      }
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
      const exportedCount = Number(result?.exportedCount || 0);
      const failedCount = Number(result?.failedCount || 0);
      const warningCount = getExportWarningCount(result);
      if (!result?.canceled && (exportedCount > 0 || failedCount > 0 || warningCount > 0)) {
        const hasIssues = failedCount > 0 || warningCount > 0;
        get().showToast(
          hasIssues
            ? i18n.t('feedback.exportBatchSummary', { exportedCount, failedCount, warningCount })
            : i18n.t('feedback.exportBatchSuccess', { count: exportedCount }),
          hasIssues ? 'warning' : 'success',
        );
      }
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
        error: result?.status === 'failed' ? i18n.t('errors.reanalyzeFailed') : null,
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
      get().showToast(i18n.t('feedback.deleteImageSuccess'), 'success');
    } catch (error) {
      set({ saving: false, error: getErrorMessage(error) });
    }
  },

  // ==================== 标签协同进化 (OpenClaw) ====================

  async checkOpenClawStatus() {
    try {
      const status = await getBridge().checkOpenClawStatus();
      set({ openClawStatus: status });
      return status;
    } catch (error) {
      set({ openClawStatus: { available: false, error: error.message } });
      return { available: false };
    }
  },

  async startCoEvolution() {
    set({ coEvolutionLoading: true, coEvolutionError: null });
    try {
      // 先检查 OpenClaw 状态
      const status = await get().checkOpenClawStatus();
      if (!status.available) {
        const error = new Error('OpenClaw 服务不可用，请确保 OpenClaw 已启动');
        error.code = 'OPENCLAW_UNAVAILABLE';
        throw error;
      }

      const result = await getBridge().startCoEvolution();
      set({
        coEvolutionSession: {
          id: result.sessionId,
          openClawSessionId: result.openClawSessionId,
          status: result.status,
          suggestions: result.suggestions || [],
          operations: result.operations || [],
          stats: result.stats,
          selectedIds: [],
        },
        coEvolutionLoading: false,
      });
      return result;
    } catch (error) {
      set({
        coEvolutionLoading: false,
        coEvolutionError: getErrorMessage(error),
      });
      throw error;
    }
  },

  setCoEvolutionSelectedIds(selectedIds) {
    const session = get().coEvolutionSession;
    if (!session) return;
    set({
      coEvolutionSession: { ...session, selectedIds },
    });
  },

  toggleCoEvolutionSuggestion(suggestionId) {
    const session = get().coEvolutionSession;
    if (!session) return;
    const selectedIds = new Set(session.selectedIds || []);
    if (selectedIds.has(suggestionId)) {
      selectedIds.delete(suggestionId);
    } else {
      selectedIds.add(suggestionId);
    }
    set({
      coEvolutionSession: { ...session, selectedIds: Array.from(selectedIds) },
    });
  },

  selectAllCoEvolutionSuggestions() {
    const session = get().coEvolutionSession;
    if (!session || !session.suggestions) return;
    set({
      coEvolutionSession: {
        ...session,
        selectedIds: session.suggestions.map((s) => s.id),
      },
    });
  },

  clearCoEvolutionSelections() {
    const session = get().coEvolutionSession;
    if (!session) return;
    set({
      coEvolutionSession: { ...session, selectedIds: [] },
    });
  },

  async applyCoEvolutionSuggestions(options = {}) {
    const session = get().coEvolutionSession;
    if (!session || !session.selectedIds?.length) {
      return;
    }

    set({ coEvolutionLoading: true, coEvolutionError: null });
    try {
      const result = await getBridge().applyCoEvolutionSuggestions({
        selectedIds: session.selectedIds,
        userRating: options.userRating,
        userComments: options.userComments,
      });

      // 更新会话状态
      set({
        coEvolutionSession: {
          ...session,
          status: 'completed',
          result,
        },
        coEvolutionLoading: false,
      });

      // 刷新标签树和搜索结果
      await get().refreshSearch();
      await get().reloadSelectedDetail();

      get().showToast(
        i18n.t('feedback.coEvolutionApplied', { count: result.appliedCount }),
        'success'
      );

      return result;
    } catch (error) {
      set({
        coEvolutionLoading: false,
        coEvolutionError: getErrorMessage(error),
      });
      throw error;
    }
  },

  async cancelCoEvolution() {
    try {
      await getBridge().cancelCoEvolution();
    } catch (error) {
      // 忽略错误
    }
    set({
      coEvolutionSession: null,
      coEvolutionLoading: false,
      coEvolutionError: null,
    });
  },

  closeCoEvolutionPanel() {
    set({
      coEvolutionSession: null,
      coEvolutionError: null,
    });
  },
}));
