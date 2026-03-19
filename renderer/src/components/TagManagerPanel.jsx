import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Tag,
  AlertCircle,
  X,
  Check,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';

// 一级标签卡片组件
function ParentTagCard({
  group,
  isExpanded,
  onToggle,
  editingTagId,
  editingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingNameChange,
  tagTree,
  saving,
}) {
  const isEditing = editingTagId === group.id;
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const hasChildren = (group.children?.length || 0) > 0;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        isExpanded
          ? 'border-moss/30 bg-white shadow-sm'
          : 'border-clay/15 bg-white/80 hover:border-clay/25 hover:bg-white'
      )}
    >
      {/* 一级标签头部 */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* 展开/折叠按钮 */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            'text-ink/40 hover:bg-clay/10 hover:text-ink/70',
            isExpanded && 'text-moss hover:bg-moss/10'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* 图标 */}
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
            isExpanded ? 'bg-moss/10 text-moss' : 'bg-clay/10 text-ink/50'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </div>

        {/* 名称区域 */}
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              ref={inputRef}
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(group);
                if (e.key === 'Escape') onCancelEdit();
              }}
              disabled={saving || group.isSystem}
              className="h-8 text-sm"
              placeholder="标签名称"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSaveEdit(group)}
                disabled={saving || !editingName.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onCancelEdit}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {group.name}
                </span>
                {group.isSystem && (
                  <span className="shrink-0 rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-medium text-ink/50">
                    系统
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink/40">
                <span>{group.children?.length || 0} 个二级标签</span>
                {group.count > 0 && (
                  <>
                    <span>·</span>
                    <span>{group.count} 张图片</span>
                  </>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            {!group.isSystem && (
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onStartEdit(group)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-clay/10 hover:text-ink/70"
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(group.id)}
                  disabled={hasChildren}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title={hasChildren ? '请先删除子标签' : '删除'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 二级标签列表 */}
      {isExpanded && (
        <div className="border-t border-clay/10 px-2 pb-2">
          {group.children?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-clay/10">
                <Tag className="h-4 w-4 text-ink/30" />
              </div>
              <p className="text-xs text-ink/40">暂无二级标签</p>
              <p className="text-[10px] text-ink/30">在上方添加二级标签</p>
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {group.children.map((tag) => (
                <ChildTagItem
                  key={tag.id}
                  tag={tag}
                  editingTagId={editingTagId}
                  editingName={editingName}
                  editingParentId={null}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onDelete={onDelete}
                  onEditingNameChange={onEditingNameChange}
                  saving={saving}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 二级标签项组件
function ChildTagItem({
  tag,
  editingTagId,
  editingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingNameChange,
  saving,
}) {
  const isEditing = editingTagId === tag.id;
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/5 px-2 py-2">
        <Tag className="h-3.5 w-3.5 text-moss/60" />
        <Input
          ref={inputRef}
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveEdit(tag);
            if (e.key === 'Escape') onCancelEdit();
          }}
          disabled={saving}
          className="h-7 flex-1 text-sm"
          placeholder="标签名称"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSaveEdit(tag)}
            disabled={saving || !editingName.trim()}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={onCancelEdit}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-clay/10 hover:bg-white">
      <Tag className="h-3.5 w-3.5 text-ink/30" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink/80">{tag.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-md bg-clay/10 px-1.5 py-0.5 text-[10px] text-ink/50">
          {tag.count || 0} 张
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onStartEdit(tag)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-clay/10 hover:text-ink/70"
            title="编辑"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(tag.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-rose-50 hover:text-rose-600"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 新增标签表单
function CreateTagSection({
  tagTree,
  onCreateParent,
  onCreateChild,
  saving,
}) {
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');

  // 初始化默认选中的父标签
  useEffect(() => {
    if (!selectedParentId && tagTree?.length > 0) {
      setSelectedParentId(String(tagTree[0].id));
    }
  }, [tagTree, selectedParentId]);

  const handleCreateParent = useCallback(async () => {
    const name = parentName.trim();
    if (!name) return;
    await onCreateParent?.(name);
    setParentName('');
  }, [parentName, onCreateParent]);

  const handleCreateChild = useCallback(async () => {
    const name = childName.trim();
    if (!name || !selectedParentId) return;
    await onCreateChild?.(name, Number(selectedParentId));
    setChildName('');
  }, [childName, selectedParentId, onCreateChild]);

  const parentOptions = useMemo(() => {
    return tagTree?.filter((g) => g.level === 1) || [];
  }, [tagTree]);

  return (
    <div className="space-y-4 rounded-xl border border-clay/15 bg-white/60 p-4">
      {/* 新增一级标签 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-ink/60">
          <FolderOpen className="h-3.5 w-3.5" />
          <span>新增一级标签</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateParent();
              }}
              placeholder="例如：项目类型、客户行业..."
              className="h-9 pr-8 text-sm"
              disabled={saving}
            />
            {parentName && (
              <button
                onClick={() => setParentName('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            type="button"
            onClick={handleCreateParent}
            disabled={saving || !parentName.trim()}
            className="h-9 gap-1.5 bg-moss px-3 text-xs hover:bg-moss/90"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </Button>
        </div>
      </div>

      <div className="h-px bg-clay/10" />

      {/* 新增二级标签 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-ink/60">
          <Tag className="h-3.5 w-3.5" />
          <span>新增二级标签</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChild();
              }}
              placeholder="例如：品牌海报、电商详情页..."
              className="h-9 pr-8 text-sm"
              disabled={saving}
            />
            {childName && (
              <button
                onClick={() => setChildName('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            disabled={saving || parentOptions.length === 0}
            className="h-9 w-32 shrink-0 cursor-pointer rounded-md border border-clay/20 bg-white px-2 text-xs text-ink outline-none transition-colors hover:border-clay/30 focus:border-moss/50 focus:ring-2 focus:ring-moss/10 disabled:cursor-not-allowed disabled:bg-clay/5 disabled:opacity-50"
          >
            {parentOptions.length === 0 ? (
              <option value="">请先创建一级标签</option>
            ) : (
              parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))
            )}
          </select>
          <Button
            type="button"
            onClick={handleCreateChild}
            disabled={saving || !childName.trim() || !selectedParentId}
            className="h-9 gap-1.5 bg-moss px-3 text-xs hover:bg-moss/90"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </Button>
        </div>
      </div>
    </div>
  );
}

// 统计信息
function TagStats({ tagTree }) {
  const stats = useMemo(() => {
    const parentCount = tagTree?.filter((g) => g.level === 1).length || 0;
    const childCount =
      tagTree?.reduce((acc, g) => acc + (g.children?.length || 0), 0) || 0;
    const totalImages =
      tagTree?.reduce((acc, g) => acc + (g.count || 0), 0) || 0;
    return { parentCount, childCount, totalImages };
  }, [tagTree]);

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border border-clay/15 bg-white/60 p-3">
      <div className="text-center">
        <div className="text-lg font-bold text-moss">{stats.parentCount}</div>
        <div className="text-[10px] text-ink/50">一级标签</div>
      </div>
      <div className="border-x border-clay/10 text-center">
        <div className="text-lg font-bold text-moss">{stats.childCount}</div>
        <div className="text-[10px] text-ink/50">二级标签</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-moss">{stats.totalImages}</div>
        <div className="text-[10px] text-ink/50">关联图片</div>
      </div>
    </div>
  );
}

// 主组件
export function TagManagerPanel({
  open,
  saving,
  tagTree,
  onClose,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}) {
  // 编辑状态
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  // 默认展开所有
  useEffect(() => {
    if (open && tagTree?.length > 0) {
      setExpandedIds(new Set(tagTree.map((g) => g.id)));
    }
  }, [open, tagTree]);

  // 折叠/展开
  const handleToggle = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 开始编辑
  const handleStartEdit = useCallback((tag) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
  }, []);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingTagId(null);
    setEditingName('');
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(
    async (tag) => {
      const name = editingName.trim();
      if (!name || name === tag.name) {
        handleCancelEdit();
        return;
      }

      await onUpdateTag?.({
        tagId: tag.id,
        name,
        ...(tag.level === 2 && tag.parentId
          ? { parentId: tag.parentId }
          : {}),
      });
      handleCancelEdit();
    },
    [editingName, onUpdateTag, handleCancelEdit]
  );

  // 创建一级标签
  const handleCreateParent = useCallback(
    async (name) => {
      await onCreateTag?.({ name, level: 1 });
    },
    [onCreateTag]
  );

  // 创建二级标签
  const handleCreateChild = useCallback(
    async (name, parentId) => {
      await onCreateTag?.({ name, level: 2, parentId });
      // 自动展开父标签
      setExpandedIds((prev) => new Set([...prev, parentId]));
    },
    [onCreateTag]
  );

  // 删除标签
  const handleDelete = useCallback(
    async (tagId) => {
      const tag = tagTree
        ?.flatMap((g) => [g, ...(g.children || [])])
        .find((t) => t.id === tagId);

      if (!tag) return;

      const isParent = tag.level === 1;
      const hasChildren = isParent && (tag.children?.length || 0) > 0;

      if (hasChildren) {
        alert('请先删除该分类下的所有二级标签');
        return;
      }

      const confirmed = window.confirm(
        `确定要删除标签"${tag.name}"吗？\n${
          tag.count > 0
            ? `该标签关联了 ${tag.count} 张图片，删除后将从这些图片中移除。`
            : ''
        }`
      );

      if (confirmed) {
        await onDeleteTag?.(tagId);
      }
    },
    [tagTree, onDeleteTag]
  );

  if (!open) return null;

  const hasTags = tagTree?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#fbfdf8] shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-clay/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">标签管理</h2>
            <p className="text-xs text-ink/50">管理图片分类标签</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-clay/10 hover:text-ink/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 space-y-4 overflow-auto p-5">
          {/* 统计 */}
          <TagStats tagTree={tagTree} />

          {/* 新增表单 */}
          <CreateTagSection
            tagTree={tagTree}
            onCreateParent={handleCreateParent}
            onCreateChild={handleCreateChild}
            saving={saving}
          />

          {/* 标签列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-ink/60">标签列表</h3>
              {hasTags && (
                <button
                  onClick={() => {
                    const allIds = tagTree.map((g) => g.id);
                    const allExpanded = allIds.every((id) =>
                      expandedIds.has(id)
                    );
                    setExpandedIds(
                      allExpanded ? new Set() : new Set(allIds)
                    );
                  }}
                  className="text-[10px] text-moss hover:underline"
                >
                  {tagTree.every((g) => expandedIds.has(g.id))
                    ? '全部折叠'
                    : '全部展开'}
                </button>
              )}
            </div>

            {hasTags ? (
              <div className="space-y-3">
                {tagTree.map((group) => (
                  <div key={group.id} className="group">
                    <ParentTagCard
                      group={group}
                      isExpanded={expandedIds.has(group.id)}
                      onToggle={() => handleToggle(group.id)}
                      editingTagId={editingTagId}
                      editingName={editingName}
                      onStartEdit={handleStartEdit}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDelete={handleDelete}
                      onEditingNameChange={setEditingName}
                      tagTree={tagTree}
                      saving={saving}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-clay/30 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay/10">
                  <Tags className="h-5 w-5 text-ink/30" />
                </div>
                <p className="mb-1 text-sm text-ink/60">还没有标签</p>
                <p className="text-xs text-ink/40">
                  在上方创建你的第一个标签
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="border-t border-clay/10 bg-white/60 px-5 py-3">
          <div className="flex items-center justify-between text-xs text-ink/40">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>系统标签不可编辑或删除</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TagManagerPanel;
