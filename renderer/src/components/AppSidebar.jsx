import React from 'react';
import {
  FolderOpen,
  ImagePlus,
  Download,
  Tags,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Copy,
  SkipForward,
  Lightbulb,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

function LogoIcon({ size = 24 }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-gradient-to-br from-moss to-moss/80 text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <Lightbulb className="h-[60%] w-[60%]" strokeWidth={2.5} />
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getImportProgressSnapshot(importing, importProgress) {
  if (!importing || !importProgress) {
    return {
      determinate: false,
      ratio: 0,
      label: '',
      phaseLabel: '',
    };
  }

  const phase = String(importProgress.phase || '');
  if (phase === 'completed') {
    return {
      determinate: true,
      ratio: 1,
      label: '100%',
      phaseLabel: '已完成',
    };
  }

  const total = Number(importProgress.total || 0);
  const current = Number(importProgress.current || 0);
  if (Number.isFinite(total) && total > 0) {
    const baseRatio = clamp(current / total, 0, 1);
    const ratio = importProgress.mode === 'folder' && phase === 'analyzing'
      ? 0.55 + (baseRatio * 0.45)
      : importProgress.mode === 'folder' && phase === 'importing'
        ? baseRatio * 0.55
        : baseRatio;
    const displayRatio = importProgress.mode === 'folder' ? ratio : baseRatio;

    const phaseLabel = phase === 'analyzing'
      ? '分析中'
      : phase === 'importing'
        ? '导入中'
        : '处理中';

    return {
      determinate: true,
      ratio,
      label: `${Math.round(displayRatio * 100)}%`,
      phaseLabel,
    };
  }

  return {
    determinate: false,
    ratio: 0,
    label: '处理中',
    phaseLabel: '处理中',
  };
}

function ImportProgressRing({ importing, importProgress }) {
  const snapshot = getImportProgressSnapshot(importing, importProgress);
  const size = 24;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - snapshot.ratio);

  return (
    <div className="relative flex h-6 w-6 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(importing && !snapshot.determinate && 'animate-spin')}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={stroke}
        />
        {snapshot.determinate ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dashoffset] duration-300"
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.26} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <ImagePlus className="pointer-events-none absolute h-3.5 w-3.5" />
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
  onExportBatch,
  availableTags,
  selectedTag,
  onSelectTag,
  onClearTag,
}) {
  const progress = getImportProgressSnapshot(importing, importProgress);
  const total = Number(importProgress?.total || 0);
  const current = Number(importProgress?.current || 0);
  const isBatchImporting = importing && importProgress?.mode === 'folder';
  const importedCount = Number(importProgress?.importedCount || 0);
  const duplicateCount = Number(importProgress?.duplicateCount || 0);
  const skippedCount = Number(importProgress?.skippedCount || 0);
  const readyCount = Number(importProgress?.readyCount || 0);
  const failedCount = Number(importProgress?.failedCount || 0);
  const queuedCount = Number(importProgress?.queuedCount || 0);
  const analyzingCount = Number(importProgress?.analyzingCount || 0);
  const phase = String(importProgress?.phase || '');
  const importTotal = phase === 'importing'
    ? total
    : importedCount + duplicateCount + skippedCount;
  const importCurrent = phase === 'importing'
    ? clamp(current, 0, importTotal)
    : importTotal;
  const progressText = importing
    ? phase === 'analyzing'
      ? `${clamp(current, 0, total)}/${total}`
      : total > 0
        ? `${clamp(current, 0, total)}/${total}`
        : progress.label
    : '';

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[#e8ebe4] bg-[#f8faf6]">
      <div className={cn('flex items-center', collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="text-[17px] font-bold tracking-tight text-ink bg-gradient-to-r from-moss to-moss/70 bg-clip-text text-transparent">意图集</span>
          </div>
        ) : (
          <LogoIcon size={24} />
        )}
      </div>

      <div className={cn('px-3 pb-2', collapsed && 'px-2')}>
        <button
          onClick={onImportFile}
          disabled={importing}
          className={cn(
            'group relative flex w-full items-center overflow-hidden rounded-xl bg-moss text-white shadow-sm transition-all hover:bg-moss/90 hover:shadow-md active:scale-[0.98] disabled:opacity-60',
            collapsed ? 'h-10 justify-center' : 'h-11 justify-between px-3'
          )}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_30%,white,transparent_50%)]" />
          </div>

          <div className="relative flex items-center gap-2.5">
            <ImportProgressRing importing={importing} importProgress={importProgress} />
            {!collapsed && (
              <span className="text-[13px] font-medium">导入图片</span>
            )}
          </div>

          {!collapsed && importing && (
            <div className="relative text-[11px] font-semibold tracking-wide text-white/85">
              {progressText}
            </div>
          )}
        </button>
      </div>

      <div className={cn('px-3 pb-4', collapsed && 'px-2')}>
        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
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

          <button
            onClick={onExportBatch}
            disabled={importing}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-clay/30 bg-white/50 py-2 text-[12px] text-ink/60 transition hover:bg-white hover:text-ink/80 disabled:opacity-50',
              collapsed ? 'justify-center px-2' : 'px-3'
            )}
          >
            <Download className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="truncate">批量导出</span>}
          </button>
        </div>

        {!collapsed && isBatchImporting && (
          <div className="mt-2 rounded-xl border border-moss/15 bg-gradient-to-br from-moss/5 to-moss/[0.02] px-3 py-3">
            {/* Phase indicator */}
            <div className="mb-3 flex items-center gap-3">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                phase === 'importing' ? 'bg-moss text-white' : 'bg-moss/20 text-moss'
              )}>
                1
              </div>
              <div className="h-0.5 flex-1 rounded-full bg-moss/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-moss/40 transition-all duration-500"
                  style={{ width: phase === 'importing' ? `${(importCurrent / Math.max(importTotal, 1)) * 100}%` : '100%' }}
                />
              </div>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                phase === 'analyzing' ? 'bg-moss text-white' : phase === 'completed' ? 'bg-moss/20 text-moss' : 'bg-clay/20 text-ink/30'
              )}>
                2
              </div>
            </div>

            {/* Overall progress */}
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {phase === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin text-moss" />}
                  {phase === 'completed' && <CheckCircle2 className="h-3 w-3 text-moss" />}
                  {phase === 'importing' && <div className="h-3 w-3 rounded-full bg-moss/60" />}
                  <span className="text-[11px] font-medium text-ink/70">
                    {phase === 'importing' ? '导入文件' : phase === 'analyzing' ? 'AI分析中' : '已完成'}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-moss">{progressText}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-moss/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-moss to-moss/80 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, progress.ratio * 100))}%` }}
                />
              </div>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap gap-1.5">
              {importedCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{importedCount}</span>
                </div>
              )}
              {readyCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] text-blue-600">
                  <Clock className="h-3 w-3" />
                  <span>{readyCount}</span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{failedCount}</span>
                </div>
              )}
              {queuedCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-600">
                  <Clock className="h-3 w-3" />
                  <span>{queuedCount}</span>
                </div>
              )}
              {analyzingCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-moss/10 px-2 py-1 text-[10px] text-moss">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{analyzingCount}</span>
                </div>
              )}
              {duplicateCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[10px] text-purple-600">
                  <Copy className="h-3 w-3" />
                  <span>{duplicateCount}</span>
                </div>
              )}
              {skippedCount > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                  <SkipForward className="h-3 w-3" />
                  <span>{skippedCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!collapsed ? (
        <div className="flex-1 min-h-0 px-3">
          <div className="flex h-full flex-col rounded-xl bg-white/60 border border-clay/20">
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

      <div className={cn('border-t border-clay/20', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed ? (
          <div className="flex items-center justify-end">
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
          <div className="flex flex-col items-center">
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
