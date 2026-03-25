export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function isSingleImport(importProgress) {
  if (!importProgress) {
    return false;
  }

  return String(importProgress.mode || 'single') === 'single';
}

export function isSingleImportSettling(importing, importProgress) {
  if (!importing || !isSingleImport(importProgress)) {
    return false;
  }

  return String(importProgress.phase || '') === 'completed';
}

export function getImportProgressSnapshot(importing, importProgress, t) {
  if (!importing || !importProgress) {
    return {
      determinate: false,
      ratio: 0,
      label: '',
      phaseLabel: '',
    };
  }

  if (isSingleImportSettling(importing, importProgress)) {
    return {
      determinate: false,
      ratio: 0,
      label: t ? t('sidebar.processing') : '处理中',
      phaseLabel: t ? t('sidebar.processing') : '处理中',
    };
  }

  const phase = String(importProgress.phase || '');
  if (phase === 'completed') {
    return {
      determinate: true,
      ratio: 1,
      label: '100%',
      phaseLabel: t ? t('sidebar.completed') : '已完成',
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
      ? t ? t('sidebar.aiAnalyzing') : '分析中'
      : phase === 'importing'
        ? t ? t('sidebar.importing') : '导入中'
        : t ? t('sidebar.processing') : '处理中';

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
    label: t ? t('sidebar.processing') : '处理中',
    phaseLabel: t ? t('sidebar.processing') : '处理中',
  };
}

export function shouldAnimateImportIcon(importing, importProgress, snapshot = null) {
  if (!importing) {
    return false;
  }

  if (isSingleImport(importProgress)) {
    return true;
  }

  const resolvedSnapshot = snapshot || getImportProgressSnapshot(importing, importProgress);
  return !resolvedSnapshot.determinate;
}

export function getImportProgressVisualState(importing, importProgress, t) {
  const snapshot = getImportProgressSnapshot(importing, importProgress, t);
  const isSingle = isSingleImport(importProgress);

  return {
    snapshot,
    shouldSpin: shouldAnimateImportIcon(importing, importProgress, snapshot),
    forceIndeterminateRing: importing && isSingle,
  };
}
