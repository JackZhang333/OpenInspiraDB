import React from 'react';
import { cn } from '../lib/utils.js';

export function GalleryCard({
  item,
  active,
  onClick,
  onPointerEnterCard,
  onPointerLeaveCard,
}) {
  const captionText = item.activeCaption?.content?.trim();

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
