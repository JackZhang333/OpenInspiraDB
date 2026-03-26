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
  let detailCallCount = 0;
  let createTagCallCount = 0;
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
      async getImageDetail(imageId) {
        detailCallCount += 1;
        if (typeof options.onGetImageDetail === 'function') {
          return options.onGetImageDetail(imageId);
        }

        return options.detailResult ?? {
          image: { id: imageId, original_file_name: 'detail.png' },
          activeCaption: { content: 'detail caption' },
          effectiveTags: [],
        };
      },
      async createTag(payload) {
        createTagCallCount += 1;
        if (typeof options.onCreateTag === 'function') {
          return options.onCreateTag(payload);
        }

        return options.createTagResult ?? { id: 88, ...payload };
      },
      async exportImage(imageId) {
        if (typeof options.onExportImage === 'function') {
          return options.onExportImage(imageId);
        }

        return options.exportImageResult ?? {
          canceled: false,
          imageId,
          filePath: '/tmp/exported-image.jpg',
          warnings: [],
        };
      },
      async exportImages(imageIds) {
        if (typeof options.onExportImages === 'function') {
          return options.onExportImages(imageIds);
        }

        return options.exportImagesResult ?? {
          canceled: false,
          exportedCount: Array.isArray(imageIds) ? imageIds.length : 0,
          failedCount: 0,
          warningCount: 0,
          exported: [],
          failed: [],
        };
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
    selectedImageId: options.initialSelectedImageId ?? null,
    detail: options.initialDetail ?? null,
  });

  return {
    store,
    getSearchCallCount: () => searchCallCount,
    getDetailCallCount: () => detailCallCount,
    getCreateTagCallCount: () => createTagCallCount,
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

test('single image export counts warnings from the result payload and shows a warning toast', async () => {
  const harness = await createStoreHarness({
    onExportImage: async (imageId) => ({
      canceled: false,
      imageId,
      filePath: `/tmp/export-${imageId}.jpg`,
      warnings: [{ code: 'EXPORT_METADATA_WRITE_FAILED' }],
    }),
  });

  const result = await harness.store.getState().exportImage(42);

  assert.equal(result.canceled, false);
  assert.equal(result.imageId, 42);
  assert.equal(harness.store.getState().saving, false);
  assert.equal(harness.store.getState().toast?.type, 'warning');
  assert.equal(typeof harness.store.getState().toast?.message, 'string');
  assert.ok(harness.store.getState().toast.message.length > 0);
});

test('single image export treats skipped metadata write-back as a normal success', async () => {
  const harness = await createStoreHarness({
    onExportImage: async (imageId) => ({
      canceled: false,
      imageId,
      filePath: `/tmp/export-${imageId}.png`,
      writeMode: 'skipped',
      warnings: [],
    }),
  });

  const result = await harness.store.getState().exportImage(42);

  assert.equal(result.canceled, false);
  assert.equal(harness.store.getState().saving, false);
  assert.equal(harness.store.getState().toast?.type, 'success');
  assert.equal(typeof harness.store.getState().toast?.message, 'string');
  assert.ok(harness.store.getState().toast.message.length > 0);
});

test('batch export can derive warning count from exported items when summary count is absent', async () => {
  const harness = await createStoreHarness({
    initialItems: [{ id: 7 }, { id: 8 }],
    onExportImages: async () => ({
      canceled: false,
      exportedCount: 2,
      failedCount: 0,
      exported: [
        { imageId: 7, warnings: [{ code: 'EXPORT_METADATA_WRITE_FAILED' }] },
        { imageId: 8, warnings: [] },
      ],
      failed: [],
    }),
  });

  const result = await harness.store.getState().exportCurrentResultBatch();

  assert.equal(result.canceled, false);
  assert.equal(harness.store.getState().saving, false);
  assert.equal(harness.store.getState().toast?.type, 'warning');
  assert.equal(typeof harness.store.getState().toast?.message, 'string');
  assert.ok(harness.store.getState().toast.message.length > 0);
});

test('createTag can defer refresh so image edit drafts are saved in one submit', async () => {
  const harness = await createStoreHarness({
    initialSelectedImageId: 42,
    onCreateTag: async (payload) => ({
      id: 91,
      ...payload,
    }),
  });

  const result = await harness.store.getState().createTag(
    { name: '新标签', level: 2, parentId: 5 },
    { refresh: false },
  );

  assert.equal(result.id, 91);
  assert.equal(harness.getCreateTagCallCount(), 1);
  assert.equal(harness.getSearchCallCount(), 0);
  assert.equal(harness.getDetailCallCount(), 0);
  assert.equal(harness.store.getState().saving, false);
});
