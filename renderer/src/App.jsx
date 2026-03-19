import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from './lib/utils.js';
import { useAppStore } from './store/useAppStore.js';
import { AppSidebar, TagSettingsDialog } from './components/AppSidebar.jsx';
import { LibraryWorkspace } from './components/LibraryWorkspace.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';

export default function App() {
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
    init,
  } = useAppStore();

  const [queryDraft, setQueryDraft] = useState(query);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);

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

  const handleSubmitSearch = () => {
    setQuery(queryDraft);
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
      <div className={cn('relative grid h-full w-full gap-0 overflow-hidden transition-[grid-template-columns] duration-300', shellGridClass)}>
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
                  <h2 className="text-[22px] font-bold tracking-tight text-ink">详情</h2>
                </div>
                <button
                  type="button"
                  onClick={() => selectImage(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-clay/10 bg-white text-ink/40 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-500 hover:ring-2 hover:ring-rose-200"
                  aria-label="关闭详情"
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
