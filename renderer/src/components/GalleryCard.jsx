import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils.js';
import { GripVertical } from 'lucide-react';

export function GalleryCard({
  media,
  selected,
  onClick,
  onDragStart,
  onDragEnd,
  style,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 拖拽开始
  const handleDragStart = useCallback((e) => {
    setIsDragging(true);
    onDragStart?.(e, media);
  }, [media, onDragStart]);

  // 拖拽结束
  const handleDragEnd = useCallback((e) => {
    setIsDragging(false);
    onDragEnd?.(e, media);
  }, [media, onDragEnd]);

  // 计算标签显示 - 尽可能显示在一行
  const renderTags = () => {
    if (!media.tags || media.tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {media.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="truncate max-w-[80px] text-[10px] px-1.5 py-0.5 bg-white/90 text-ink/60 rounded"
          >
            {tag}
          </span>
        ))}
        {media.tags.length > 4 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-white/90 text-ink/40 rounded">
            +{media.tags.length - 4}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'group relative mb-4 break-inside-avoid cursor-pointer',
        isDragging && 'opacity-50'
      )}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // 点击非拖拽区域才触发详情
        if (!e.target.closest('.drag-handle')) {
          onClick?.(media);
        }
      }}
    >
      {/* 图片容器 */}
      <div className="relative overflow-hidden rounded-xl bg-clay/10">
        {/* 图片 */}
        {!imageError ? (
          <img
            src={media.thumbnailPath || media.filePath}
            alt={media.caption || '图片'}
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full aspect-square bg-clay/20 flex items-center justify-center">
            <span className="text-ink/30 text-xs">加载失败</span>
          </div>
        )}

        {/* 拖拽手柄 - 悬停显示 */}
        <div
          className={cn(
            'drag-handle absolute top-2 right-2 z-20',
            'flex items-center justify-center',
            'h-8 w-8 rounded-lg bg-white/95 shadow-sm',
            'transition-all duration-200',
            isHovered || isDragging
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          )}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="拖拽到设计软件"
        >
          <GripVertical className="h-4 w-4 text-ink/60" />
        </div>

        {/* 选中状态覆盖 */}
        {selected && (
          <div className="absolute inset-0 ring-2 ring-moss ring-inset rounded-xl">
            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-moss flex items-center justify-center">
              <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}

        {/* AI 分析状态指示 */}
        {media.status === 'analyzing' && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-xl">
            <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
        {media.status === 'failed' && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-rose-500/90 text-white text-[10px] font-medium">
            分析失败
          </div>
        )}
      </div>

      {/* 信息区 */}
      <div className="mt-2 px-0.5">
        {/* 标题/描述 */}
        {media.caption && (
          <p className="text-[12px] text-ink/70 line-clamp-2 leading-relaxed mb-1">
            {media.caption}
          </p>
        )}

        {/* 标签 */}
        {renderTags()}
      </div>
    </div>
  );
}
