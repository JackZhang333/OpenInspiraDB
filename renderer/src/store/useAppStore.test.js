import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const storeModuleUrl = pathToFileURL(path.resolve(process.cwd(), 'renderer/src/store/useAppStore.js')).href;

async function loadFreshStoreModule() {
  return import(`${storeModuleUrl}?t=${Date.now()}-${Math.random()}`);
}

async function createStoreHarness(options = {}) {
  const listeners = new Set();
  let searchCallCount = 0;
  let lastSearchPayload = null;
  let currentItems = Array.isArray(options.initialItems) ? options.initialItems : [];
  const availableTags = Array.isArray(options.availableTags) ? options.availableTags : [];
  const importResult = options.importResult ?? { status: 'imported', image: { id: 101 } };

  global.window = {
    inspira: {
      onImportProgress(callback) {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
      async importFile() {
        if (typeof options.onImportFile === 'function') {
          return options.onImportFile({
            emit(payload) {
              for (const listener of listeners) {
                listener(payload);
              }
            },
          });
        }

        for (const listener of listeners) {
          listener({ mode: 'single', phase: 'started', current: 0, total: 1 });
        }
        for (const listener of listeners) {
          listener({ mode: 'single', phase: 'completed', current: 1, total: 1 });
        }
        return importResult;
      },
      async search(payload) {
        searchCallCount += 1;
        lastSearchPayload = payload;
        if (typeof options.onSearch === 'function') {
          const next = await options.onSearch({
            callCount: searchCallCount,
            payload,
            currentItems,
          });
          if (Array.isArray(next)) {
            currentItems = next;
          }
        }

        return {
          total: currentItems.length,
          page: Number(payload?.page || 1),
          pageSize: Number(payload?.pageSize || 50),
          items: currentItems,
        };
      },
      async getFilterTags() {
        return availableTags;
      },
    },
  };

  const { useAppStore } = await loadFreshStoreModule();
  const store = useAppStore;
  store.setState({
    query: options.initialQuery ?? 'poster',
    selectedTagIds: options.initialSelectedTagIds ?? [12],
    selectedTags: options.initialSelectedTags ?? [{ id: 12, name: '已选标签' }],
    expandedParentTagIds: options.initialExpandedParentTagIds ?? [5],
    page: options.initialPage ?? 3,
    pageSize: 50,
    result: { total: currentItems.length, items: currentItems },
    availableTags,
    importing: false,
    importProgress: null,
    error: null,
    toast: null,
  });

  return {
    store,
    getSearchCallCount: () => searchCallCount,
    getLastSearchPayload: () => lastSearchPayload,
  };
}

test('single import keeps importing true until the imported image appears in the list', async () => {
  const harness = await createStoreHarness({
    onSearch: ({ callCount }) => (callCount >= 2 ? [{ id: 101, original_file_name: 'new.png' }] : []),
  });

  const importPromise = harness.store.getState().importFile();
  await Promise.resolve();
  assert.equal(harness.store.getState().importing, true);

  await importPromise;

  const state = harness.store.getState();
  assert.equal(state.importing, false);
  assert.equal(state.importProgress, null);
  assert.ok((state.result.items || []).some((item) => item.id === 101));
  assert.equal(harness.getSearchCallCount() >= 2, true);
});

test('single import seeds a 0 percent progress state before progress events arrive', async () => {
  const harness = await createStoreHarness({
    onImportFile: async () => new Promise(() => {}),
  });

  void harness.store.getState().importFile();
  await Promise.resolve();

  const state = harness.store.getState();
  assert.equal(state.importing, true);
  assert.equal(state.importProgress?.mode, 'single');
  assert.equal(state.importProgress?.phase, 'started');
  assert.equal(state.importProgress?.current, 0);
  assert.equal(state.importProgress?.total, 1);
});

test('single import clears query, selected tags, expanded parents, and resets page before settling refresh', async () => {
  const harness = await createStoreHarness({
    onSearch: ({ callCount, payload }) => {
      if (callCount === 1) {
        assert.equal(payload.query, '');
        assert.deepEqual(payload.selectedTagIds, []);
        assert.equal(payload.page, 1);
      }
      return [{ id: 101, original_file_name: 'new.png' }];
    },
  });

  await harness.store.getState().importFile();

  const state = harness.store.getState();
  assert.equal(state.query, '');
  assert.deepEqual(state.selectedTagIds, []);
  assert.deepEqual(state.selectedTags, []);
  assert.deepEqual(state.expandedParentTagIds, []);
  assert.equal(state.page, 1);
});

test('single import stops correctly when canceled', async () => {
  const harness = await createStoreHarness({
    importResult: { canceled: true },
  });

  const result = await harness.store.getState().importFile();

  assert.equal(result.canceled, true);
  assert.equal(harness.store.getState().importing, false);
  assert.equal(harness.store.getState().importProgress, null);
  assert.equal(harness.getSearchCallCount(), 0);
});

test('single import shows a warning toast and stops after bounded retries when the image never appears', async () => {
  const harness = await createStoreHarness({
    onSearch: () => [],
  });

  await harness.store.getState().importFile();

  const state = harness.store.getState();
  assert.equal(state.importing, false);
  assert.equal(state.importProgress, null);
  assert.equal(harness.getSearchCallCount(), 12);
  assert.equal(state.toast?.type, 'warning');
  assert.equal(typeof state.toast?.message, 'string');
  assert.ok(state.toast.message.length > 0);
});

test('single import stops correctly when the import request fails', async () => {
  const harness = await createStoreHarness({
    onImportFile: async ({ emit }) => {
      emit({ mode: 'single', phase: 'started', current: 0, total: 1 });
      throw new Error('boom');
    },
  });

  await assert.rejects(() => harness.store.getState().importFile(), /boom/);

  const state = harness.store.getState();
  assert.equal(state.importing, false);
  assert.equal(state.importProgress, null);
  assert.equal(typeof state.error, 'string');
  assert.ok(state.error.length > 0);
});
