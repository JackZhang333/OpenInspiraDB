import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Edit2,
  Save,
  Trash2,
  RotateCw,
  GripVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';
import { Textarea } from './ui/textarea.jsx';
import { Badge } from './ui/badge.jsx';

export function DetailPanel({
  media,
  onClose,
  onSave,
  onDelete,
  onRefresh,
  onDragStart,
  onDragEnd,
}) {
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [draftTags, setDraftTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHandle, setShowDragHandle] = useState(false);

  // 当 media 变化时，重置编辑状态
  useEffect(() => {
    setIsEditing(false);
    setDraftCaption(media?.caption || '');
    setDraftTags(media?.tags || []);
  }, [media?.id]);

  // 进入编辑模式
  const enterEditMode = useCallback(() => {
    setDraftCaption(media?.caption || '');
    setDraftTags(media?.tags || []);
    setIsEditing(true);
  }, [media]);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftCaption(media?.caption || '');
    setDraftTags(media?.tags || []);
    setTagInput('');
  }, [media]);

  // 保存
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave?.({
        caption: draftCaption.trim(),
        tags: draftTags,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [draftCaption, draftTags, onSave]);

  // 添加标签
  const addTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !draftTags.includes(trimmed)) {
      setDraftTags([...draftTags, trimmed]);
    }
    setTagInput('');
  }, [tagInput, draftTags]);

  // 删除标签
  const removeTag = useCallback((tagToRemove) => {
    setDraftTags(draftTags.filter((t) => t !== tagToRemove));
  }, [draftTags]);

  // 复制文本
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  // 拖拽处理
  const handleDragStart = useCallback(
    (e) => {
      setIsDragging(true);
      onDragStart?.(e, media);
    },
    [media, onDragStart]
  );

  const handleDragEnd = useCallback(
    (e) => {
      setIsDragging(false);
      onDragEnd?.(e, media);
    },
    [media, onDragEnd]
  );

  if (!media) return null;

  const statusInfo = {
    ready: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', text: '就绪' },
    analyzing: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', text: '分析中' },
    failed: { icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50', text: '失败' },
    pending: { icon: Clock, color: 'text-ink/30', bg: 'bg-ink/5', text: '等待中' },
  };

  const StatusIcon = statusInfo[media.status]?.icon || Clock;
  const statusColor = statusInfo[media.status]?.color || 'text-ink/30';
  const statusBg = statusInfo[media.status]?.bg || 'bg-ink/5';
  const statusText = statusInfo[media.status]?.text || '未知';

  return (
    <aside className="flex h-full w-[380px] flex-col border-l border-clay/20 bg-white shadow-sm">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between border-b border-clay/10 px-4 py-3">
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={enterEditMode}>
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                编辑
              </Button>
              {media.status === 'failed' && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                  重试
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                取消
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-rose-500 hover:bg-rose-50"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 图片区域 */}
        <div
          className={cn(
            'relative group cursor-move',
            isDragging && 'opacity-50'
          )}
          onMouseEnter={() => setShowDragHandle(true)}
          onMouseLeave={() => setShowDragHandle(false)}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <img
            src={media.thumbnailPath || media.filePath}
            alt={media.caption || '图片'}
            className="w-full h-auto max-h-[300px] object-contain bg-clay/5"
            draggable={false}
          />

          {/* 拖拽提示 */}
          <div
            className={cn(
              'absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity',
              showDragHandle || isDragging ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="flex flex-col items-center text-white">
              <GripVertical className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">拖拽到设计软件</span>
            </div>
          </div>

          {/* 状态标签 */}
          <div className={cn('absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full', statusBg)}>
            <StatusIcon className={cn('h-3.5 w-3.5', statusColor)} />
            <span className={cn('text-[11px] font-medium', statusColor)}>{statusText}</span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-4 space-y-5">
          {/* 标题/描述 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-ink/50 uppercase tracking-wide">
                描述
              </label>
              {media.caption && !isEditing && (
                <button
                  onClick={() => copyToClipboard(media.caption)}
                  className="p-1 rounded hover:bg-clay/10 text-ink/30 hover:text-ink/60"
                  title="复制"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
            {isEditing ? (
              <Textarea
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                placeholder="描述图片内容..."
                className="min-h-[100px] text-[13px]"
              />
            ) : (
              <p className="text-[13px] text-ink/80 leading-relaxed">
                {media.caption || (
                  <span className="text-ink/30 italic">
                    {media.status === 'analyzing' ? 'AI 正在生成描述...' : '暂无描述'}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-ink/50 uppercase tracking-wide">
              标签
            </label>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {draftTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pr-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 p-0.5 rounded hover:bg-moss/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="添加标签，按回车确认"
                    className="flex-1 h-9 px-3 text-[13px] rounded-lg border border-clay/20 focus:outline-none focus:ring-2 focus:ring-moss/20"
                  />
                  <Button size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                    添加
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {media.tags?.length > 0 ? (
                  media.tags.map((tag) => (
                    <Badge key={tag} variant="default">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[13px] text-ink/30 italic">
                    {media.status === 'analyzing' ? 'AI 正在提取标签...' : '暂无标签'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 文件信息 */}
          <div className="pt-4 border-t border-clay/10 space-y-2">
            <label className="text-[12px] font-medium text-ink/50 uppercase tracking-wide">
              文件信息
            </label>
            <div className="space-y-1 text-[12px] text-ink/60">
              <div className="flex justify-between">
                <span>文件名</span>
                <span className="text-ink/80 truncate max-w-[200px]" title={media.filename}>
                  {media.filename}
                </span>
              </div>
              {media.metadata?.width && media.metadata?.height && (
                <div className="flex justify-between">
                  <span>尺寸</span>
                  <span className="text-ink/80">
                    {media.metadata.width} × {media.metadata.height}
                  </span>
                </div>
              )}
              {media.metadata?.format && (
                <div className="flex justify-between">
                  <span>格式</span>
                  <span className="text-ink/80">{media.metadata.format.toUpperCase()}</span>
                </div>
              )}
              {media.metadata?.size && (
                <div className="flex justify-between">
                  <span>大小</span>
                  <span className="text-ink/80">
                    {(media.metadata.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>导入时间</span>
                <span className="text-ink/80">
                  {new Date(media.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
