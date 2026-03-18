import React from 'react';
import { AlertCircle, Download, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Textarea } from './ui/textarea.jsx';

function splitTags(input) {
  return String(input || '')
    .split(/[,\n，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [caption, setCaption] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  React.useEffect(() => {
    if (!detail?.image?.id) {
      setCaption('');
      setTagsInput('');
      setLocalError('');
      return;
    }

    setCaption(detail.activeCaption?.content || '');
    setTagsInput((detail.effectiveTags || []).join(', '));
    setLocalError('');
  }, [detail]);

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
    await onSaveMetadata(detail.image.id, {
      caption: trimmedCaption,
      tags: splitTags(tagsInput),
    });
  };

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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? '保存中...' : '保存修改'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onExport?.(detail.image.id)} disabled={saving}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            导出图片
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onReanalyze?.()} disabled={saving}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            重新分析
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete?.()} disabled={saving}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除图片
          </Button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-moss" />
            <h3 className="text-sm font-semibold text-ink">描述</h3>
          </div>
          <Textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="min-h-[140px]"
            placeholder="输入图片描述..."
          />
          {localError ? (
            <div className="text-xs text-rose-600">{localError}</div>
          ) : null}
          {activeCaption?.source ? (
            <div className="text-xs text-ink/35">当前描述来源：{activeCaption.source}</div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">标签</h3>
          <Input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="用逗号分隔多个标签"
          />
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
