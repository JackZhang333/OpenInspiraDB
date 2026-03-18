import React from 'react';
import { AlertCircle, Download, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, X } from 'lucide-react';
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
  onSaveMetadata,
  onExport,
  onReanalyze,
  onDelete,
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [caption, setCaption] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const [tagDraft, setTagDraft] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  React.useEffect(() => {
    setIsEditing(false);
    setCaption(detail?.activeCaption?.content || '');
    setTags(normalizeTags(detail?.effectiveTags || []));
    setTagDraft('');
    setLocalError('');
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
  };

  const handleStartEditing = () => {
    resetDrafts();
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    resetDrafts();
    setIsEditing(false);
  };

  const handleAddTag = (value = tagDraft) => {
    const nextTags = normalizeTags(value);
    if (!nextTags.length) {
      return;
    }

    setTags((currentTags) => normalizeTags([...currentTags, ...nextTags]));
    setTagDraft('');
    setLocalError('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags((currentTags) => currentTags.filter((tag) => tag !== tagToRemove));
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

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? '保存中...' : '提交修改'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleCancelEditing} disabled={saving}>
                取消
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                删除图片
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" onClick={handleStartEditing} disabled={saving}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                编辑信息
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onExport?.(detail.image.id)}
                disabled={saving}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出图片
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onReanalyze?.()} disabled={saving}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                重新分析
              </Button>
            </>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-moss" />
            <h3 className="text-sm font-semibold text-ink">描述</h3>
          </div>
          {isEditing ? (
            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className="min-h-[140px]"
              placeholder="输入图片描述..."
            />
          ) : activeCaption?.content ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-clay/10 bg-white/80 px-4 py-3 text-sm leading-6 text-ink/80">
              {activeCaption.content}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-clay/20 px-4 py-3 text-sm text-ink/35">
              暂无描述
            </div>
          )}
          {localError ? (
            <div className="text-xs text-rose-600">{localError}</div>
          ) : null}
          {activeCaption?.source ? (
            <div className="text-xs text-ink/35">当前描述来源：{activeCaption.source}</div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">标签</h3>

          {isEditing ? (
            <>
              <div className="flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-3 py-1 text-xs font-medium text-moss transition-colors hover:bg-moss/20"
                    >
                      <span>{tag}</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-ink/35">暂无标签，添加后会在提交时统一保存</div>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="输入标签后回车或点击新增"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleAddTag()}
                  disabled={saving || !normalizeTags(tagDraft).length}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新增
                </Button>
              </div>

              <div className="text-xs text-ink/35">支持逐个新增，也支持粘贴多个标签后一次加入。</div>

              {aiSuggestedTags?.length ? (
                <div className="space-y-2">
                  <div className="text-xs text-ink/35">AI 推荐标签</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestedTags.map((tag) => {
                      const exists = tags.includes(tag);

                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          disabled={exists}
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                            exists
                              ? 'cursor-default bg-moss/10 text-moss'
                              : 'bg-clay/10 text-ink/55 hover:bg-clay/20',
                          )}
                        >
                          {exists ? `${tag} 已添加` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
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
  );
}
