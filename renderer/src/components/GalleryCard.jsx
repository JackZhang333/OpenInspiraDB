import React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '../lib/utils.js';

const DRAG_AFFORDANCE_HIDE_DELAY_MS = 100;

export function GalleryCard({
  item,
  active,
  onClick,
  dragAffordanceVisible,
  onPointerEnterCard,
  onPointerLeaveCard,
  onDragHandleStart,
  onDragHandleEnd,
}) {
  const captionText = item.activeCaption?.content?.trim();
  const filePath = String(item.library_path || '').trim();
  const canDragToExternal = Boolean(filePath);
  const [showDragAffordance, setShowDragAffordance] = React.useState(false);
  const hideTimerRef = React.useRef(null);

  React.useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!canDragToExternal) {
      setShowDragAffordance(false);
      return undefined;
    }

    if (dragAffordanceVisible) {
      setShowDragAffordance(true);
      return undefined;
    }

    hideTimerRef.current = setTimeout(() => {
      setShowDragAffordance(false);
      hideTimerRef.current = null;
    }, DRAG_AFFORDANCE_HIDE_DELAY_MS);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [canDragToExternal, dragAffordanceVisible]);

  const handleDragStart = (event) => {
    if (!canDragToExternal) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', item.original_file_name || 'image');

    const startDragImage = window?.inspira?.startDragImage;
    if (typeof startDragImage === 'function') {
      startDragImage(filePath, item.thumbnail_path || filePath);
    }
  };

  const handleHandleDragStart = (event) => {
    onDragHandleStart?.(item.id);
    handleDragStart(event);
    if (event.defaultPrevented) {
      onDragHandleEnd?.(item.id);
    }
  };

  const handleHandleDragEnd = () => {
    onDragHandleEnd?.(item.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      onPointerEnter={() => onPointerEnterCard?.(item.id)}
      onPointerLeave={() => onPointerLeaveCard?.(item.id)}
      aria-label={item.original_file_name}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl bg-white transition-all duration-300',
        'shadow-sm hover:shadow-lg',
        active ? 'ring-2 ring-moss shadow-lg' : 'hover:-translate-y-1 hover:scale-[1.02]',
      )}
    >
      <div className="relative w-full overflow-hidden bg-clay/5">
        {item.thumbnail_data_url ? (
          <img
            src={item.thumbnail_data_url}
            alt={item.original_file_name}
            className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-xs text-ink/30">
            无缩略图
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />

        {canDragToExternal ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-md bg-ink/75 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white transition-all duration-200',
                showDragAffordance ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
              )}
            >
              拖拽
            </span>
            <div
              draggable
              onDragStart={handleHandleDragStart}
              onDragEnd={handleHandleDragEnd}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              title="从这里拖到 Figma / Photoshop / Sketch"
              aria-label="拖拽图片到外部设计工具"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink/60 shadow-md ring-1 ring-black/5',
                'cursor-grab transition-all duration-200 active:cursor-grabbing',
                showDragAffordance
                  ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none translate-y-1 scale-95 opacity-0',
                'hover:scale-105 hover:text-moss',
              )}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
        ) : null}
      </div>

      {captionText || item.tags?.length > 0 ? (
        <div className="p-2.5">
          {captionText ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-ink/80 group-hover:text-moss">
              {captionText}
            </p>
          ) : null}

          {item.tags?.length > 0 ? (
            <div className="mt-1.5 flex items-center gap-1 overflow-hidden">
              <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="shrink-0 rounded-full bg-clay/10 px-1.5 py-0.5 text-[9px] text-ink/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
