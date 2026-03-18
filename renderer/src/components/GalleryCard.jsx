import React, { memo, useState } from 'react';
import { cn } from '../lib/utils.js';

// Skeleton component for loading state - simplified for better performance
export const GalleryCardSkeleton = memo(function GalleryCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm will-change-transform">
      <div className="relative w-full overflow-hidden bg-clay/10">
        <div className="aspect-[4/3] bg-clay/20" />
      </div>
      <div className="space-y-2 p-2.5">
        <div className="h-3 w-3/4 rounded bg-clay/20" />
        <div className="h-3 w-1/2 rounded bg-clay/20" />
      </div>
    </div>
  );
});

export const GalleryCard = memo(function GalleryCard({
  item,
  active,
  onClick,
  onPointerEnterCard,
  onPointerLeaveCard,
}) {
  const captionText = item.activeCaption?.content?.trim();
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasImage = Boolean(item.thumbnail_data_url);

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
        // GPU acceleration
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl bg-white',
        'shadow-sm hover:shadow-md',
        'transform-gpu will-change-transform',
        'transition-shadow duration-200 ease-out',
        active && 'ring-2 ring-moss shadow-md'
      )}
    >
      <div className="relative w-full overflow-hidden bg-clay/5">
        {hasImage ? (
          <>
            {/* Placeholder until image loads */}
            <div
              className={cn(
                'absolute inset-0 bg-clay/10 transition-opacity duration-300',
                imageLoaded ? 'opacity-0' : 'opacity-100'
              )}
            />
            <img
              src={item.thumbnail_data_url}
              alt={item.original_file_name}
              className={cn(
                'h-auto w-full object-cover',
                'transition-opacity duration-300',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-clay/10">
            <div className="h-4 w-4 rounded-full bg-clay/20" />
          </div>
        )}

        {/* Simplified overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5" />
      </div>

      {captionText || item.tags?.length > 0 ? (
        <div className="p-2.5">
          {captionText ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-ink/80">
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
