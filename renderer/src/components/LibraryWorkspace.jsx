import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Sparkles, ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { GalleryCard } from './GalleryCard.jsx';

export function LibraryWorkspace({
  mediaList,
  selectedId,
  onSelectMedia,
  onDragStart,
  onDragEnd,
  onSearch,
  searchQuery,
  isAnalyzing,
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [columns, setColumns] = useState(3);
  const containerRef = useRef(null);

  // 响应式列数计算
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(2);
      else if (width < 1024) setColumns(3);
      else if (width < 1440) setColumns(4);
      else if (width < 1920) setColumns(5);
      else setColumns(6);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearch?.(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, onSearch]);

  // 瀑布流布局 - 按列分组
  const columnData = useMemo(() => {
    const cols = Array.from({ length: columns }, () => []);
    const colHeights = new Array(columns).fill(0);

    mediaList.forEach((media) => {
      // 找到最短的列
      const shortestCol = colHeights.indexOf(Math.min(...colHeights));
      cols[shortestCol].push(media);
      // 估算高度（基于宽高比）
      const aspectRatio = media.metadata?.width && media.metadata?.height
        ? media.metadata.height / media.metadata.width
        : 1;
      colHeights[shortestCol] += aspectRatio * 100 + 80; // 80px 为信息区估算高度
    });

    return cols;
  }, [mediaList, columns]);

  // 处理拖拽开始
  const handleDragStart = useCallback((e, media) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/uri-list', `file://${media.filePath}`);
    e.dataTransfer.setData('text/plain', media.filePath);

    // 设置拖拽图像
    if (media.thumbnailPath) {
      const img = new Image();
      img.src = media.thumbnailPath;
      e.dataTransfer.setDragImage(img, 50, 50);
    }

    onDragStart?.(e, media);
  }, [onDragStart]);

  return (
    <div className="flex h-full flex-col bg-[#f8faf6]">
      {/* 语义搜索栏 - 核心卖点 */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-[#f8faf6]/95 backdrop-blur-sm border-b border-clay/10">
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Sparkles className="h-5 w-5 text-moss/60" />
          </div>
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="描述你想要的图片，例如：暖色调的日落海边照片..."
            className={cn(
              'w-full h-12 pl-12 pr-4',
              'rounded-full border border-clay/20 bg-white',
              'text-[14px] text-ink placeholder:text-ink/30',
              'focus:outline-none focus:ring-2 focus:ring-moss/20 focus:border-moss/30',
              'transition-all duration-200'
            )}
          />
          {localQuery && (
            <button
              onClick={() => setLocalQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-clay/20 text-ink/40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {!localQuery && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="text-[11px] text-ink/30 hidden sm:inline">语义搜索</span>
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-moss/10">
                <Search className="h-3 w-3 text-moss" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 素材网格 - Pinterest 瀑布流 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {mediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="h-16 w-16 rounded-2xl bg-clay/10 flex items-center justify-center mb-4">
                <ImageIcon className="h-8 w-8 text-ink/20" />
              </div>
              <p className="text-[14px] text-ink/50 mb-1">
                {searchQuery ? '没有找到匹配的素材' : '暂无素材'}
              </p>
              <p className="text-[12px] text-ink/30">
                {searchQuery ? '尝试其他关键词' : '点击左侧导入按钮添加图片'}
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              {columnData.map((column, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                  {column.map((media) => (
                    <GalleryCard
                      key={media.id}
                      media={media}
                      selected={selectedId === media.id}
                      onClick={onSelectMedia}
                      onDragStart={handleDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部分析状态 */}
      {isAnalyzing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-moss/90 text-white shadow-lg">
            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <span className="text-[12px]">AI 正在分析图片...</span>
          </div>
        </div>
      )}
    </div>
  );
}
