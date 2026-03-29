import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  X,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Tag,
  ArrowRightLeft,
  Merge,
  Trash2,
  Plus,
  Star,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';
import { Badge } from './ui/badge.jsx';
import { Textarea } from './ui/textarea.jsx';

// 建议类型图标
const SuggestionIcon = ({ kind, className }) => {
  const icons = {
    create: Plus,
    rename: Tag,
    merge: Merge,
    move: ArrowRightLeft,
    delete: Trash2,
  };
  const Icon = icons[kind] || Sparkles;
  return <Icon className={className} />;
};

// 建议类型标签
const SuggestionKindBadge = ({ kind, t }) => {
  const labels = {
    create: t('coEvolution.kind.create'),
    rename: t('coEvolution.kind.rename'),
    merge: t('coEvolution.kind.merge'),
    move: t('coEvolution.kind.move'),
    delete: t('coEvolution.kind.delete'),
  };
  const variants = {
    create: 'bg-green-100 text-green-700 border-green-200',
    rename: 'bg-blue-100 text-blue-700 border-blue-200',
    merge: 'bg-purple-100 text-purple-700 border-purple-200',
    move: 'bg-amber-100 text-amber-700 border-amber-200',
    delete: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={cn('px-2 py-0.5 text-[11px] font-medium rounded border', variants[kind])}>
      {labels[kind] || kind}
    </span>
  );
};

// 置信度显示
const ConfidenceIndicator = ({ confidence }) => {
  const percentage = Math.round((confidence || 0) * 100);
  let colorClass = 'bg-gray-200';
  if (percentage >= 80) colorClass = 'bg-green-500';
  else if (percentage >= 60) colorClass = 'bg-amber-500';
  else if (percentage >= 40) colorClass = 'bg-orange-500';
  else colorClass = 'bg-red-500';

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-[10px] text-gray-500">{percentage}%</span>
    </div>
  );
};

// 单个建议卡片
const SuggestionCard = ({
  suggestion,
  isSelected,
  onToggle,
  disabled,
  t,
}) => {
  const { id, kind, confidence, reason, name, nextName, targetTagName, sourceTagId } = suggestion;

  // 构建操作描述
  const getOperationDescription = () => {
    switch (kind) {
      case 'create':
        return t('coEvolution.operationDescription.create', { name: name || targetTagName });
      case 'rename':
        return t('coEvolution.operationDescription.rename', { from: name, to: nextName });
      case 'merge':
        return t('coEvolution.operationDescription.merge', { from: name, to: targetTagName });
      case 'move':
        return t('coEvolution.operationDescription.move', { name: name, to: suggestion.targetParentName });
      case 'delete':
        return t('coEvolution.operationDescription.delete', { name: name });
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-moss bg-moss/5'
          : 'border-gray-200 bg-white hover:border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && onToggle(id)}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-moss border-moss'
              : 'border-gray-300 bg-white group-hover:border-gray-400'
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <SuggestionIcon kind={kind} className="w-4 h-4 text-gray-500" />
            <SuggestionKindBadge kind={kind} t={t} />
            <ConfidenceIndicator confidence={confidence} />
          </div>

          <div className="text-sm font-medium text-gray-900 mb-1">
            {getOperationDescription()}
          </div>

          {reason && (
            <div className="text-xs text-gray-500 leading-relaxed">
              {reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 用户评分组件
const RatingStars = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange?.(star === value ? null : star)}
          className="p-0.5 transition-colors"
        >
          <Star
            className={cn(
              'w-5 h-5 transition-colors',
              star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
};

export function CoEvolutionPanel({
  isOpen,
  onClose,
  session,
  loading,
  error,
  onStart,
  onApply,
  onCancel,
  onToggleSuggestion,
  onSelectAll,
  onClearSelections,
}) {
  const { t } = useTranslation();
  const [userRating, setUserRating] = React.useState(null);
  const [userComments, setUserComments] = React.useState('');

  if (!isOpen) return null;

  const { suggestions = [], selectedIds = [], stats } = session || {};
  const hasSuggestions = suggestions.length > 0;
  const selectedCount = selectedIds.length;

  // 开始分析视图
  if (!session && !loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('coEvolution.title')}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-moss/10 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-moss" />
              </div>
              <p className="text-gray-600 mb-6">{t('coEvolution.description')}</p>

              {error && (
                <div className="w-full p-3 mb-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                    <span className="text-sm text-red-600">{error}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={onStart}
                disabled={loading}
                className="bg-moss hover:bg-moss/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('coEvolution.analyzing')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('coEvolution.startAnalysis')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 分析中视图
  if (loading || session?.status === 'analyzing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-moss/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-moss animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('coEvolution.analyzing')}</h3>
            <p className="text-sm text-gray-500">{t('coEvolution.analyzingDescription')}</p>

            <button
              onClick={onCancel}
              className="mt-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 结果确认视图
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-moss/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-moss" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('coEvolution.suggestions')}</h2>
              {stats && (
                <p className="text-xs text-gray-500">
                  {t('coEvolution.stats', {
                    parentCount: stats.parentCount,
                    childCount: stats.childCount,
                    maxParents: stats.maxParentTags,
                  })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasSuggestions ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('coEvolution.noSuggestions')}</p>
            </div>
          ) : (
            <>
              {/* 工具栏 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSelectAll}
                  >
                    {t('coEvolution.selectAll')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearSelections}
                  >
                    {t('coEvolution.clearSelection')}
                  </Button>
                </div>
                <span className="text-sm text-gray-500">
                  {t('coEvolution.selectedCount', { count: selectedCount, total: suggestions.length })}
                </span>
              </div>

              {/* 建议列表 */}
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    isSelected={selectedIds.includes(suggestion.id)}
                    onToggle={onToggleSuggestion}
                    t={t}
                  />
                ))}
              </div>

              {/* 用户反馈 */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('coEvolution.rateSuggestions')}
                </label>
                <RatingStars value={userRating} onChange={setUserRating} />

                <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                  {t('coEvolution.comments')}
                </label>
                <Textarea
                  value={userComments}
                  onChange={(e) => setUserComments(e.target.value)}
                  placeholder={t('coEvolution.commentsPlaceholder')}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>

          {hasSuggestions && (
            <Button
              onClick={() => onApply?.({ userRating, userComments })}
              disabled={selectedCount === 0}
              className="bg-moss hover:bg-moss/90"
            >
              {t('coEvolution.applySelected', { count: selectedCount })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
