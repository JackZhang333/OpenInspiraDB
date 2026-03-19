import React from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Textarea } from './ui/textarea.jsx';

function MetadataRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-ink/40">{label}</span>
      <span className="text-right text-ink/70">{value || '-'}</span>
    </div>
  );
}

function groupSelectedTags(tagTree, selectedTagIds) {
  const selectedSet = new Set((selectedTagIds || []).map((id) => Number(id)));
  return (tagTree || [])
    .map((group) => ({
      ...group,
      children: (group.children || []).filter((tag) => selectedSet.has(Number(tag.id))),
    }))
    .filter((group) => group.children.length > 0);
}

export function DetailPanel({
  detail,
  loading,
  saving,
  copiedImageId,
  tagTree,
  onSaveMetadata,
  onCreateTag,
  onCopy,
  onExport,
  onReanalyze,
  onDelete,
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [caption, setCaption] = React.useState('');
  const [selectedTagIds, setSelectedTagIds] = React.useState([]);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagParentId, setNewTagParentId] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  React.useEffect(() => {
    setIsEditing(false);
    setCaption(detail?.activeCaption?.content || '');
    setSelectedTagIds((detail?.effectiveTags || []).map((tag) => Number(tag.id)));
    setNewTagName('');
    setLocalError('');
    setNewTagParentId(tagTree?.[0]?.id ? String(tagTree[0].id) : '');
  }, [detail?.image?.id, tagTree]);

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink/40">
        详情加载中...
      </div>
    );
  }

  if (!detail?.image) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-ink/40">
        选择一张图片查看详情
      </div>
    );
  }

  const { image, activeCaption, effectiveTags, aiSuggestedTags, latestJob } = detail;
  const isFailed = image.analysis_status === 'failed';
  const isCopied = copiedImageId === image.id;
  const statusLabelMap = {
    ready: '已就绪',
    queued: '排队中',
    analyzing: '分析中',
    failed: '失败',
    imported: '已导入',
  };

  const resetDrafts = () => {
    setCaption(activeCaption?.content || '');
    setSelectedTagIds((effectiveTags || []).map((tag) => Number(tag.id)));
    setNewTagName('');
    setLocalError('');
    setNewTagParentId(tagTree?.[0]?.id ? String(tagTree[0].id) : '');
  };

  const handleStartEditing = () => {
    resetDrafts();
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    resetDrafts();
    setIsEditing(false);
  };

  const toggleTag = (tagId) => {
    const normalizedTagId = Number(tagId);
    setSelectedTagIds((currentIds) => (
      currentIds.includes(normalizedTagId)
        ? currentIds.filter((id) => id !== normalizedTagId)
        : [...currentIds, normalizedTagId]
    ));
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || !newTagParentId) {
      return;
    }

    try {
      const tag = await onCreateTag?.({
        name,
        level: 2,
        parentId: Number(newTagParentId),
      });

      if (tag?.id) {
        setSelectedTagIds((currentIds) => (
          currentIds.includes(Number(tag.id))
            ? currentIds
            : [...currentIds, Number(tag.id)]
        ));
      }
      setNewTagName('');
      setLocalError('');
    } catch (error) {
      // Global error bar handles the message.
    }
  };

  const handleSave = async () => {
    if (!detail?.image?.id) {
      return;
    }

    const trimmedCaption = caption.trim();
    if (!trimmedCaption) {
      setLocalError('描述不能为空');
      return;
    }

    setLocalError('');

    try {
      await onSaveMetadata(detail.image.id, {
        caption: trimmedCaption,
        tagIds: selectedTagIds,
      });
      setIsEditing(false);
    } catch (error) {
      // Store error is surfaced globally; keep edit mode so the user can retry.
    }
  };

  const handleDelete = async () => {
    const shouldDelete = typeof window === 'undefined'
      ? true
      : window.confirm(`确定删除「${image.original_file_name}」吗？此操作不可撤销。`);

    if (!shouldDelete) {
      return;
    }

    await onDelete?.();
  };

  const selectedTagGroups = groupSelectedTags(tagTree, selectedTagIds);
  const aiSuggestedIdSet = new Set((aiSuggestedTags || []).map((tag) => Number(tag.id)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-6">
          <div className="overflow-hidden rounded-2xl border border-clay/10 bg-white shadow-sm">
            {image.preview_data_url ? (
              <img
                src={image.preview_data_url}
                alt={image.original_file_name}
                className="w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-sm text-ink/30">
                无预览
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-moss/10 text-moss">
              {statusLabelMap[image.analysis_status] || image.analysis_status}
            </Badge>
            {latestJob?.status ? (
              <Badge className="bg-clay/15 text-ink/55">
                最近任务: {latestJob.status}
              </Badge>
            ) : null}
          </div>

          {isFailed ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div>分析失败，可以重新触发分析。</div>
                  {latestJob?.last_error_message ? (
                    <div className="mt-1 text-xs text-rose-600/80">{latestJob.last_error_message}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-moss" />
                <h3 className="text-sm font-semibold text-ink">描述</h3>
              </div>
              {!isEditing && activeCaption?.source ? (
                <span className="text-xs text-ink/35">来源：{activeCaption.source}</span>
              ) : null}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className="min-h-[120px] resize-none"
                  placeholder="输入图片描述..."
                />
                {localError ? (
                  <div className="text-xs text-rose-600">{localError}</div>
                ) : null}
              </div>
            ) : activeCaption?.content ? (
              <div className="whitespace-pre-wrap rounded-2xl border border-clay/10 bg-white/80 px-4 py-3 text-sm leading-6 text-ink/80">
                {activeCaption.content}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-clay/20 px-4 py-3 text-sm text-ink/35">
                暂无描述
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">标签</h3>

            {isEditing ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                  <div className="mb-3 text-xs text-ink/45">已选标签</div>
                  {selectedTagGroups.length ? (
                    <div className="space-y-3">
                      {selectedTagGroups.map((group) => (
                        <div key={group.id}>
                          <div className="mb-1 text-xs font-medium text-ink/45">{group.name}</div>
                          <div className="flex flex-wrap gap-2">
                            {group.children.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-3 py-1 text-xs font-medium text-moss transition hover:bg-moss/20"
                              >
                                <span>{tag.name}</span>
                                <X className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-ink/35">暂无标签，可在下方分组中勾选</div>
                  )}
                </div>

                <div className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                  <div className="mb-3 text-xs text-ink/45">快速新增二级标签</div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <Input
                      value={newTagName}
                      onChange={(event) => setNewTagName(event.target.value)}
                      placeholder="输入新标签名称"
                    />
                    <select
                      value={newTagParentId}
                      onChange={(event) => setNewTagParentId(event.target.value)}
                      className="h-10 rounded-lg border border-clay/20 bg-white px-3 text-sm text-ink"
                    >
                      {(tagTree || []).map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCreateTag}
                      disabled={saving || !newTagName.trim() || !newTagParentId}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      新增
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(tagTree || []).map((group) => (
                    <div key={group.id} className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                      <div className="mb-3 text-sm font-semibold text-ink">{group.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {(group.children || []).map((tag) => {
                          const isSelected = selectedTagIds.includes(Number(tag.id));
                          const isAiSuggested = aiSuggestedIdSet.has(Number(tag.id));
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                                isSelected
                                  ? 'border-moss bg-moss text-white'
                                  : isAiSuggested
                                    ? 'border-moss/30 bg-moss/5 text-moss hover:bg-moss/10'
                                    : 'border-clay/20 bg-white text-ink/70 hover:bg-clay/10',
                              )}
                            >
                              {isSelected ? <Check className="h-3 w-3" /> : null}
                              <span>{tag.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {effectiveTags?.length ? (
                  <div className="space-y-2">
                    {groupSelectedTags(tagTree, (effectiveTags || []).map((tag) => Number(tag.id))).map((group) => (
                      <div key={group.id}>
                        <div className="mb-1 text-xs text-ink/35">{group.name}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.children.map((tag) => (
                            <Badge key={tag.id}>{tag.name}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-ink/35">暂无标签</div>
                )}

                {aiSuggestedTags?.length ? (
                  <div className="space-y-2">
                    <div className="text-xs text-ink/35">AI 推荐标签</div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestedTags.map((tag) => (
                        <Badge key={tag.id} className="bg-clay/10 text-ink/55">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-clay/10 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-ink">文件信息</h3>
            <MetadataRow label="原始名称" value={image.original_file_name} />
            <MetadataRow label="文件体积" value={`${(image.file_size / 1024 / 1024).toFixed(2)} MB`} />
            <MetadataRow label="分析状态" value={statusLabelMap[image.analysis_status] || image.analysis_status} />
            <MetadataRow
              label="更新时间"
              value={image.updated_at ? new Date(image.updated_at).toLocaleString('zh-CN') : '-'}
            />
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-clay/10 bg-white/80 px-6 py-4 backdrop-blur-sm">
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={handleCancelEditing} disabled={saving}>
                取消
              </Button>
            </div>
            <Button type="button" variant="danger" className="w-full" onClick={handleDelete} disabled={saving}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              删除图片
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={handleStartEditing} disabled={saving}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              编辑信息
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className={cn('flex-1', isCopied && 'bg-moss text-white hover:bg-moss/90')}
                onClick={() => onCopy?.(detail.image.id)}
                disabled={saving}
              >
                {isCopied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isCopied ? '已复制' : '复制'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => onExport?.(detail.image.id)}
                disabled={saving}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => onReanalyze?.()}
                disabled={saving}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                重新分析
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
