import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCcw, Search, Sparkles, X } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { GalleryCard, GalleryCardSkeleton } from './GalleryCard.jsx';

export function LibraryWorkspace({
  queryDraft,
  onQueryDraftChange,
  onSubmitSearch,
  onRefresh,
  selectedTag,
  onClearTag,
  result,
  selectedImageId,
  onSelectImage,
  loading = false,
  hasMore = false,
  onLoadMore,
}) {
  const hasTagFilter = Boolean(selectedTag);
  const [columnCount, setColumnCount] = useState(5);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [dismissedCardId, setDismissedCardId] = useState(null);
  const [visibleItemIds, setVisibleItemIds] = useState(new Set());
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Intersection Observer for lazy loading card images
  const observeItem = useCallback((element, itemId) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.dataset.itemId;
              if (id) {
                setVisibleItemIds((prev) => new Set(prev).add(id));
              }
            }
          });
        },
        { root: scrollContainerRef.current, rootMargin: '100px' }
      );
    }
    if (element) {
      element.dataset.itemId = itemId;
      observerRef.current.observe(element);
    }
  }, []);

  const unobserveItem = useCallback((element) => {
    if (observerRef.current && element) {
      observerRef.current.unobserve(element);
    }
  }, []);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && onLoadMore) {
          onLoadMore();
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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

  // Reset visible items when result changes significantly
  useEffect(() => {
    setVisibleItemIds(new Set());
  }, [result.items.length === 0]);

  const handlePointerEnterCard = useCallback((cardId) => {
    setHoveredCardId(cardId);
  }, []);

  const handlePointerLeaveCard = useCallback((cardId) => {
    setHoveredCardId((currentId) => (currentId === cardId ? null : currentId));
    setDismissedCardId((currentId) => (currentId === cardId ? null : currentId));
  }, []);

  // Distribute items into columns
  const columns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    (result.items || []).forEach((item, index) => {
      cols[index % columnCount].push(item);
    });
    return cols;
  }, [result.items, columnCount]);

  // Skeleton columns for loading state
  const skeletonColumns = useMemo(() => {
    const cols = Array.from({ length: columnCount }, () => []);
    const skeletonCount = columnCount * 3; // 3 skeletons per column
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
              placeholder="输入描述性关键词，语义搜索..."
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
          <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 text-[11px] text-ink/30">
            <span>试试：</span>
            <button
              onClick={() => onQueryDraftChange('阳光明媚的海滩')}
              className="rounded-full bg-white/80 px-2.5 py-0.5 transition hover:bg-white hover:text-ink/50"
            >
              阳光明媚的海滩
            </button>
            <button
              onClick={() => onQueryDraftChange('科技感产品图')}
              className="rounded-full bg-white/80 px-2.5 py-0.5 transition hover:bg-white hover:text-ink/50"
            >
              科技感产品图
            </button>
            <button
              onClick={() => onQueryDraftChange('温暖的室内')}
              className="rounded-full bg-white/80 px-2.5 py-0.5 transition hover:bg-white hover:text-ink/50"
            >
              温暖的室内
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        {selectedTag ? (
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="bg-moss/10 text-moss">
              {selectedTag}
            </Badge>
            <button
              onClick={onClearTag}
              className="text-xs text-ink/40 transition hover:text-ink/70"
            >
              清除
            </button>
          </div>
        ) : null}

        {/* Loading State - Skeleton */}
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

        {/* Empty State */}
        {!loading && result.items.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-clay/10">
                <Search className="h-6 w-6 text-ink/20" />
              </div>
              <p className="text-sm text-ink/40">暂无结果</p>
              <p className="mt-1 text-xs text-ink/30">尝试语义描述或从左侧选择标签</p>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {result.items.length > 0 && (
          <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto">
            <div className="flex items-start gap-3">
              {columns.map((columnItems, colIndex) => (
                <div key={colIndex} className="flex flex-1 flex-col gap-3">
                  {columnItems.map((item) => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      active={item.id === selectedImageId}
                      visible={visibleItemIds.has(String(item.id))}
                      onObserve={observeItem}
                      onUnobserve={unobserveItem}
                      onClick={() => onSelectImage(item.id)}
                      onPointerEnterCard={handlePointerEnterCard}
                      onPointerLeaveCard={handlePointerLeaveCard}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Load More Sentinel */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-6"
              >
                <div className="flex items-center gap-2 text-sm text-ink/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>加载更多...</span>
                </div>
              </div>
            )}

            {/* Loading More Indicator */}
            {loading && hasMore && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-ink/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>加载中...</span>
                </div>
              </div>
            )}

            {/* End of Results */}
            {!hasMore && result.items.length > 0 && (
              <div className="flex items-center justify-center py-6 text-xs text-ink/30">
                已加载全部 {result.total} 张图片
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
