import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCcw, Search, Sparkles, X } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { GalleryCard, GalleryCardSkeleton } from './GalleryCard.jsx';

export function LibraryWorkspace({
  queryDraft,
  onQueryDraftChange,
  onSubmitSearch,
  onRefresh,
  selectedTags,
  filterMode,
  onToggleTag,
  onClearTags,
  result,
  selectedImageId,
  onSelectImage,
  loading = false,
  hasMore = false,
  onLoadMore,
}) {
  const { t } = useTranslation();
  const hasTagFilter = Boolean(selectedTags?.length);
  const [columnCount, setColumnCount] = useState(5);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [dismissedCardId, setDismissedCardId] = useState(null);
  const loadMoreRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && onLoadMore) {
          onLoadMore();
        }
      },
      { root: scrollContainerRef.current, threshold: 0.01, rootMargin: '100px' },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    const updateCount = () => {
      const width = window.innerWidth;
      if (width >= 2560) setColumnCount(7);
      else if (width >= 1920) setColumnCount(6);
      else if (width >= 1536) setColumnCount(5);
      else if (width >= 1280) setColumnCount(4);
      else if (width >= 1024) setColumnCount(3);
      else if (width >= 768) setColumnCount(2);
      else setColumnCount(1);
    };

    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setHoveredCardId(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const resultIds = new Set((result.items || []).map((item) => item.id));

    if (hoveredCardId && !resultIds.has(hoveredCardId)) {
      setHoveredCardId(null);
    }

    if (dismissedCardId && !resultIds.has(dismissedCardId)) {
      setDismissedCardId(null);
    }
  }, [dismissedCardId, hoveredCardId, result.items]);

  const handlePointerEnterCard = useCallback((cardId) => {
    setHoveredCardId(cardId);
  }, []);

  const handlePointerLeaveCard = useCallback((cardId) => {
    setHoveredCardId((currentId) => (currentId === cardId ? null : currentId));
    setDismissedCardId((currentId) => (currentId === cardId ? null : currentId));
  }, []);

  const columns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    (result.items || []).forEach((item, index) => {
      cols[index % columnCount].push(item);
    });
    return cols;
  }, [result.items, columnCount]);

  const skeletonColumns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    const skeletonCount = columnCount * 3;
    Array.from({ length: skeletonCount }).forEach((_, index) => {
      cols[index % columnCount].push(index);
    });
    return cols;
  }, [columnCount]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f9faf7]">
      <div className="flex-none border-b border-clay/10 bg-white/50 px-6 py-5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-moss">
              <Sparkles className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={queryDraft}
              onChange={(event) => onQueryDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSubmitSearch();
                }
              }}
              className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-4 text-[15px] text-ink shadow-sm ring-1 ring-clay/20 placeholder:text-ink/30 focus:ring-2 focus:ring-moss/30"
              placeholder={t('workspace.searchPlaceholder')}
            />
            {queryDraft ? (
              <button
                onClick={() => onQueryDraftChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink/30 transition hover:bg-clay/10 hover:text-ink/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <button
            onClick={onRefresh}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-ink/40 shadow-sm ring-1 ring-clay/20 transition hover:bg-white hover:text-ink/60"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        {!queryDraft && !hasTagFilter ? (
          <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 text-[11px] text-ink/60">
            <span>{t('workspace.try')}</span>
            <button
              onClick={() => onQueryDraftChange(t('workspace.suggestion1'))}
              className="rounded-full bg-white/90 px-2.5 py-0.5 text-ink/70 transition hover:bg-white hover:text-ink/90"
            >
              {t('workspace.suggestion1')}
            </button>
            <button
              onClick={() => onQueryDraftChange(t('workspace.suggestion2'))}
              className="rounded-full bg-white/90 px-2.5 py-0.5 text-ink/70 transition hover:bg-white hover:text-ink/90"
            >
              {t('workspace.suggestion2')}
            </button>
            <button
              onClick={() => onQueryDraftChange(t('workspace.suggestion3'))}
              className="rounded-full bg-white/90 px-2.5 py-0.5 text-ink/70 transition hover:bg-white hover:text-ink/90"
            >
              {t('workspace.suggestion3')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        {selectedTags?.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-clay/15 text-ink/70">
              {filterMode === 'or' ? t('sidebar.filterMode.or') : t('sidebar.filterMode.and')}
            </Badge>
            {selectedTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag?.(tag.id)}
                className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-3 py-1 text-xs font-medium text-moss transition hover:bg-moss/20"
              >
                <span>{tag.name}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={onClearTags}
              className="text-xs text-ink/40 transition hover:text-ink/70"
            >
              {t('sidebar.clearAll')}
            </button>
          </div>
        ) : null}

        {loading && result.items.length === 0 && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-start gap-3">
              {skeletonColumns.map((columnItems, colIndex) => (
                <div key={colIndex} className="flex flex-1 flex-col gap-3">
                  {columnItems.map((index) => (
                    <GalleryCardSkeleton key={index} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && result.items.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-clay/10">
                <Search className="h-6 w-6 text-ink/20" />
              </div>
              <p className="text-sm text-ink/40">{t('workspace.noResults')}</p>
              <p className="mt-1 text-xs text-ink/30">{t('workspace.trySemanticSearch')}</p>
            </div>
          </div>
        )}

        {result.items.length > 0 && (
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
            style={{ contain: 'strict' }}
          >
            <div className="flex items-start gap-3">
              {columns.map((columnItems, colIndex) => (
                <div key={colIndex} className="flex flex-1 flex-col gap-3">
                  {columnItems.map((item) => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      active={item.id === selectedImageId}
                      onClick={() => onSelectImage(item.id)}
                      onPointerEnterCard={handlePointerEnterCard}
                      onPointerLeaveCard={handlePointerLeaveCard}
                    />
                  ))}
                </div>
              ))}
            </div>

            {hasMore && (
              <div ref={loadMoreRef} className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2 text-sm text-ink/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('workspace.loadMore')}</span>
                </div>
              </div>
            )}

            {loading && hasMore && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-ink/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('workspace.loading')}</span>
                </div>
              </div>
            )}

            {!hasMore && result.items.length > 0 && (
              <div className="flex items-center justify-center py-6 text-xs text-ink/30">
                {t('workspace.allLoaded', { total: result.total })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
