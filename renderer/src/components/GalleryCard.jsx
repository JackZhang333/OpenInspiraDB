import React, { memo, useEffect, useRef } from 'react';
import { cn } from '../lib/utils.js';

// Skeleton component for loading state
export function GalleryCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="relative w-full overflow-hidden bg-clay/10">
        <div className="aspect-[4/3] animate-pulse bg-clay/20" />
      </div>
      <div className="space-y-2 p-2.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-clay/20" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-clay/20" />
        <div className="flex gap-1 pt-0.5">
          <div className="h-4 w-10 animate-pulse rounded-full bg-clay/20" />
          <div className="h-4 w-8 animate-pulse rounded-full bg-clay/20" />
        </div>
      </div>
    </div>
  );
}

export const GalleryCard = memo(function GalleryCard({
  item,
  active,
  visible = false,
  onObserve,
  onUnobserve,
  onClick,
  onPointerEnterCard,
  onPointerLeaveCard,
}) {
  const cardRef = useRef(null);
  const captionText = item.activeCaption?.content?.trim();

  // Intersection Observer for lazy loading
  useEffect(() => {
    const element = cardRef.current;
    if (element && onObserve) {
      onObserve(element, String(item.id));
    }
    return () => {
      if (element && onUnobserve) {
        onUnobserve(element);
      }
    };
  }, [item.id, onObserve, onUnobserve]);

  return (
    <div
      ref={cardRef}
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
        {visible && item.thumbnail_data_url ? (
          <img
            src={item.thumbnail_data_url}
            alt={item.original_file_name}
            className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-clay/10">
            <div className="h-4 w-4 rounded-full bg-clay/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
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
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="shrink-0 rounded-full bg-clay/10 px-1.5 py-0.5 text-[9px] text-ink/50"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="shrink-0 rounded-full bg-clay/10 px-1.5 py-0.5 text-[9px] text-ink/50">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
