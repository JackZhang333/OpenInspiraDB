import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { InspiraDBApp } from '../src/index.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForImageStatus(app, imageId, targetStatus, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const image = app.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (image && image.analysis_status === targetStatus) {
      return image;
    }
    await sleep(100);
  }

  const image = app.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
  assert.fail(`Expected image ${imageId} to reach status ${targetStatus}, got ${image?.analysis_status}`);
}

test('import -> analyze -> search -> user override rules', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-test-'));
  const app = new InspiraDBApp({ rootDir: root, autoStartQueue: true });

  try {
    const sourceDir = path.join(root, 'fixtures');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourceFile = path.join(sourceDir, 'minimal-design-poster.jpg');
    fs.writeFileSync(sourceFile, Buffer.from('fake-jpg-content-v1'));

    const importResult = await app.importFile(sourceFile);
    assert.equal(importResult.status, 'imported');
    assert.ok(importResult.image.id > 0);

    const imageId = importResult.image.id;

    await waitForImageStatus(app, imageId, 'ready', 8000);

    const detailAfterAi = app.getImageDetail(imageId);
    assert.equal(detailAfterAi.image.analysis_status, 'ready');
    assert.ok(detailAfterAi.activeCaption?.content.includes('设计参考图'));
    assert.ok(detailAfterAi.effectiveTags.length >= 1);

    const duplicateResult = await app.importFile(sourceFile);
    assert.equal(duplicateResult.status, 'duplicate');

    const updateCaptionResult = await app.updateImageCaption(imageId, '这是人工修订的品牌海报参考描述');
    assert.equal(updateCaptionResult.imageId, imageId);

    const tagResult = app.updateImageTags(imageId, ['品牌', '海报', '极简']);
    assert.equal(tagResult.activeTagSource, 'user');

    await app.rebuildImageAnalysis(imageId);
    await waitForImageStatus(app, imageId, 'ready', 8000);

    const detailAfterReanalyze = app.getImageDetail(imageId);
    assert.equal(detailAfterReanalyze.activeCaption?.source, 'user');
    assert.equal(detailAfterReanalyze.activeCaption?.content, '这是人工修订的品牌海报参考描述');
    assert.deepEqual(detailAfterReanalyze.effectiveTags.sort(), ['品牌', '极简', '海报'].sort());

    const searchResult = app.searchImages('品牌海报', ['品牌']);
    assert.ok(searchResult.total >= 1);
    assert.ok(searchResult.items.some((item) => item.id === imageId));
  } finally {
    app.close();
  }
});
