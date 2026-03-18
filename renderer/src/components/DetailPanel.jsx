import React from 'react';
import { AlertCircle, Check, Copy, Download, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Textarea } from './ui/textarea.jsx';

function normalizeTags(values) {
  const inputs = Array.isArray(values) ? values : [values];
  const nextTags = [];
  const seen = new Set();

  for (const value of inputs) {
    const candidates = String(value || '')
      .split(/[,\n，、]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const tag of candidates) {
      if (seen.has(tag)) {
        continue;
      }

      seen.add(tag);
      nextTags.push(tag);
    }
  }

  return nextTags;
}

function MetadataRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-ink/40">{label}</span>
      <span className="text-right text-ink/70">{value || '-'}</span>
    </div>
  );
}

export function DetailPanel({
  detail,
  loading,
  saving,
  copiedImageId,
  onSaveMetadata,
  onCopy,
  onExport,
  onReanalyze,
  onDelete,
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [caption, setCaption] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const [tagDraft, setTagDraft] = React.useState('');
  const [localError, setLocalError] = React.useState('');
  const [removedTags, setRemovedTags] = React.useState(new Set());
  const [addedAiTags, setAddedAiTags] = React.useState(new Set());
  const tagInputRef = React.useRef(null);

  React.useEffect(() => {
    setIsEditing(false);
    setCaption(detail?.activeCaption?.content || '');
    setTags(normalizeTags(detail?.effectiveTags || []));
    setTagDraft('');
    setLocalError('');
    setRemovedTags(new Set());
    setAddedAiTags(new Set());
  }, [detail?.image?.id]);

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
    setTags(normalizeTags(effectiveTags || []));
    setTagDraft('');
    setLocalError('');
    setRemovedTags(new Set());
    setAddedAiTags(new Set());
  };

  const handleStartEditing = () => {
    resetDrafts();
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    resetDrafts();
    setIsEditing(false);
  };

  const handleAddTag = (value = tagDraft, isAiTag = false) => {
    const nextTags = normalizeTags(value);
    if (!nextTags.length) {
      return;
    }

    setTags((currentTags) => {
      const newTags = normalizeTags([...currentTags, ...nextTags]);
      return newTags;
    });
    setTagDraft('');
    setLocalError('');

    if (isAiTag) {
      nextTags.forEach(tag => setAddedAiTags(prev => new Set(prev).add(tag)));
    }
  };

  const handleRemoveTag = (tagToRemove, isAiTag = false) => {
    setTags((currentTags) => currentTags.filter((tag) => tag !== tagToRemove));
    if (!isAiTag) {
      setRemovedTags(prev => new Set(prev).add(tagToRemove));
    }
    setAddedAiTags(prev => {
      const next = new Set(prev);
      next.delete(tagToRemove);
      return next;
    });
  };

  const handleTagKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleAddTag();
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
        tags,
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

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-6">
          {/* Image preview */}
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

          {/* Status badges */}
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

          {/* Error message */}
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

          {/* Caption section */}
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

          {/* Tags section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">标签</h3>

            {isEditing ? (
              <div className="space-y-4">
                {/* Tag input */}
                <div className="flex gap-2">
                  <Input
                    ref={tagInputRef}
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="输入标签，回车或逗号分隔"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => handleAddTag()}
                    disabled={saving || !normalizeTags(tagDraft).length}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Current tags */}
                <div className="flex flex-wrap gap-2">
                  {tags.length ? (
                    tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          'group inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all',
                          addedAiTags.has(tag)
                            ? 'bg-moss/20 text-moss'
                            : 'bg-moss/10 text-moss hover:bg-moss/20'
                        )}
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag, addedAiTags.has(tag))}
                          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-moss/30"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <div className="text-xs text-ink/35">暂无标签，添加后会在提交时统一保存</div>
                  )}
                </div>

                {/* AI suggested tags */}
                {aiSuggestedTags?.length ? (
                  <div className="space-y-2 rounded-xl border border-clay/10 bg-clay/5 p-3">
                    <div className="text-xs text-ink/50">AI 推荐标签</div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestedTags.map((tag) => {
                        const exists = tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => !exists && handleAddTag(tag, true)}
                            disabled={exists}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                              exists
                                ? 'bg-moss/10 text-moss cursor-default'
                                : 'bg-white text-ink/70 hover:bg-moss/10 hover:text-moss border border-clay/20'
                            )}
                          >
                            {exists ? (
                              <>
                                <Check className="h-3 w-3" />
                                {tag}
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                {tag}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {effectiveTags?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveTags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
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
                        <Badge key={tag} className="bg-clay/10 text-ink/55">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* File info section */}
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

      {/* Bottom action bar - fixed at bottom */}
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
