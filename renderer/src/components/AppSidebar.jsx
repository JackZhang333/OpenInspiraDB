import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FolderOpen,
  ImagePlus,
  Lightbulb,
  Loader2,
  Plus,
  Settings2,
  SkipForward,
  Tags,
  Trash2,
  X,
  Pencil,
  Save,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';

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

let draftTagSequence = 0;

function createDraftId(prefix) {
  draftTagSequence += 1;
  return `${prefix}-${draftTagSequence}`;
}

function cloneTagTreeToDraft(tagTree = []) {
  return (tagTree || []).map((group) => ({
    id: group.id,
    name: group.name,
    isSystem: Boolean(group.isSystem),
    children: (group.children || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      parentId: group.id,
      isSystem: Boolean(tag.isSystem),
    })),
    pendingChildName: '',
  }));
}

function isDraftId(value) {
  return typeof value === 'string' && value.startsWith('draft-');
}

export function TagSettingsDialog({
  open,
  saving,
  tagTree,
  onClose,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}) {
  const initialTreeRef = React.useRef([]);
  const [draftGroups, setDraftGroups] = React.useState([]);
  const [newParentName, setNewParentName] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      initialTreeRef.current = [];
      setDraftGroups([]);
      setNewParentName('');
      setLocalError('');
      return;
    }

    const nextDraft = cloneTagTreeToDraft(tagTree);
    initialTreeRef.current = cloneTagTreeToDraft(tagTree);
    setDraftGroups(nextDraft);
    setNewParentName('');
    setLocalError('');
  }, [open]);

  if (!open) {
    return null;
  }

  const updateGroup = (groupId, updater) => {
    setDraftGroups((currentGroups) => currentGroups.map((group) => (
      String(group.id) === String(groupId) ? updater(group) : group
    )));
  };

  const handleAddParent = () => {
    const name = newParentName.trim() || '新一级分类';
    setDraftGroups((currentGroups) => [
      ...currentGroups,
      {
        id: createDraftId('draft-parent'),
        name,
        isSystem: false,
        children: [],
        pendingChildName: '',
      },
    ]);
    setNewParentName('');
  };

  const handleRemoveParent = (groupId) => {
    setDraftGroups((currentGroups) => currentGroups.filter((group) => String(group.id) !== String(groupId)));
  };

  const handleAddChild = (groupId) => {
    const group = draftGroups.find((item) => item.id === groupId);
    const name = String(group?.pendingChildName || '').trim();
    if (!name) {
      return;
    }

    updateGroup(groupId, (currentGroup) => ({
      ...currentGroup,
      pendingChildName: '',
      children: [
        ...currentGroup.children,
        {
          id: createDraftId('draft-child'),
          name,
          parentId: groupId,
          isSystem: false,
        },
      ],
    }));
  };

  const handleRemoveChild = (groupId, childId) => {
    updateGroup(groupId, (currentGroup) => ({
      ...currentGroup,
      children: currentGroup.children.filter((child) => String(child.id) !== String(childId)),
    }));
  };

  const handleMoveChild = (fromGroupId, childId, toGroupId) => {
    if (!toGroupId || String(fromGroupId) === String(toGroupId)) {
      return;
    }

    setDraftGroups((currentGroups) => {
      let movedChild = null;
      const nextGroups = currentGroups.map((group) => {
        if (String(group.id) !== String(fromGroupId)) {
          return group;
        }

        const nextChildren = [];
        for (const child of group.children) {
          if (String(child.id) === String(childId)) {
            movedChild = {
              ...child,
              parentId: toGroupId,
            };
            continue;
          }
          nextChildren.push(child);
        }

        return {
          ...group,
          children: nextChildren,
        };
      });

      if (!movedChild) {
        return currentGroups;
      }

      return nextGroups.map((group) => (
        String(group.id) === String(toGroupId)
          ? {
            ...group,
            children: [...group.children, movedChild],
          }
          : group
      ));
    });
  };

  const handleSaveAll = async () => {
    const sanitizedGroups = draftGroups
      .map((group) => ({
        ...group,
        name: group.name.trim(),
        children: group.children
          .map((child) => ({
            ...child,
            name: child.name.trim(),
          }))
          .filter((child) => child.name),
      }))
      .filter((group) => group.name);

    if (!sanitizedGroups.length) {
      setLocalError('至少保留一个一级分类后再保存。');
      return;
    }

    setLocalError('');

    const originalGroups = initialTreeRef.current || [];
    const originalParentMap = new Map(originalGroups.map((group) => [String(group.id), group]));
    const originalChildMap = new Map(
      originalGroups.flatMap((group) => group.children.map((child) => [String(child.id), child])),
    );
    const draftParentIds = new Set(sanitizedGroups.map((group) => String(group.id)));
    const draftChildIds = new Set(
      sanitizedGroups.flatMap((group) => group.children.map((child) => String(child.id))),
    );
    const createdParentIdMap = new Map();

    for (const group of sanitizedGroups) {
      if (!isDraftId(group.id)) {
        continue;
      }

      const created = await onCreateTag?.({ name: group.name, level: 1 });
      if (created?.id) {
        createdParentIdMap.set(String(group.id), created.id);
      }
    }

    for (const group of sanitizedGroups) {
      if (isDraftId(group.id)) {
        continue;
      }

      const originalGroup = originalParentMap.get(String(group.id));
      if (originalGroup && originalGroup.name !== group.name) {
        await onUpdateTag?.({ tagId: group.id, name: group.name });
      }
    }

    for (const [childId, originalChild] of originalChildMap.entries()) {
      if (!draftChildIds.has(childId)) {
        await onDeleteTag?.(originalChild.id);
      }
    }

    for (const group of sanitizedGroups) {
      const resolvedParentId = createdParentIdMap.get(String(group.id)) || group.id;
      for (const child of group.children) {
        if (isDraftId(child.id)) {
          await onCreateTag?.({
            name: child.name,
            level: 2,
            parentId: Number(resolvedParentId),
          });
          continue;
        }

        const originalChild = originalChildMap.get(String(child.id));
        if (!originalChild) {
          continue;
        }

        if (originalChild.name !== child.name || Number(originalChild.parentId) !== Number(resolvedParentId)) {
          await onUpdateTag?.({
            tagId: child.id,
            name: child.name,
            parentId: Number(resolvedParentId),
          });
        }
      }
    }

    for (const [parentId, originalGroup] of originalParentMap.entries()) {
      if (!draftParentIds.has(parentId)) {
        await onDeleteTag?.(originalGroup.id);
      }
    }

    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 p-6 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-clay/15 bg-[#f7faf4] shadow-[0_28px_80px_rgba(16,24,20,0.22)]">
        <div className="flex items-center justify-between border-b border-clay/10 bg-white/80 px-8 py-6">
          <div>
            <div className="text-[24px] font-bold tracking-tight text-ink">标签管理台</div>
            <div className="mt-1 text-sm text-ink/45">在这里整理一级分类和二级标签，最后统一提交保存。</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink/40 transition hover:bg-clay/10 hover:text-ink/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-[#f1f6ed] px-8 py-7">
          <div className="mb-6 flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/35">Primary Category</div>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={newParentName}
                onChange={(event) => setNewParentName(event.target.value)}
                placeholder="例如：项目类型"
                className="h-12 w-48 rounded-2xl border-white/80 bg-[#f6faf2]"
              />
              <Button
                type="button"
                className="h-12 rounded-2xl px-5"
                onClick={handleAddParent}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                一级标签
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            {draftGroups.map((group) => (
              <div key={group.id} className="rounded-[26px] border border-white/70 bg-white/85 p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <div className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 shadow-sm',
                      group.isSystem
                        ? 'border-clay/20 bg-clay/10 text-ink/55'
                        : 'border-moss/20 bg-moss/10 text-moss',
                    )}>
                      <Tags className="h-4 w-4" />
                      <input
                        value={group.name}
                        disabled={group.isSystem}
                        onChange={(event) => updateGroup(group.id, (currentGroup) => ({
                          ...currentGroup,
                          name: event.target.value,
                        }))}
                        className={cn(
                          'min-w-[160px] border-0 bg-transparent p-0 text-sm font-semibold focus:outline-none',
                          group.isSystem ? 'text-ink/55' : 'text-moss',
                        )}
                      />
                      {group.isSystem ? (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-ink/45">系统</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink/40">{group.children.length} 个标签</div>
                  </div>

                  {!group.isSystem ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveParent(group.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除一级分类
                    </button>
                  ) : null}
                </div>

                <div className="rounded-[22px] bg-[#f4f8ef] p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {group.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex min-w-0 items-center gap-2 rounded-full border border-clay/15 bg-white px-3 py-2 shadow-sm"
                      >
                        <input
                          value={child.name}
                          onChange={(event) => updateGroup(group.id, (currentGroup) => ({
                            ...currentGroup,
                            children: currentGroup.children.map((currentChild) => (
                              currentChild.id === child.id
                                ? { ...currentChild, name: event.target.value }
                                : currentChild
                            )),
                          }))}
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none"
                        />
                        <select
                          value={String(group.id)}
                          onChange={(event) => handleMoveChild(group.id, child.id, event.target.value)}
                          className="max-w-[80px] rounded-full border border-clay/15 bg-[#f6faf2] px-2 py-1 text-[11px] font-medium text-ink/60 focus:outline-none focus:ring-1 focus:ring-moss/30"
                        >
                          {draftGroups.map((optionGroup) => (
                            <option key={optionGroup.id} value={optionGroup.id}>{optionGroup.name || '未命名分类'}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(group.id, child.id)}
                          className="rounded-full p-1 text-ink/30 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex items-center gap-2 rounded-full border border-dashed border-moss/25 bg-white/70 px-3 py-2">
                      <Plus className="h-3.5 w-3.5 text-moss" />
                      <input
                        value={group.pendingChildName}
                        onChange={(event) => updateGroup(group.id, (currentGroup) => ({
                          ...currentGroup,
                          pendingChildName: event.target.value,
                        }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddChild(group.id);
                          }
                        }}
                        placeholder="添加标签"
                        className="min-w-[80px] flex-1 border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddChild(group.id)}
                        className="rounded-full bg-moss px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-moss/90"
                      >
                        新增
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-clay/10 bg-white/85 px-8 py-5">
          <div className="flex items-center gap-2 text-xs text-ink/45">
            <Save className="h-4 w-4 text-moss" />
            <span>修改会在点击“保存修改”后统一提交。</span>
          </div>
          <div className="flex items-center gap-3">
            {localError ? (
              <div className="mr-2 text-xs font-medium text-rose-600">{localError}</div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-ink/55 transition hover:bg-clay/10 hover:text-ink/80"
            >
              取消
            </button>
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="h-12 rounded-2xl px-6"
            >
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  importing,
  importProgress,
  saving,
  onImportFolder,
  onImportFile,
  onExportBatch,
  availableTags,
  expandedParentTagIds,
  selectedTagIds,
  selectedTags,
  filterMode,
  onToggleParent,
  onToggleTag,
  onClearTags,
  onFilterModeChange,
  onOpenTagSettings,
}) {
  const selectedSet = React.useMemo(
    () => new Set((selectedTagIds || []).map((id) => Number(id))),
    [selectedTagIds],
  );
  const expandedSet = React.useMemo(
    () => new Set((expandedParentTagIds || []).map((id) => Number(id))),
    [expandedParentTagIds],
  );
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
  const progressText = importing
    ? total > 0
      ? `${clamp(current, 0, total)}/${total}`
      : progress.label
    : '';

  return (
    <aside className="relative flex h-full min-h-0 flex-col border-r border-[#e8ebe4] bg-[#f8faf6]">
      <div className={cn('flex items-center', collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="bg-gradient-to-r from-moss to-moss/70 bg-clip-text text-[17px] font-bold tracking-tight text-transparent">意图集</span>
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
            collapsed ? 'h-10 justify-center' : 'h-11 justify-between px-3',
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
              collapsed ? 'justify-center px-2' : 'px-3',
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
              collapsed ? 'justify-center px-2' : 'px-3',
            )}
          >
            <Download className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="truncate">批量导出</span>}
          </button>
        </div>

        {!collapsed && isBatchImporting && (
          <div className="mt-2 rounded-xl border border-moss/15 bg-gradient-to-br from-moss/5 to-moss/[0.02] px-3 py-3">
            <div className="mb-3 flex items-center gap-3">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                phase === 'importing' ? 'bg-moss text-white' : 'bg-moss/20 text-moss',
              )}>
                1
              </div>
              <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-moss/10">
                <div
                  className="h-full rounded-full bg-moss/40 transition-all duration-500"
                  style={{ width: phase === 'importing' ? `${(clamp(current, 0, Math.max(importTotal, 1)) / Math.max(importTotal, 1)) * 100}%` : '100%' }}
                />
              </div>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                phase === 'analyzing' ? 'bg-moss text-white' : phase === 'completed' ? 'bg-moss/20 text-moss' : 'bg-clay/20 text-ink/30',
              )}>
                2
              </div>
            </div>

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
        <div className="min-h-0 flex-1 px-3">
          <div className="flex h-full min-h-0 flex-col rounded-xl border border-clay/20 bg-white/60">
            <div className="flex items-center justify-between border-b border-clay/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Tags className="h-3.5 w-3.5 text-ink/40" />
                <span className="text-[12px] font-medium text-ink/60">二级标签</span>
              </div>
              <div className="flex items-center gap-1">
                {!!selectedTags?.length && (
                  <button
                    onClick={onClearTags}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-ink/40 hover:bg-clay/10 hover:text-ink/70"
                  >
                    <X className="h-3 w-3" />
                    清空
                  </button>
                )}
                <button
                  onClick={onOpenTagSettings}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-ink/40 hover:bg-clay/10 hover:text-ink/70"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  设置
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
              {availableTags.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-ink/30">
                  暂无标签
                </div>
              ) : (
                <div className="space-y-2">
                  {availableTags.map((group) => {
                    const isExpanded = expandedSet.has(Number(group.id));
                    return (
                      <div key={group.id} className="overflow-hidden rounded-xl border border-clay/10 bg-white/80">
                        <button
                          type="button"
                          onClick={() => onToggleParent?.(group.id)}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-clay/5"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-ink/35" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-ink/35" />
                            )}
                            <div>
                              <div className="text-[13px] font-medium text-ink/75">{group.name}</div>
                              <div className="text-[10px] text-ink/35">{group.count || 0} 张</div>
                            </div>
                          </div>
                          <span className="rounded-md bg-clay/10 px-1.5 py-0.5 text-[10px] text-ink/40">
                            {(group.children || []).length}
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-clay/10 px-2 py-2">
                            <div className="space-y-1">
                              {(group.children || []).map((tag) => {
                                const isSelected = selectedSet.has(Number(tag.id));
                                return (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => onToggleTag?.(tag.id)}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all',
                                      isSelected
                                        ? 'bg-moss/10 text-moss'
                                        : 'text-ink/70 hover:bg-clay/10',
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                                        isSelected
                                          ? 'border-moss bg-moss text-white'
                                          : 'border-clay/30 bg-white text-transparent',
                                      )}>
                                        ✓
                                      </span>
                                      <span className={cn('text-[13px]', isSelected && 'font-medium')}>
                                        {tag.name}
                                      </span>
                                    </div>
                                    <span className={cn(
                                      'rounded-md px-1.5 py-0.5 text-[10px]',
                                      isSelected
                                        ? 'bg-moss/20 text-moss/80'
                                        : 'bg-clay/10 text-ink/40',
                                    )}>
                                      {tag.count || 0}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-clay/10 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-ink/45">
                <span>已选 {selectedTags?.length || 0} 个标签</span>
                <span>{filterMode === 'or' ? '任意命中' : '全部命中'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onFilterModeChange?.('and')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-medium transition',
                    filterMode === 'and'
                      ? 'bg-moss text-white'
                      : 'bg-white text-ink/60 ring-1 ring-clay/20 hover:text-ink/80',
                  )}
                >
                  全部（AND）
                </button>
                <button
                  type="button"
                  onClick={() => onFilterModeChange?.('or')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-medium transition',
                    filterMode === 'or'
                      ? 'bg-moss text-white'
                      : 'bg-white text-ink/60 ring-1 ring-clay/20 hover:text-ink/80',
                  )}
                >
                  任意（OR）
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 px-2">
          <div className="flex h-full flex-col items-center gap-2 rounded-xl border border-clay/20 bg-white/60 py-2">
            <Tags className="mb-1 h-4 w-4 text-ink/30" />
            {(selectedTags || []).slice(0, 5).map((tag) => (
              <button
                key={tag.id}
                onClick={() => onToggleTag?.(tag.id)}
                className="h-2.5 w-2.5 rounded-full bg-moss"
                title={tag.name}
              />
            ))}
            <button
              onClick={onOpenTagSettings}
              className="mt-auto rounded-lg p-2 text-ink/35 transition hover:bg-white/60 hover:text-ink/65"
              title="标签设置"
            >
              <Settings2 className="h-4 w-4" />
            </button>
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
