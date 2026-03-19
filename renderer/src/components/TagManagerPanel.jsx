import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  FolderOpen,
  Tag,
  AlertCircle,
  LayoutGrid,
  Palette,
  Megaphone,
  Code,
  Briefcase,
  Camera,
  PenTool,
  Globe,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';

// 图标映射（为一级标签分配不同图标）
const TAG_ICONS = [
  { icon: Megaphone, bg: 'bg-rose-50', color: 'text-rose-600' },
  { icon: Code, bg: 'bg-blue-50', color: 'text-blue-600' },
  { icon: Palette, bg: 'bg-purple-50', color: 'text-purple-600' },
  { icon: LayoutGrid, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  { icon: Briefcase, bg: 'bg-amber-50', color: 'text-amber-600' },
  { icon: Camera, bg: 'bg-cyan-50', color: 'text-cyan-600' },
  { icon: PenTool, bg: 'bg-pink-50', color: 'text-pink-600' },
  { icon: Globe, bg: 'bg-indigo-50', color: 'text-indigo-600' },
  { icon: Layers, bg: 'bg-orange-50', color: 'text-orange-600' },
  { icon: Sparkles, bg: 'bg-teal-50', color: 'text-teal-600' },
];

function getTagIcon(index) {
  return TAG_ICONS[index % TAG_ICONS.length];
}

// 格式化相对时间
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

// 高亮匹配文本
function HighlightText({ text, query, className }) {
  if (!query.trim()) return <span className={className}>{text}</span>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="rounded bg-moss/20 px-0.5 font-medium text-moss">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// 二级标签徽章组件
function ChildTagBadge({
  tag,
  editingTagId,
  editingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingNameChange,
  saving,
  searchQuery,
}) {
  const isEditing = editingTagId === tag.id;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-moss/[0.06] px-3 py-2 ring-1 ring-moss/15">
        <input
          ref={inputRef}
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveEdit(tag);
            if (e.key === 'Escape') onCancelEdit();
          }}
          className="h-6 w-24 border-0 bg-transparent p-0 text-sm outline-none"
        />
        <button
          onClick={() => onSaveEdit(tag)}
          disabled={saving || !editingName.trim()}
          className="flex h-5 w-5 items-center justify-center rounded text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onCancelEdit}
          className="flex h-5 w-5 items-center justify-center rounded text-ink/40 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-2 rounded-lg bg-clay/5 px-3 py-2 transition-colors hover:bg-clay/10">
      <HighlightText
        text={tag.name}
        query={searchQuery}
        className="text-sm text-ink/80"
      />

      {showDeleteConfirm ? (
        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1">
          <button
            onClick={() => {
              onDelete(tag.id);
              setShowDeleteConfirm(false);
            }}
            className="flex h-5 w-5 items-center justify-center rounded bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
            title="确认删除"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex h-5 w-5 items-center justify-center rounded bg-clay/10 text-ink/50 transition-colors hover:bg-clay/20"
            title="取消"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onStartEdit(tag)}
            className="flex h-5 w-5 items-center justify-center rounded text-ink/40 hover:bg-white hover:text-ink/70"
            title="编辑"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex h-5 w-5 items-center justify-center rounded text-ink/40 hover:bg-rose-50 hover:text-rose-600"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// 一级分类卡片组件
function ParentCategoryCard({
  group,
  index,
  editingTagId,
  editingName,
  addingChildToParentId,
  newChildName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingNameChange,
  onStartAddChild,
  onCancelAddChild,
  onNewChildNameChange,
  onCreateChild,
  saving,
  searchQuery,
}) {
  const isEditing = editingTagId === group.id;
  const isAddingChild = addingChildToParentId === group.id;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef(null);
  const childInputRef = useRef(null);
  const iconConfig = getTagIcon(index);
  const IconComponent = iconConfig.icon;

  // 二级标签按字母排序
  const sortedChildren = useMemo(() => {
    const children = group.children || [];
    return [...children].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [group.children]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isAddingChild && childInputRef.current) {
      childInputRef.current.focus();
    }
  }, [isAddingChild]);

  // 编辑一级标签名称
  if (isEditing) {
    return (
      <div className="rounded-2xl border border-moss/20 bg-white p-5 shadow-sm ring-1 ring-moss/10">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconConfig.bg)}>
            <IconComponent className={cn('h-5 w-5', iconConfig.color)} />
          </div>
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(group);
                if (e.key === 'Escape') onCancelEdit();
              }}
              disabled={saving || group.isSystem}
              className="h-10 text-[15px] font-semibold"
              placeholder="分类名称"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSaveEdit(group)}
              disabled={saving || !editingName.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={onCancelEdit}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/card rounded-2xl border border-clay/15 bg-white p-5 transition-all hover:border-clay/25 hover:shadow-sm">
      {/* 头部：图标 + 名称 + 操作 */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconConfig.bg)}>
            <IconComponent className={cn('h-5 w-5', iconConfig.color)} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">
              <HighlightText text={group.name} query={searchQuery} />
            </h3>
            <p className="text-xs text-ink/40">
              {group.children?.length || 0} 个二级标签 · 更新于 {formatRelativeTime(group.updatedAt)}
            </p>
          </div>
        </div>
        {!group.isSystem && (
          <div className="flex items-center gap-1">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1">
                <span className="mr-1 text-xs text-rose-600">确认删除?</span>
                <button
                  onClick={() => {
                    onDelete(group.id);
                    setShowDeleteConfirm(false);
                  }}
                  disabled={(group.children?.length || 0) > 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title={(group.children?.length || 0) > 0 ? '请先删除子标签' : '确认删除'}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-clay/10 text-ink/50 transition-colors hover:bg-clay/20"
                  title="取消"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onStartEdit(group)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 transition-colors hover:bg-clay/10 hover:text-ink/70"
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={(group.children?.length || 0) > 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title={(group.children?.length || 0) > 0 ? '请先删除子标签' : '删除'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 二级标签网格 */}
      <div className="flex flex-wrap gap-2">
        {sortedChildren.map((tag) => (
          <ChildTagBadge
            key={tag.id}
            tag={tag}
            editingTagId={editingTagId}
            editingName={editingName}
            onStartEdit={onStartEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onDelete={onDelete}
            onEditingNameChange={onEditingNameChange}
            saving={saving}
            searchQuery={searchQuery}
          />
        ))}

        {/* 添加二级标签 */}
        {isAddingChild ? (
          <div className="flex items-center gap-2 rounded-lg bg-moss/[0.06] px-3 py-2 ring-1 ring-moss/15">
            <input
              ref={childInputRef}
              value={newChildName}
              onChange={(e) => onNewChildNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateChild(group.id);
                if (e.key === 'Escape') onCancelAddChild();
              }}
              placeholder="输入标签名称"
              className="h-6 w-28 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink/35"
            />
            <button
              onClick={() => onCreateChild(group.id)}
              disabled={saving || !newChildName.trim()}
              className="flex h-5 w-5 items-center justify-center rounded text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onCancelAddChild}
              className="flex h-5 w-5 items-center justify-center rounded text-ink/40 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartAddChild(group.id)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-clay/25 px-3 py-2 text-sm text-ink/45 transition-all hover:border-moss/30 hover:bg-moss/[0.03] hover:text-moss"
          >
            <Plus className="h-3.5 w-3.5" />
            新增标签
          </button>
        )}
      </div>
    </div>
  );
}

// 添加一级分类表单
function AddParentCategoryForm({ onCreate, saving }) {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      await onCreate(trimmed);
      setName('');
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [name, onCreate]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-clay/25 py-3 text-sm font-medium text-ink/50 transition-all hover:border-moss/30 hover:bg-moss/[0.02] hover:text-moss"
      >
        <Plus className="h-4 w-4" />
        新增分类
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-moss/20 bg-moss/[0.03] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-moss/10">
        <FolderOpen className="h-5 w-5 text-moss/60" />
      </div>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') {
            setIsOpen(false);
            setName('');
          }
        }}
        placeholder="输入新的一级分类名称，例如：项目类型"
        disabled={isLoading}
        className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-ink/35 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || saving || !name.trim()}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
      >
        {isLoading || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        onClick={() => {
          setIsOpen(false);
          setName('');
        }}
        disabled={isLoading}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// 空状态组件
function EmptyState({ searchQuery }) {
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-clay/25 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay/8">
          <Search className="h-5 w-5 text-ink/25" />
        </div>
        <p className="text-sm text-ink/50">未找到匹配的标签</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-clay/25 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay/8">
        <Tag className="h-5 w-5 text-ink/25" />
      </div>
      <p className="text-sm text-ink/50">点击上方按钮创建第一个分类</p>
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
  // 状态管理
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [addingChildToParentId, setAddingChildToParentId] = useState(null);
  const [newChildName, setNewChildName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingParent, setIsCreatingParent] = useState(false);

  // 过滤标签树
  const filteredTagTree = useMemo(() => {
    if (!searchQuery.trim()) return tagTree || [];
    const query = searchQuery.toLowerCase();
    return (tagTree || []).filter((group) => {
      const matchParent = group.name.toLowerCase().includes(query);
      const matchChildren = (group.children || []).some((child) =>
        child.name.toLowerCase().includes(query)
      );
      return matchParent || matchChildren;
    });
  }, [tagTree, searchQuery]);

  // 创建一级分类
  const handleCreateParent = useCallback(
    async (name) => {
      await onCreateTag?.({ name, level: 1 });
    },
    [onCreateTag]
  );

  // 创建二级标签
  const handleCreateChild = useCallback(
    async (parentId) => {
      const name = newChildName.trim();
      if (!name || !parentId) return;
      await onCreateTag?.({ name, level: 2, parentId });
      setNewChildName('');
      setAddingChildToParentId(null);
    },
    [newChildName, onCreateTag]
  );

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
        ...(tag.level === 2 && tag.parentId ? { parentId: tag.parentId } : {}),
      });
      handleCancelEdit();
    },
    [editingName, onUpdateTag, handleCancelEdit]
  );

  // 删除标签 - 使用内联确认替代 alert
  const handleDelete = useCallback(
    async (tagId) => {
      const tag = (tagTree || [])
        .flatMap((g) => [g, ...(g.children || [])])
        .find((t) => t.id === tagId);
      if (!tag) return;

      const isParent = tag.level === 1;
      const hasChildren = isParent && (tag.children?.length || 0) > 0;

      if (hasChildren) {
        // 显示提示但不阻断（由 UI 展示）
        return;
      }

      await onDeleteTag?.(tagId);
    },
    [tagTree, onDeleteTag]
  );

  // 开始添加子标签
  const handleStartAddChild = useCallback((parentId) => {
    setAddingChildToParentId(parentId);
    setNewChildName('');
  }, []);

  // 取消添加子标签
  const handleCancelAddChild = useCallback(() => {
    setAddingChildToParentId(null);
    setNewChildName('');
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start justify-between px-8 pt-8 pb-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold text-ink">标签管理台</h2>
              <span className="text-xs font-medium text-ink/30 tracking-wider">PRIMARY CATEGORY</span>
            </div>
            <p className="mt-1 text-sm text-ink/50">在这里整理一级分类和二级标签，最后统一提交保存。</p>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="px-8 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="筛选一级分类或二级标签..."
              className="h-11 w-full rounded-xl border border-clay/15 bg-[#fafbfa] pl-11 pr-10 text-sm outline-none transition-all placeholder:text-ink/35 focus:border-moss/30 focus:bg-white focus:ring-4 focus:ring-moss/5"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink/30 hover:bg-clay/10 hover:text-ink/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 space-y-3 overflow-auto px-8 pb-6">
          {/* 新增分类按钮 - 放在内容区顶部 */}
          <AddParentCategoryForm
            onCreate={handleCreateParent}
            saving={saving}
          />

          {filteredTagTree.length === 0 ? (
            <EmptyState searchQuery={searchQuery} />
          ) : (
            <div className="grid gap-3 pt-2">
              {filteredTagTree.map((group, index) => (
                <div key={group.id} className="group/card">
                  <ParentCategoryCard
                    group={group}
                    index={index}
                    editingTagId={editingTagId}
                    editingName={editingName}
                    addingChildToParentId={addingChildToParentId}
                    newChildName={newChildName}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onDelete={handleDelete}
                    onEditingNameChange={setEditingName}
                    onStartAddChild={handleStartAddChild}
                    onCancelAddChild={handleCancelAddChild}
                    onNewChildNameChange={setNewChildName}
                    onCreateChild={handleCreateChild}
                    saving={saving}
                    searchQuery={searchQuery}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-8 pb-8 pt-2">
          <div className="flex items-center gap-2 text-xs text-ink/40">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>系统标签无法编辑或删除</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-5 py-2 text-sm font-medium text-ink/60 transition-colors hover:bg-clay/5 hover:text-ink"
            >
              取消
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-ink px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
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
