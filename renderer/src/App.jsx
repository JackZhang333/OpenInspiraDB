import React, { useEffect, useMemo, useState } from 'react';
import { X, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils.js';
import { useAppStore } from './store/useAppStore.js';
import { AppSidebar, TagSettingsDialog } from './components/AppSidebar.jsx';
import { LibraryWorkspace } from './components/LibraryWorkspace.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';

export default function App() {
  const { t } = useTranslation();
  const {
    query,
    selectedTagIds,
    selectedTags,
    result,
    availableTags,
    expandedParentTagIds,
    tagFilterMode,
    selectedImageId,
    detail,
    importing,
    importProgress,
    detailLoading,
    saving,
    reanalyzing,
    error,
    toast,
    copiedImageId,
    loading,
    page,
    pageSize,
    setQuery,
    runSearch,
    refreshSearch,
    loadMore,
    toggleTagSelection,
    clearTags,
    toggleParentExpanded,
    setFilterMode,
    importFolder,
    importFile,
    selectImage,
    saveMetadata,
    createTag,
    updateTag,
    deleteTag,
    getTagOrganizationStatus,
    previewTagOrganization,
    applyTagOrganizationPlan,
    exportImage,
    exportCurrentResultBatch,
    copyImage,
    rebuildAnalysis,
    deleteSelected,
    clearToast,
    init,
  } = useAppStore();

  const [queryDraft, setQueryDraft] = useState(query);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);

  // 网络状态检测
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

  useEffect(() => {
    // 通过 preload 暴露的方法检测网络状态
    const checkNetwork = () => {
      const online = window.inspira?.getNetworkStatus?.() ?? navigator.onLine;
      setIsOnline(online);
      setShowOfflineAlert(!online);
    };

    // 初始化检测
    checkNetwork();

    // 监听网络变化
    const unsubscribe = window.inspira?.onNetworkChange?.((online) => {
      setIsOnline(online);
      setShowOfflineAlert(!online);
    });

    // 降级方案：直接使用 window 事件
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineAlert(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  const detailDrawerOpen = Boolean(selectedImageId);
  const shellGridClass = useMemo(() => (
    sidebarCollapsed ? 'grid-cols-[72px_minmax(0,1fr)]' : 'grid-cols-[320px_minmax(0,1fr)]'
  ), [sidebarCollapsed]);
  const toastClasses = useMemo(() => {
    if (toast?.type === 'warning') {
      return {
        container: 'border-amber-200 bg-white/95 text-amber-800',
        button: 'text-amber-500/70 hover:bg-amber-50 hover:text-amber-700',
      };
    }

    if (toast?.type === 'error') {
      return {
        container: 'border-rose-200 bg-white/95 text-rose-700',
        button: 'text-rose-500/70 hover:bg-rose-50 hover:text-rose-700',
      };
    }

    return {
      container: 'border-emerald-200 bg-white/95 text-emerald-700',
      button: 'text-emerald-500/70 hover:bg-emerald-50 hover:text-emerald-700',
    };
  }, [toast?.type]);

  const handleSubmitSearch = (overrideQuery) => {
    const finalQuery = overrideQuery !== undefined ? overrideQuery : queryDraft;
    setQuery(finalQuery);
    runSearch();
  };

  const handleLoadMore = () => {
    if (!loading) {
      loadMore();
    }
  };

  const hasMore = result.items.length < result.total;

  return (
    <main className="h-screen overflow-hidden bg-transparent">
      {/* 窗口拖动区域 - macOS 标题栏高度 28px，默认透明，hover时显示 */}
      <div
        className="fixed left-0 right-0 top-0 z-50 h-7 w-full bg-black/0 transition-colors duration-200 hover:bg-black/5"
        style={{ WebkitAppRegion: 'drag' }}
      />
      <div className={cn('relative grid h-full w-full gap-0 overflow-hidden pt-7 transition-[grid-template-columns] duration-300', shellGridClass)}>
        {toast ? (
          <div className="pointer-events-none absolute left-1/2 top-12 z-40 -translate-x-1/2">
            <div className={cn('pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur', toastClasses.container)}>
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={clearToast}
                className={cn('rounded-full p-1 transition-colors', toastClasses.button)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0">
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
            importing={importing}
            importProgress={importProgress}
            saving={saving}
            onImportFolder={importFolder}
            onImportFile={importFile}
            onExportBatch={exportCurrentResultBatch}
            availableTags={availableTags}
            expandedParentTagIds={expandedParentTagIds}
            selectedTagIds={selectedTagIds}
            selectedTags={selectedTags}
            filterMode={tagFilterMode}
            onToggleParent={toggleParentExpanded}
            onToggleTag={toggleTagSelection}
            onClearTags={clearTags}
            onFilterModeChange={setFilterMode}
            onOpenTagSettings={() => setTagSettingsOpen(true)}
          />
        </div>

        <section className="flex min-h-0 flex-col overflow-hidden border-l border-[#d7dfd3] bg-[#f6f8f2]">
          {error ? (
            <div className="border-b border-rose-200 bg-rose-50/90 px-5 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {showOfflineAlert ? (
            <div className="border-b border-amber-200 bg-amber-50/90 px-5 py-3">
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1 text-sm text-amber-800">
                  <p className="font-medium">当前处于离线状态</p>
                  <p className="mt-1 text-amber-700/80">
                    普通搜索和标签筛选可正常使用，语义搜索和智能解析图片功能暂不可用。请连接网络后刷新页面。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOfflineAlert(false)}
                  className="shrink-0 rounded p-1 text-amber-600/60 transition-colors hover:bg-amber-100 hover:text-amber-700"
                  aria-label="关闭提示"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">
            <LibraryWorkspace
              queryDraft={queryDraft}
              onQueryDraftChange={setQueryDraft}
              onSubmitSearch={handleSubmitSearch}
              onRefresh={refreshSearch}
              selectedTags={selectedTags}
              filterMode={tagFilterMode}
              onToggleTag={toggleTagSelection}
              onClearTags={clearTags}
              result={result}
              selectedImageId={selectedImageId}
              onSelectImage={selectImage}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              page={page}
              detailDrawerOpen={detailDrawerOpen}
            />
          </div>
        </section>

        <aside className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-transparent">
          <div
            className={cn(
              'pointer-events-auto absolute inset-0 bg-ink/40 transition-opacity duration-500 ease-in-out',
              detailDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={() => selectImage(null)}
          />

          <div
            className={cn(
              'pointer-events-auto absolute inset-y-0 right-0 h-full w-[min(460px,calc(100vw-24px))] border-l border-clay/10 bg-off-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] md:w-[460px]',
              detailDrawerOpen ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex h-full min-h-0 flex-col border-0 bg-transparent shadow-none">
              <div className="flex items-center justify-between border-b border-clay/10 bg-white/50 px-6 py-5 backdrop-blur-sm">
                <div className="space-y-1">
                  <h2 className="text-[22px] font-bold tracking-tight text-ink">{t('app.detail')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => selectImage(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-clay/10 bg-white text-ink/40 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-500 hover:ring-2 hover:ring-rose-200"
                  aria-label={t('app.closeDetail')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <DetailPanel
                  detail={detail}
                  loading={detailLoading}
                  saving={saving || importing}
                  reanalyzing={reanalyzing}
                  copiedImageId={copiedImageId}
                  tagTree={availableTags}
                  onSaveMetadata={saveMetadata}
                  onCreateTag={createTag}
                  onCopy={copyImage}
                  onExport={exportImage}
                  onReanalyze={rebuildAnalysis}
                  onDelete={deleteSelected}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <TagSettingsDialog
        open={tagSettingsOpen}
        saving={saving}
        tagTree={availableTags}
        onClose={() => setTagSettingsOpen(false)}
        onCreateTag={createTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
        onGetOrganizationStatus={getTagOrganizationStatus}
        onPreviewOrganization={previewTagOrganization}
        onApplyOrganizationPlan={applyTagOrganizationPlan}
      />
    </main>
  );
}
