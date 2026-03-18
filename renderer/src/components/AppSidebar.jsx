import React from 'react';
import {
  FolderOpen,
  ImagePlus,
  Settings2,
  Tags,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

// Logo 图标组件
function LogoIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L12.5 4C13.5 3.8 15 4 16 5.5C17 7 16.5 8.5 16 9.5L18 10C18.5 10.2 19.5 10.8 19 12C18.5 13.2 17 14 15.5 14.5L14 19C13.8 19.6 13.2 20 12.5 20H11.5C10.8 20 10.2 19.6 10 19L8.5 14.5C7 14 5.5 13.2 5 12C4.5 10.8 5.5 10.2 6 10L8 9.5C7.5 8.5 7 7 8 5.5C9 4 10.5 3.8 11.5 4L12 2Z"
        fill="#4e6958"
        stroke="#4e6958"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="1.5" fill="white"/>
    </svg>
  );
}

// 进度环组件
function ImportProgressRing({ progress }) {
  const size = 20;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - (progress || 0));

  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-300"
        />
      </svg>
      <ImagePlus className="absolute h-3 w-3" />
    </div>
  );
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  importing,
  importProgress,
  onImportFolder,
  onImportFile,
  availableTags,
  selectedTag,
  onSelectTag,
  onClearTag,
  onOpenSettings,
}) {
  // 计算进度
  const progress = importProgress?.total
    ? importProgress.current / importProgress.total
    : 0;
  const isBatchImporting = importing && importProgress?.mode === 'folder';

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[#e8ebe4] bg-[#f8faf6]">
      {/* Logo */}
      <div className={cn('flex items-center', collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-ink">小图钉</span>
          </div>
        ) : (
          <LogoIcon size={24} />
        )}
      </div>

      {/* 单张导入 - 凸显 */}
      <div className={cn('px-3 pb-2', collapsed && 'px-2')}>
        <button
          onClick={onImportFile}
          disabled={importing}
          className={cn(
            'group relative flex w-full items-center overflow-hidden rounded-xl bg-moss text-white shadow-sm transition-all hover:bg-moss/90 hover:shadow-md active:scale-[0.98] disabled:opacity-60',
            collapsed ? 'h-10 justify-center' : 'h-11 px-3'
          )}
        >
          {/* 背景纹理 */}
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_30%,white,transparent_50%)]" />
          </div>

          <div className="relative flex items-center gap-2.5">
            {importing ? (
              <ImportProgressRing progress={progress} />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
                <ImagePlus className="h-3.5 w-3.5" />
              </div>
            )}
            {!collapsed && (
              <span className="text-[13px] font-medium">
                {importing ? '导入中...' : '导入图片'}
              </span>
            )}
          </div>

          {/* 进度文字 */}
          {!collapsed && importing && importProgress?.total > 0 && (
            <div className="relative text-[11px] font-medium text-white/85">
              {Math.round(progress * 100)}%
            </div>
          )}
        </button>
      </div>

      {/* 批量导入 - 弱化 */}
      <div className={cn('px-3 pb-4', collapsed && 'px-2')}>
        <button
          onClick={onImportFolder}
          disabled={importing}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border border-clay/30 bg-white/50 py-2 text-[12px] text-ink/60 transition hover:bg-white hover:text-ink/80 disabled:opacity-50',
            collapsed ? 'justify-center px-2' : 'px-3'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
          {!collapsed && <span className="truncate">批量导入</span>}
        </button>

        {/* 批量导入进度 - 视觉化 */}
        {!collapsed && isBatchImporting && (
          <div className="mt-2 rounded-xl border border-moss/10 bg-gradient-to-br from-moss/5 to-moss/[0.02] px-3 py-2.5">
            {/* 阶段标签 + 百分比 */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-moss/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-moss animate-pulse" />
                </div>
                <span className="text-[11px] font-medium text-moss">
                  {importProgress?.phase === 'analyzing' ? '分析中' : '导入中'}
                </span>
              </div>
              <span className="text-[12px] font-semibold text-moss">
                {Math.round(progress * 100)}%
              </span>
            </div>

            {/* 进度条 */}
            <div className="h-2 overflow-hidden rounded-full bg-moss/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-moss to-moss/80 transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              />
            </div>

            {/* 视觉化状态指示器 */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* 已导入 */}
                <div className="flex items-center gap-1" title="已导入">
                  <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity="0.2" />
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {importProgress?.importedCount > 0 && (
                    <span className="text-[10px] font-medium text-emerald-600">{importProgress.importedCount}</span>
                  )}
                </div>

                {/* 分析中 */}
                <div className="flex items-center gap-1" title="分析中">
                  <svg className="h-3 w-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity="0.2" />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                  {importProgress?.analyzingCount > 0 && (
                    <span className="text-[10px] font-medium text-amber-600">{importProgress.analyzingCount}</span>
                  )}
                </div>

                {/* 已完成 */}
                <div className="flex items-center gap-1" title="已完成">
                  <svg className="h-3 w-3 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity="0.2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {importProgress?.readyCount > 0 && (
                    <span className="text-[10px] font-medium text-blue-600">{importProgress.readyCount}</span>
                  )}
                </div>
              </div>

              {/* 次要状态 */}
              <div className="flex items-center gap-1.5">
                {importProgress?.failedCount > 0 && (
                  <span className="flex h-4 items-center rounded-full bg-rose-100 px-1.5 text-[9px] font-medium text-rose-600">
                    {importProgress.failedCount} 失败
                  </span>
                )}
                {importProgress?.duplicateCount > 0 && (
                  <span className="flex h-4 items-center rounded-full bg-amber-100 px-1.5 text-[9px] font-medium text-amber-600">
                    {importProgress.duplicateCount} 重复
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 标签筛选 */}
      {!collapsed ? (
        <div className="flex-1 min-h-0 px-3">
          <div className="flex h-full flex-col rounded-xl bg-white/60 border border-clay/20">
            {/* 标签标题 */}
            <div className="flex items-center justify-between border-b border-clay/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Tags className="h-3.5 w-3.5 text-ink/40" />
                <span className="text-[12px] font-medium text-ink/60">标签</span>
              </div>
              {selectedTag && (
                <button
                  onClick={onClearTag}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-ink/40 hover:bg-clay/10 hover:text-ink/70"
                >
                  <X className="h-3 w-3" />
                  清空
                </button>
              )}
            </div>

            {/* 标签列表 - 单选 */}
            <div className="flex-1 overflow-auto py-1">
              {availableTags.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-ink/30">
                  暂无标签
                </div>
              ) : (
                <div className="px-1.5 py-1">
                  {availableTags.slice(0, 20).map((tagItem) => {
                    const isSelected = selectedTag === tagItem.name;
                    return (
                      <button
                        key={tagItem.name}
                        onClick={() => onSelectTag(isSelected ? null : tagItem.name)}
                        className={cn(
                          'group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all',
                          isSelected
                            ? 'bg-moss/10 text-moss'
                            : 'text-ink/70 hover:bg-clay/10'
                        )}
                      >
                        <span className={cn(
                          'text-[13px]',
                          isSelected && 'font-medium'
                        )}>
                          {tagItem.name}
                        </span>
                        <span className={cn(
                          'rounded-md px-1.5 py-0.5 text-[10px]',
                          isSelected
                            ? 'bg-moss/20 text-moss/80'
                            : 'bg-clay/10 text-ink/40'
                        )}>
                          {tagItem.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-2">
          <div className="flex h-full flex-col items-center gap-1 rounded-xl bg-white/60 border border-clay/20 py-2">
            <Tags className="h-4 w-4 text-ink/30 mb-1" />
            {availableTags.slice(0, 5).map((tagItem) => {
              const isSelected = selectedTag === tagItem.name;
              return (
                <button
                  key={tagItem.name}
                  onClick={() => onSelectTag(isSelected ? null : tagItem.name)}
                  className={cn(
                    'h-2 w-2 rounded-full transition-all',
                    isSelected ? 'bg-moss scale-125' : 'bg-clay/30 hover:bg-clay/50'
                  )}
                  title={tagItem.name}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 底部：设置 + 收起 */}
      <div className={cn('border-t border-clay/20', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-ink/50 transition hover:bg-white/60 hover:text-ink/80"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>设置</span>
            </button>
            <button
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 transition hover:bg-white/60 hover:text-ink/70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 transition hover:bg-white/60 hover:text-ink/70"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 transition hover:bg-white/60 hover:text-ink/70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
