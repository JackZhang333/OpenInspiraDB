import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getImportProgressSnapshot,
  getImportProgressVisualState,
  isSingleImportSettling,
  shouldAnimateImportIcon,
} from '../renderer/src/lib/import-progress.js';

test('single import remains visually indeterminate while completed progress is settling', () => {
  const snapshot = getImportProgressSnapshot(true, {
    mode: 'single',
    phase: 'completed',
    current: 1,
    total: 1,
  }, (key) => ({
    'sidebar.processing': 'Processing',
    'sidebar.completed': 'Completed',
  }[key] || key));

  assert.equal(isSingleImportSettling(true, { mode: 'single', phase: 'completed' }), true);
  assert.equal(snapshot.determinate, false);
  assert.equal(snapshot.phaseLabel, 'Processing');
});

test('single import icon keeps spinning for the whole disabled interval', () => {
  const translate = (key) => ({
    'sidebar.processing': 'Processing',
    'sidebar.completed': 'Completed',
  }[key] || key);

  for (const phase of ['started', 'importing', 'analyzing', 'completed']) {
    const visualState = getImportProgressVisualState(true, {
      mode: 'single',
      phase,
      current: phase === 'completed' ? 1 : 0,
      total: 1,
    }, translate);

    assert.equal(shouldAnimateImportIcon(true, {
      mode: 'single',
      phase,
      current: phase === 'completed' ? 1 : 0,
      total: 1,
    }, visualState.snapshot), true);
    assert.equal(visualState.shouldSpin, true);
    assert.equal(visualState.forceIndeterminateRing, true);
  }
});

test('folder import keeps completed progress determinate', () => {
  const progress = {
    mode: 'folder',
    phase: 'completed',
    current: 10,
    total: 10,
  };
  const snapshot = getImportProgressSnapshot(true, progress, (key) => ({
    'sidebar.processing': 'Processing',
    'sidebar.completed': 'Completed',
  }[key] || key));

  assert.equal(snapshot.determinate, true);
  assert.equal(snapshot.label, '100%');
  assert.equal(snapshot.phaseLabel, 'Completed');
  assert.equal(shouldAnimateImportIcon(true, progress, snapshot), false);
  assert.equal(getImportProgressVisualState(true, progress).forceIndeterminateRing, false);
});
