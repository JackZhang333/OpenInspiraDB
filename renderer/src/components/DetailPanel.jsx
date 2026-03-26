import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
  ZoomIn,
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

function buildEditingTagTree(tagTree, draftTags) {
  const draftTagsByParent = new Map();

  for (const draftTag of draftTags || []) {
    const parentId = Number(draftTag.parentId);
    if (!draftTagsByParent.has(parentId)) {
      draftTagsByParent.set(parentId, []);
    }
    draftTagsByParent.get(parentId).push({
      ...draftTag,
      usageCount: 0,
      isDraft: true,
    });
  }

  return (tagTree || []).map((group) => ({
    ...group,
    children: [
      ...(group.children || []),
      ...(draftTagsByParent.get(Number(group.id)) || []),
    ],
  }));
}

export function DetailPanel({
  detail,
  loading,
  saving,
  reanalyzing,
  copiedImageId,
  tagTree,
  onSaveMetadata,
  onCreateTag,
  onCopy,
  onExport,
  onReanalyze,
  onDelete,
  onOpenImagePreview,
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [caption, setCaption] = React.useState('');
  const [selectedTagIds, setSelectedTagIds] = React.useState([]);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagParentId, setNewTagParentId] = React.useState('');
  const [draftTags, setDraftTags] = React.useState([]);
  const [localError, setLocalError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const draftTagIdRef = React.useRef(-1);

  React.useEffect(() => {
    setIsEditing(false);
    setCaption(detail?.activeCaption?.content || '');
    setSelectedTagIds((detail?.effectiveTags || []).map((tag) => Number(tag.id)));
    setDraftTags([]);
    setNewTagName('');
    setLocalError('');
    setIsSubmitting(false);
    draftTagIdRef.current = -1;
    setNewTagParentId(tagTree?.[0]?.id ? String(tagTree[0].id) : '');
  }, [detail?.image?.id]);

  React.useEffect(() => {
    if (!newTagParentId && tagTree?.[0]?.id) {
      setNewTagParentId(String(tagTree[0].id));
    }
  }, [newTagParentId, tagTree]);

  const editingTagTree = React.useMemo(
    () => buildEditingTagTree(tagTree, draftTags),
    [tagTree, draftTags],
  );
  const selectedTagGroups = groupSelectedTags(isEditing ? editingTagTree : tagTree, selectedTagIds);
  const isBusy = saving || isSubmitting;

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink/40">
        {t('common.loading')}
      </div>
    );
  }

  if (!detail?.image) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-ink/40">
        {t('detailPanel.noPreview')}
      </div>
    );
  }

  const { image, activeCaption, effectiveTags, latestJob } = detail;
  const isFailed = image.analysis_status === 'failed';
  const isCopied = copiedImageId === image.id;
  const statusLabelMap = {
    ready: t('detailPanel.status.ready'),
    queued: t('detailPanel.status.queued'),
    analyzing: t('detailPanel.status.analyzing'),
    failed: t('detailPanel.status.failed'),
    imported: t('detailPanel.status.imported'),
  };

  const resetDrafts = () => {
    setCaption(activeCaption?.content || '');
    setSelectedTagIds((effectiveTags || []).map((tag) => Number(tag.id)));
    setDraftTags([]);
    setNewTagName('');
    setLocalError('');
    setIsSubmitting(false);
    draftTagIdRef.current = -1;
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

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name || !newTagParentId) {
      return;
    }

    const existingTag = editingTagTree
      .flatMap((group) => group.children || [])
      .find((tag) => String(tag.name || '').trim() === name);

    if (existingTag?.id) {
      setSelectedTagIds((currentIds) => (
        currentIds.includes(Number(existingTag.id))
          ? currentIds
          : [...currentIds, Number(existingTag.id)]
      ));
      setNewTagName('');
      return;
    }

    const nextDraftTagId = draftTagIdRef.current;
    draftTagIdRef.current -= 1;

    setDraftTags((currentTags) => [
      ...currentTags,
      {
        id: nextDraftTagId,
        name,
        parentId: Number(newTagParentId),
      },
    ]);
    setSelectedTagIds((currentIds) => (
      currentIds.includes(nextDraftTagId)
        ? currentIds
        : [...currentIds, nextDraftTagId]
    ));
    setNewTagName('');
  };

  const handleSave = async () => {
    if (!detail?.image?.id) {
      return;
    }

    const trimmedCaption = caption.trim();
    if (!trimmedCaption) {
      setLocalError(t('detailPanel.errors.emptyCaption'));
      return;
    }

    setLocalError('');
    setIsSubmitting(true);

    try {
      const nextTagIds = selectedTagIds.filter((tagId) => Number(tagId) > 0);

      for (const draftTag of draftTags) {
        if (!selectedTagIds.includes(Number(draftTag.id))) {
          continue;
        }

        const createdTag = await onCreateTag?.(
          {
            name: draftTag.name,
            level: 2,
            parentId: Number(draftTag.parentId),
          },
          { refresh: false },
        );

        if (createdTag?.id) {
          nextTagIds.push(Number(createdTag.id));
        }
      }

      await onSaveMetadata(detail.image.id, {
        caption: trimmedCaption,
        tagIds: Array.from(new Set(nextTagIds)),
      });
      setDraftTags([]);
      setIsEditing(false);
    } catch (error) {
      // Store error is surfaced globally; keep edit mode so the user can retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const shouldDelete = typeof window === 'undefined'
      ? true
      : window.confirm(t('detailPanel.deleteConfirm', { name: image.original_file_name }));

    if (!shouldDelete) {
      return;
    }

    await onDelete?.();
  };

  const handleOpenImagePreview = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenImagePreview?.(image);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-6">
          <div className="group relative overflow-hidden rounded-2xl border border-clay/10 bg-white shadow-sm">
            {image.thumbnail_data_url ? (
              <>
                <img
                  src={image.thumbnail_data_url}
                  alt={image.original_file_name}
                  className="w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleOpenImagePreview}
                  className="absolute right-3 bottom-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-ink/70 shadow-sm opacity-0 transition-all duration-200 hover:bg-white hover:text-ink group-hover:opacity-100"
                  aria-label={t('detailPanel.openImagePreview')}
                  title={t('detailPanel.openImagePreview')}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-sm text-ink/30">
                {t('detailPanel.noPreview')}
              </div>
            )}
          </div>

          {isFailed ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div>{t('detailPanel.analysisFailed')}</div>
                  {latestJob?.last_error_message ? (
                    <div className="mt-1 text-xs text-rose-600/80">{latestJob.last_error_message}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-ink/50">{t('detailPanel.description')}</h3>
              <span className="text-[11px] text-ink/30">{activeCaption?.source || t('detailPanel.ai')}</span>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className="min-h-[100px] resize-none"
                  placeholder={t('detailPanel.descriptionPlaceholder')}
                />
                {localError ? (
                  <div className="text-xs text-rose-600">{localError}</div>
                ) : null}
              </div>
            ) : activeCaption?.content ? (
              <div className="whitespace-pre-wrap rounded-xl border border-clay/10 bg-white/80 px-3.5 py-2.5 text-sm leading-5 text-ink/75">
                {activeCaption.content}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-clay/20 px-3.5 py-2.5 text-sm text-ink/30">
                {t('detailPanel.noDescription')}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-ink/50">{t('detailPanel.tags')}</h3>

            {isEditing ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                  <div className="mb-3 text-xs text-ink/45">{t('detailPanel.selectedTags')}</div>
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
                    <div className="text-xs text-ink/35">{t('detailPanel.noSelectedTags')}</div>
                  )}
                </div>

                <div className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                  <div className="mb-3 text-xs text-ink/45">{t('detailPanel.quickAddTag')}</div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <Input
                      value={newTagName}
                      onChange={(event) => setNewTagName(event.target.value)}
                      placeholder={t('detailPanel.newTagPlaceholder')}
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
                      disabled={isBusy || !newTagName.trim() || !newTagParentId}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {t('detailPanel.add')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {editingTagTree.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-clay/10 bg-white/80 p-4">
                      <div className="mb-3 text-sm font-semibold text-ink">{group.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {(group.children || []).map((tag) => {
                          const isSelected = selectedTagIds.includes(Number(tag.id));
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                                isSelected
                                  ? 'border-moss bg-moss text-white'
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
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveTags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="bg-clay/10 text-ink/60">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-ink/30">{t('sidebar.noTags')}</div>
                )}
              </>
            )}
          </section>

          <section className="space-y-2 rounded-xl border border-clay/10 bg-white/60 px-3 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink/40">{image.original_file_name}</span>
              <span className="text-ink/30">{(image.file_size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-clay/10 bg-white/80 px-6 py-4 backdrop-blur-sm">
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={handleSave} disabled={isBusy}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isBusy ? t('detailPanel.actions.saving') : t('detailPanel.actions.save')}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={handleCancelEditing} disabled={isBusy}>
                {t('detailPanel.actions.cancel')}
              </Button>
            </div>
            <Button type="button" variant="danger" className="w-full" onClick={handleDelete} disabled={isBusy}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('detailPanel.actions.delete')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reanalyzing ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-moss/15 bg-moss/5 px-4 py-4 text-sm font-medium text-moss">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('detailPanel.actions.reanalyzing')}
              </div>
            ) : (
              <>
                <Button type="button" className="w-full" onClick={handleStartEditing} disabled={saving}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {t('detailPanel.actions.edit')}
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
                    {isCopied ? t('detailPanel.actions.copied') : t('detailPanel.actions.copy')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => onExport?.(detail.image.id)}
                    disabled={saving}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {t('detailPanel.actions.export')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => onReanalyze?.()}
                    disabled={saving}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('detailPanel.actions.reanalyze')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
