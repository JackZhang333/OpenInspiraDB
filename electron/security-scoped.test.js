import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSecurityScopedBookmark,
  hasDialogSelection,
  shouldUseSecurityScopedBookmarks,
  withSecurityScopedAccess,
  withSecurityScopedDialogOptions,
} from './security-scoped.js';

test('withSecurityScopedDialogOptions only enables bookmarks for MAS builds', () => {
  assert.deepEqual(
    withSecurityScopedDialogOptions({ title: 'Export' }, false),
    { title: 'Export' },
  );
  assert.deepEqual(
    withSecurityScopedDialogOptions({ title: 'Export' }, true),
    { title: 'Export', securityScopedBookmarks: true },
  );
});

test('shouldUseSecurityScopedBookmarks only enables on macOS MAS', () => {
  assert.equal(shouldUseSecurityScopedBookmarks({ isMas: true, platform: 'darwin' }), true);
  assert.equal(shouldUseSecurityScopedBookmarks({ isMas: false, platform: 'darwin' }), false);
  assert.equal(shouldUseSecurityScopedBookmarks({ isMas: true, platform: 'linux' }), false);
});

test('getSecurityScopedBookmark extracts save and open dialog bookmarks', () => {
  assert.equal(getSecurityScopedBookmark({ bookmark: 'save-bookmark' }), 'save-bookmark');
  assert.equal(getSecurityScopedBookmark({ bookmarks: ['open-bookmark'] }), 'open-bookmark');
  assert.equal(getSecurityScopedBookmark({ bookmarks: [''] }), '');
  assert.equal(getSecurityScopedBookmark({}), '');
});

test('hasDialogSelection handles cancelation and malformed dialog payloads', () => {
  assert.equal(hasDialogSelection({ canceled: true, filePath: '/tmp/file.png' }), false);
  assert.equal(hasDialogSelection({ filePath: '/tmp/file.png' }), true);
  assert.equal(hasDialogSelection({ filePath: '' }), false);
  assert.equal(hasDialogSelection({ filePaths: ['/tmp/a.png'] }), true);
  assert.equal(hasDialogSelection({ filePaths: [] }), false);
  assert.equal(hasDialogSelection({}), false);
});

test('withSecurityScopedAccess starts and stops access around work', async () => {
  const calls = [];
  const electronApp = {
    startAccessingSecurityScopedResource(bookmark) {
      calls.push(`start:${bookmark}`);
      return () => {
        calls.push('stop');
      };
    },
  };

  const result = await withSecurityScopedAccess(electronApp, 'bookmark-data', async () => {
    calls.push('work');
    return 'done';
  });

  assert.equal(result, 'done');
  assert.deepEqual(calls, ['start:bookmark-data', 'work', 'stop']);
});

test('withSecurityScopedAccess still stops access when work fails', async () => {
  const calls = [];
  const electronApp = {
    startAccessingSecurityScopedResource() {
      calls.push('start');
      return () => {
        calls.push('stop');
      };
    },
  };

  await assert.rejects(
    () => withSecurityScopedAccess(electronApp, 'bookmark-data', async () => {
      calls.push('work');
      throw new Error('boom');
    }),
    /boom/,
  );

  assert.deepEqual(calls, ['start', 'work', 'stop']);
});
