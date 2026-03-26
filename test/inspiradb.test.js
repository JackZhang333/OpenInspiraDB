import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';

import { InspiraDBApp } from '../src/index.js';
import { InspiraDatabase } from '../src/core/database.js';
import { createModelConfig } from '../src/model-config.js';
import { PRESET_TAXONOMY, UNCATEGORIZED_TAG_NAME } from '../src/core/tag-store.js';
import { buildEmbeddingText } from '../src/utils/embedding.js';
import { embedTextDeterministic } from '../src/utils/vector.js';

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

async function waitForQueueIdle(app, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const activeJob = app.db.get(
      `SELECT id
       FROM analysis_jobs
       WHERE status IN ('pending', 'processing', 'retrying')
       LIMIT 1`,
    );

    if (!activeJob) {
      return;
    }

    await sleep(25);
  }

  assert.fail('Expected analysis queue to become idle before shutdown');
}

function installStubbedZhipuService(app) {
  app.aiService.zhipuService.request = async (endpoint, payload = {}) => {
    if (endpoint === '/embeddings') {
      return {
        data: [
          {
            embedding: embedTextDeterministic(payload.input),
          },
        ],
      };
    }

    if (endpoint === '/chat/completions') {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                caption: '这是一张设计参考图，画面包含清晰主体、构图线索与可检索风格信息。',
                taxonomyTags: [
                  {
                    parentName: '行业 / 用途',
                    childName: '海报',
                    isNewParent: false,
                    isNewChild: false,
                  },
                  {
                    parentName: '风格',
                    childName: '极简',
                    isNewParent: false,
                    isNewChild: false,
                  },
                  {
                    parentName: '构图 / 形式',
                    childName: '留白',
                    isNewParent: false,
                    isNewChild: false,
                  },
                ],
              }),
            },
          },
        ],
      };
    }

    throw new Error(`UNSUPPORTED_TEST_ENDPOINT:${endpoint}`);
  };
}

function createTestApp(options = {}) {
  const app = new InspiraDBApp(options);
  installStubbedZhipuService(app);
  return app;
}

function assertVectorsAlmostEqual(actual, expected, epsilon = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= epsilon,
      `Vector mismatch at index ${index}: expected ${expected[index]}, got ${actual[index]}`,
    );
  }
}

function insertReadyImageWithTagIds(app, {
  fileName,
  hash,
  caption,
  tagIds,
  vector,
  source = 'ai',
  updatedAt = '2026-03-18T10:00:00.000Z',
}) {
  const now = '2026-03-18T09:00:00.000Z';
  const imageResult = app.db.run(
    `INSERT INTO images (
      original_file_name,
      source_path,
      library_path,
      thumbnail_path,
      md5_hash,
      file_size,
      width,
      height,
      import_status,
      analysis_status,
      active_tag_source,
      created_at,
      updated_at
    ) VALUES (
      :fileName,
      :sourcePath,
      :libraryPath,
      :thumbnailPath,
      :hash,
      100,
      NULL,
      NULL,
      'imported',
      'ready',
      :source,
      :createdAt,
      :updatedAt
    )`,
    {
      fileName,
      sourcePath: `/tmp/${fileName}`,
      libraryPath: `/tmp/${fileName}`,
      thumbnailPath: `/tmp/${fileName}.thumb`,
      hash,
      source,
      createdAt: now,
      updatedAt,
    },
  );

  const imageId = Number(imageResult.lastInsertRowid);
  const captionResult = app.db.run(
    `INSERT INTO captions (
      image_id,
      content,
      source,
      is_active,
      model_provider,
      model_name,
      created_at,
      updated_at
    ) VALUES (
      :imageId,
      :content,
      :source,
      1,
      'zhipu',
      'glm-test-vision',
      :createdAt,
      :updatedAt
    )`,
    {
      imageId,
      content: caption,
      source,
      createdAt: now,
      updatedAt,
    },
  );

  app.db.run(
    `UPDATE images
     SET active_caption_id = :captionId
     WHERE id = :imageId`,
    {
      imageId,
      captionId: Number(captionResult.lastInsertRowid),
    },
  );

  for (const tagId of tagIds) {
    app.db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, :source, :createdAt)`,
      {
        imageId,
        tagId,
        source,
        createdAt: now,
      },
    );
  }

  app.db.run(
    `INSERT INTO embeddings (
      image_id,
      vector,
      dimension,
      model_provider,
      model_name,
      created_at
    ) VALUES (
      :imageId,
      :vector,
      :dimension,
      'zhipu',
      'embedding-3',
      :createdAt
    )`,
    {
      imageId,
      vector: JSON.stringify(vector),
      dimension: vector.length,
      createdAt: now,
    },
  );

  return imageId;
}

function insertLegacyReadyImage(app, {
  fileName,
  hash,
  sourcePath,
  libraryPath,
  thumbnailPath,
  activeTagSource = 'ai',
  activeCaptionId = null,
  analysisStatus = 'ready',
  needsEmbeddingRefresh = 0,
  updatedAt = '2026-03-18T10:00:00.000Z',
}) {
  const createdAt = '2026-03-18T09:00:00.000Z';
  const result = app.db.run(
    `INSERT INTO images (
      original_file_name,
      source_path,
      library_path,
      thumbnail_path,
      md5_hash,
      file_size,
      width,
      height,
      import_status,
      analysis_status,
      active_caption_id,
      active_tag_source,
      needs_embedding_refresh,
      created_at,
      updated_at
    ) VALUES (
      :fileName,
      :sourcePath,
      :libraryPath,
      :thumbnailPath,
      :hash,
      100,
      NULL,
      NULL,
      'imported',
      :analysisStatus,
      :activeCaptionId,
      :activeTagSource,
      :needsEmbeddingRefresh,
      :createdAt,
      :updatedAt
    )`,
    {
      fileName,
      sourcePath,
      libraryPath,
      thumbnailPath,
      hash,
      analysisStatus,
      activeCaptionId,
      activeTagSource,
      needsEmbeddingRefresh,
      createdAt,
      updatedAt,
    },
  );

  return Number(result.lastInsertRowid);
}

function insertCaption(app, imageId, {
  content,
  source = 'ai',
  isActive = 1,
  createdAt = '2026-03-18T09:30:00.000Z',
  updatedAt = createdAt,
}) {
  const result = app.db.run(
    `INSERT INTO captions (
      image_id,
      content,
      source,
      is_active,
      model_provider,
      model_name,
      created_at,
      updated_at
    ) VALUES (
      :imageId,
      :content,
      :source,
      :isActive,
      'zhipu',
      'glm-test-vision',
      :createdAt,
      :updatedAt
    )`,
    {
      imageId,
      content,
      source,
      isActive,
      createdAt,
      updatedAt,
    },
  );

  return Number(result.lastInsertRowid);
}

test('import -> analyze -> search -> user override rules', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: true });

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
    const treeAfterAi = app.listTagTree();
    assert.ok(treeAfterAi.some((group) => group.name === '行业用途' && group.children.some((tag) => tag.name === '海报')));
    assert.ok(treeAfterAi.some((group) => group.name === '风格' && group.children.some((tag) => tag.name === '极简')));
    assert.ok(treeAfterAi.some((group) => group.name === '构图形式' && group.children.some((tag) => tag.name === '留白')));
    assert.ok(!treeAfterAi.some((group) => group.name === '色彩'));

    const duplicateResult = await app.importFile(sourceFile);
    assert.equal(duplicateResult.status, 'duplicate');

    const updateCaptionResult = await app.updateImageCaption(imageId, '这是人工修订的品牌海报参考描述');
    assert.equal(updateCaptionResult.imageId, imageId);

    const tagResult = await app.updateImageTags(imageId, ['品牌', '海报', '极简']);
    assert.equal(tagResult.activeTagSource, 'user');

    const embeddingAfterTagUpdate = app.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId });
    assertVectorsAlmostEqual(
      JSON.parse(embeddingAfterTagUpdate.vector),
      embedTextDeterministic(buildEmbeddingText('这是人工修订的品牌海报参考描述', tagResult.tagNames)),
    );

    const rebuildResult = await app.rebuildImageAnalysis(imageId);
    assert.equal(rebuildResult.status, 'ready');

    const detailAfterReanalyze = app.getImageDetail(imageId);
    assert.equal(detailAfterReanalyze.activeCaption?.source, 'user');
    assert.equal(detailAfterReanalyze.activeCaption?.content, '这是人工修订的品牌海报参考描述');
    assert.equal(detailAfterReanalyze.image.active_tag_source, 'ai');
    assert.deepEqual(
      detailAfterReanalyze.effectiveTags.map((tag) => tag.name).sort(),
      ['海报', '极简', '留白'].sort(),
    );

    const embeddingAfterReanalyze = app.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId });
    assertVectorsAlmostEqual(
      JSON.parse(embeddingAfterReanalyze.vector),
      embedTextDeterministic(buildEmbeddingText(detailAfterReanalyze.activeCaption.content, detailAfterReanalyze.effectiveTagNames)),
    );

    const searchResult = await app.searchImages('海报', ['海报']);
    assert.ok(searchResult.total >= 1);
    assert.ok(searchResult.items.some((item) => item.id === imageId));
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('startup does not seed preset taxonomy into an empty database', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-preset-tags-empty-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const tree = app.listTagTree();
    assert.ok(tree.every((group) => !PRESET_TAXONOMY.some((presetGroup) => presetGroup.name === group.name)));
    assert.ok(tree.every((group) => (
      !PRESET_TAXONOMY.some((presetGroup) => presetGroup.children.includes(group.name))
    )));
  } finally {
    app.close();
  }
});

test('startup cleans unused preset tags but preserves used preset tags', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-preset-cleanup-test-'));
  const dbPath = path.join(root, 'data', 'inspiradb.sqlite');
  const seedDb = new InspiraDatabase(dbPath);

  try {
    const imageInsert = seedDb.run(
      `INSERT INTO images (
        original_file_name,
        source_path,
        library_path,
        thumbnail_path,
        md5_hash,
        file_size,
        import_status,
        analysis_status,
        active_tag_source,
        created_at,
        updated_at
      ) VALUES (
        'used-preset.jpg',
        '/tmp/used-preset.jpg',
        '/tmp/used-preset.jpg',
        '/tmp/used-preset.jpg.thumb',
        'used-preset-hash',
        100,
        'imported',
        'ready',
        'ai',
        '2026-03-18T10:00:00.000Z',
        '2026-03-18T10:00:00.000Z'
      )`,
    );
    const imageId = Number(imageInsert.lastInsertRowid);

    seedDb.run(
      `INSERT INTO tags (
        name,
        language,
        parent_id,
        level,
        sort_order,
        is_system,
        created_at,
        updated_at
      ) VALUES (
        '风格',
        'zh',
        NULL,
        1,
        0,
        0,
        '2026-03-18T10:00:00.000Z',
        '2026-03-18T10:00:00.000Z'
      )`,
    );
    const usedParentId = Number(seedDb.get(
      `SELECT id
       FROM tags
       WHERE name = '风格'
       LIMIT 1`,
    )?.id);

    seedDb.run(
      `INSERT INTO tags (
        name,
        language,
        parent_id,
        level,
        sort_order,
        is_system,
        created_at,
        updated_at
      ) VALUES (
        '极简',
        'zh',
        :parentId,
        2,
        0,
        0,
        '2026-03-18T10:00:00.000Z',
        '2026-03-18T10:00:00.000Z'
      )`,
      { parentId: usedParentId },
    );
    const usedChildId = Number(seedDb.get(
      `SELECT id
       FROM tags
       WHERE name = '极简'
       LIMIT 1`,
    )?.id);

    seedDb.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'ai', '2026-03-18T10:00:00.000Z')`,
      { imageId, tagId: usedChildId },
    );

    const unusedParentGroup = PRESET_TAXONOMY.find((group) => group.name === '色彩');
    seedDb.run(
      `INSERT INTO tags (
        name,
        language,
        parent_id,
        level,
        sort_order,
        is_system,
        created_at,
        updated_at
      ) VALUES (
        :name,
        'zh',
        NULL,
        1,
        0,
        0,
        '2026-03-18T10:00:00.000Z',
        '2026-03-18T10:00:00.000Z'
      )`,
      { name: unusedParentGroup.name },
    );
    const unusedParentId = Number(seedDb.get(
      `SELECT id
       FROM tags
       WHERE name = :name
       LIMIT 1`,
      { name: unusedParentGroup.name },
    )?.id);

    seedDb.run(
      `INSERT INTO tags (
        name,
        language,
        parent_id,
        level,
        sort_order,
        is_system,
        created_at,
        updated_at
      ) VALUES (
        '绿色',
        'zh',
        :parentId,
        2,
        0,
        0,
        '2026-03-18T10:00:00.000Z',
        '2026-03-18T10:00:00.000Z'
      )`,
      { parentId: unusedParentId },
    );
  } finally {
    seedDb.close();
  }

  const app = createTestApp({ rootDir: root, autoStartQueue: false });
  try {
    const preservedParent = app.db.get(
      `SELECT id, level
       FROM tags
       WHERE name = '风格'
       LIMIT 1`,
    );
    assert.equal(preservedParent?.level, 1);

    const preservedChild = app.db.get(
      `SELECT id, level, parent_id
       FROM tags
       WHERE name = '极简'
       LIMIT 1`,
    );
    assert.equal(preservedChild?.level, 2);
    assert.equal(preservedChild?.parent_id, preservedParent.id);

    const removedUnusedChild = app.db.get(
      `SELECT id
       FROM tags
       WHERE name = '绿色'
       LIMIT 1`,
    );
    assert.equal(removedUnusedChild, undefined);

    const removedUnusedParent = app.db.get(
      `SELECT id
       FROM tags
       WHERE name = '色彩'
       LIMIT 1`,
    );
    assert.equal(removedUnusedParent, undefined);
  } finally {
    app.close();
  }
});

test('getImageDetail restores missing library files and thumbnails from source_path', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-detail-recovery-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const sourceDir = path.join(root, 'fixtures');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourceFile = path.join(sourceDir, 'recover-detail.jpg');
    fs.writeFileSync(sourceFile, Buffer.from('recover-detail-content'));

    const importResult = await app.importFile(sourceFile);
    assert.equal(importResult.status, 'imported');

    const storedImage = app.db.get(
      `SELECT library_path, thumbnail_path
       FROM images
       WHERE id = :imageId`,
      { imageId: importResult.image.id },
    );
    fs.unlinkSync(storedImage.library_path);
    fs.unlinkSync(storedImage.thumbnail_path);

    const detail = app.getImageDetail(importResult.image.id);

    assert.equal(fs.existsSync(storedImage.library_path), true);
    assert.equal(fs.existsSync(storedImage.thumbnail_path), true);
    assert.equal(detail.image.library_path, storedImage.library_path);
    assert.equal(detail.image.thumbnail_path, storedImage.thumbnail_path);
  } finally {
    app.close();
  }
});

test('rebuildImageAnalysis restores missing library files before reanalysis', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-analysis-recovery-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: true });

  try {
    const sourceDir = path.join(root, 'fixtures');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourceFile = path.join(sourceDir, 'recover-analysis.jpg');
    fs.writeFileSync(sourceFile, Buffer.from('recover-analysis-content'));

    const importResult = await app.importFile(sourceFile);
    assert.equal(importResult.status, 'imported');
    await waitForImageStatus(app, importResult.image.id, 'ready', 8000);

    const storedImage = app.db.get(
      `SELECT library_path, thumbnail_path
       FROM images
       WHERE id = :imageId`,
      { imageId: importResult.image.id },
    );
    fs.unlinkSync(storedImage.library_path);
    fs.unlinkSync(storedImage.thumbnail_path);

    const rebuildResult = await app.rebuildImageAnalysis(importResult.image.id);

    assert.equal(rebuildResult.status, 'ready');
    assert.equal(fs.existsSync(storedImage.library_path), true);
    assert.equal(fs.existsSync(storedImage.thumbnail_path), true);
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('reconcileLegacyImageRelations repairs active caption links and rebuilds missing embeddings', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-legacy-caption-repair-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const parentTag = app.createTag({ name: '修复测试分组', level: 1 });
    const childTag = app.createTag({ name: '修复测试标签', level: 2, parentId: parentTag.id });
    const sourcePath = path.join(root, 'fixtures', 'legacy-caption.jpg');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, Buffer.from('legacy-caption-content'));

    const imageId = insertLegacyReadyImage(app, {
      fileName: 'legacy-caption.jpg',
      hash: 'legacy-caption-hash',
      sourcePath,
      libraryPath: sourcePath,
      thumbnailPath: `${sourcePath}.thumb`,
      activeTagSource: 'user',
      activeCaptionId: null,
    });
    const captionId = insertCaption(app, imageId, {
      content: '这是旧库里保留下来的人工描述',
      source: 'user',
      isActive: 0,
    });
    app.db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'user', '2026-03-18T09:35:00.000Z')`,
      {
        imageId,
        tagId: childTag.id,
      },
    );

    const summary = app.reconcileLegacyImageRelations();
    assert.equal(summary.repairedCaptionCount, 1);
    assert.equal(summary.requeuedEmbeddingCount, 1);

    app.queue.start();
    await waitForQueueIdle(app);

    const repairedImage = app.db.get(
      `SELECT active_caption_id
       FROM images
       WHERE id = :imageId`,
      { imageId },
    );
    const repairedCaption = app.db.get(
      `SELECT is_active
       FROM captions
       WHERE id = :captionId`,
      { captionId },
    );
    const embedding = app.db.get(
      `SELECT vector
       FROM embeddings
       WHERE image_id = :imageId`,
      { imageId },
    );

    assert.equal(repairedImage.active_caption_id, captionId);
    assert.equal(repairedCaption.is_active, 1);
    assert.ok(embedding?.vector);
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('reconcileLegacyImageRelations requeues ready legacy images with missing ai tag relations', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-legacy-ai-repair-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const sourcePath = path.join(root, 'fixtures', 'legacy-ai-repair.jpg');
    const libraryPath = path.join(root, 'data', 'library', 'legacy-ai-repair.jpg');
    const thumbnailPath = path.join(root, 'data', 'thumbnails', 'legacy-ai-repair.jpg.thumb');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, Buffer.from('legacy-ai-repair-content'));

    const imageId = insertLegacyReadyImage(app, {
      fileName: 'legacy-ai-repair.jpg',
      hash: 'legacy-ai-repair-hash',
      sourcePath,
      libraryPath,
      thumbnailPath,
      activeTagSource: 'ai',
      activeCaptionId: null,
    });
    const captionId = insertCaption(app, imageId, {
      content: '这是旧图的残留 AI 描述',
      source: 'ai',
      isActive: 1,
    });
    app.db.run(
      `UPDATE images
       SET active_caption_id = :captionId
       WHERE id = :imageId`,
      {
        imageId,
        captionId,
      },
    );

    const summary = app.reconcileLegacyImageRelations();
    assert.equal(summary.requeuedAnalysisCount, 1);

    app.queue.start();
    await waitForQueueIdle(app);

    const detail = app.getImageDetail(imageId);
    assert.ok(detail.effectiveTags.length > 0);

    const filteredResult = await app.searchImages('', [detail.effectiveTags[0].id], 'and');
    assert.ok(filteredResult.items.some((item) => item.id === imageId));
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('reconcileLegacyImageRelations switches broken ai tag source to existing user tags', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-legacy-tag-source-switch-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const parentTag = app.createTag({ name: '切换测试分组', level: 1 });
    const userTag = app.createTag({ name: '切换测试标签', level: 2, parentId: parentTag.id });
    const sourcePath = path.join(root, 'fixtures', 'legacy-tag-switch.jpg');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, Buffer.from('legacy-tag-switch-content'));

    const imageId = insertLegacyReadyImage(app, {
      fileName: 'legacy-tag-switch.jpg',
      hash: 'legacy-tag-switch-hash',
      sourcePath,
      libraryPath: sourcePath,
      thumbnailPath: `${sourcePath}.thumb`,
      activeTagSource: 'ai',
      activeCaptionId: null,
    });
    const captionId = insertCaption(app, imageId, {
      content: '这是一个保留了人工标签的旧图',
      source: 'user',
      isActive: 1,
    });
    app.db.run(
      `UPDATE images
       SET active_caption_id = :captionId
       WHERE id = :imageId`,
      {
        imageId,
        captionId,
      },
    );
    app.db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'user', '2026-03-18T09:35:00.000Z')`,
      {
        imageId,
        tagId: userTag.id,
      },
    );

    const summary = app.reconcileLegacyImageRelations();
    assert.equal(summary.switchedTagSourceCount, 1);
    assert.equal(summary.requeuedAnalysisCount, 0);

    const repairedImage = app.db.get(
      `SELECT active_tag_source
       FROM images
       WHERE id = :imageId`,
      { imageId },
    );
    const filteredResult = await app.searchImages('', [userTag.id], 'and');

    assert.equal(repairedImage.active_tag_source, 'user');
    assert.ok(filteredResult.items.some((item) => item.id === imageId));
  } finally {
    app.close();
  }
});

test('ai analysis reuses existing taxonomy tags and creates missing child tags under an existing parent', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-ai-taxonomy-reuse-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: true });

  try {
    const presetParent = app.createTag({ name: '行业 / 用途', level: 1 });

    const existingTag = app.createTag({
      name: '便签板',
      level: 2,
      parentId: presetParent.id,
    });

    app.aiService.zhipuService.request = async (endpoint, payload = {}) => {
      if (endpoint === '/embeddings') {
        return {
          data: [{ embedding: embedTextDeterministic(payload.input) }],
        };
      }

      if (endpoint === '/chat/completions') {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  caption: '这是一张桌面便签板设计参考图，包含木质展示板、照片和文具元素。',
                  taxonomyTags: [
                    {
                      parentName: '行业 / 用途',
                      childName: '便签板',
                      isNewParent: false,
                      isNewChild: false,
                    },
                    {
                      parentName: '行业 / 用途',
                      childName: '桌面摆件',
                      isNewParent: false,
                      isNewChild: true,
                    },
                  ],
                }),
              },
            },
          ],
        };
      }

      throw new Error(`UNSUPPORTED_TEST_ENDPOINT:${endpoint}`);
    };

    const sourceFile = path.join(root, 'taxonomy-reuse.jpg');
    fs.writeFileSync(sourceFile, Buffer.from('fake-jpg-content-taxonomy-reuse'));

    const importResult = await app.importFile(sourceFile);
    const imageId = importResult.image.id;
    await waitForImageStatus(app, imageId, 'ready', 8000);

    const detail = app.getImageDetail(imageId);
    const aiTagNames = detail.aiSuggestedTags.map((tag) => tag.name).sort();
    assert.deepEqual(aiTagNames, ['便签板', '桌面摆件'].sort());

    const reusedTag = app.db.get(
      `SELECT id, parent_id
       FROM tags
       WHERE name = '便签板'
       LIMIT 1`,
    );
    assert.equal(reusedTag.id, existingTag.id);
    assert.equal(reusedTag.parent_id, presetParent.id);

    const createdTag = app.db.get(
      `SELECT id, parent_id
       FROM tags
       WHERE name = '桌面摆件'
       LIMIT 1`,
    );
    assert.ok(createdTag?.id);
    assert.equal(createdTag.parent_id, presetParent.id);
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('ai analysis can create a new parent tag and falls back to uncategorized for invalid parent names', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-ai-taxonomy-create-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: true });

  try {
    let chatCallCount = 0;
    app.aiService.zhipuService.request = async (endpoint, payload = {}) => {
      if (endpoint === '/embeddings') {
        return {
          data: [{ embedding: embedTextDeterministic(payload.input) }],
        };
      }

      if (endpoint === '/chat/completions') {
        chatCallCount += 1;
        const firstResponse = {
          caption: '这是一张微观艺术主题的创意图像，主体呈现发光孢子与实验质感。',
          taxonomyTags: [
            {
              parentName: '微观幻想',
              childName: '发光孢子',
              isNewParent: true,
              isNewChild: true,
            },
            {
              parentName: '微观幻想',
              childName: '实验质感',
              isNewParent: false,
              isNewChild: true,
            },
          ],
        };
        const secondResponse = {
          caption: '这是一张抽象创意图像，画面强调色块关系与视觉张力。',
          taxonomyTags: [
            {
              parentName: '其他',
              childName: '色块构成',
              isNewParent: true,
              isNewChild: true,
            },
          ],
        };

        return {
          choices: [
            {
              message: {
                content: JSON.stringify(chatCallCount === 1 ? firstResponse : secondResponse),
              },
            },
          ],
        };
      }

      throw new Error(`UNSUPPORTED_TEST_ENDPOINT:${endpoint}`);
    };

    const firstFile = path.join(root, 'taxonomy-create-parent.jpg');
    fs.writeFileSync(firstFile, Buffer.from('fake-jpg-content-taxonomy-create-parent'));
    const firstImport = await app.importFile(firstFile);
    await waitForImageStatus(app, firstImport.image.id, 'ready', 8000);

    const createdParent = app.db.get(
      `SELECT id
       FROM tags
       WHERE name = '微观幻想'
         AND level = 1
       LIMIT 1`,
    );
    assert.ok(createdParent?.id);

    const firstCreatedChild = app.db.get(
      `SELECT parent_id
       FROM tags
       WHERE name = '发光孢子'
       LIMIT 1`,
    );
    assert.equal(firstCreatedChild.parent_id, createdParent.id);

    const secondFile = path.join(root, 'taxonomy-invalid-parent.jpg');
    fs.writeFileSync(secondFile, Buffer.from('fake-jpg-content-taxonomy-invalid-parent'));
    const secondImport = await app.importFile(secondFile);
    await waitForImageStatus(app, secondImport.image.id, 'ready', 8000);

    const uncategorized = app.db.get(
      `SELECT id
       FROM tags
       WHERE name = :name
         AND level = 1
       LIMIT 1`,
      { name: UNCATEGORIZED_TAG_NAME },
    );
    assert.ok(uncategorized?.id);

    const fallbackChild = app.db.get(
      `SELECT parent_id
       FROM tags
       WHERE name = '色块构成'
       LIMIT 1`,
    );
    assert.equal(fallbackChild.parent_id, uncategorized.id);
  } finally {
    await waitForQueueIdle(app);
    app.close();
  }
});

test('developer model config drives the active provider and model settings', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-managed-key-test-'));
  const app = createTestApp({
    rootDir: root,
    autoStartQueue: false,
    modelConfig: createModelConfig({
      zhipu: {
        apiKey: 'dev-config-token',
        visionModel: 'glm-test-vision',
        reasoningModel: 'GLM-4.7',
        embeddingModel: 'embed-test-v2',
        embeddingDimensions: 512,
      },
    }),
  });

  try {
    assert.deepEqual(app.aiService.zhipuService.getSettings(), {
      apiBase: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: 'dev-config-token',
      visionModel: 'glm-test-vision',
      reasoningModel: 'GLM-4.7',
      embeddingModel: 'embed-test-v2',
      embeddingDimensions: 512,
    });
  } finally {
    app.close();
  }
});

test('searchImages keeps semantic similarity ahead of stronger text matches', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-search-text-rank-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const now = new Date().toISOString();
    const query = '鸟儿';
    const queryVector = embedTextDeterministic(query);
    const reversedVector = queryVector.map((value) => -value);

    const insertReadyImage = ({ fileName, hash, updatedAt, caption, tags }) => {
      const imageResult = app.db.run(
        `INSERT INTO images (
          original_file_name,
          source_path,
          library_path,
          thumbnail_path,
          md5_hash,
          file_size,
          width,
          height,
          import_status,
          analysis_status,
          active_tag_source,
          created_at,
          updated_at
        ) VALUES (
          :fileName,
          :sourcePath,
          :libraryPath,
          :thumbnailPath,
          :hash,
          100,
          NULL,
          NULL,
          'imported',
          'ready',
          'ai',
          :createdAt,
          :updatedAt
        )`,
        {
          fileName,
          sourcePath: `/tmp/${fileName}`,
          libraryPath: `/tmp/${fileName}`,
          thumbnailPath: `/tmp/${fileName}.thumb`,
          hash,
          createdAt: now,
          updatedAt,
        },
      );

      const imageId = Number(imageResult.lastInsertRowid);
      const captionResult = app.db.run(
        `INSERT INTO captions (
          image_id,
          content,
          source,
          is_active,
          model_provider,
          model_name,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :content,
          'ai',
          1,
          'zhipu',
          'glm-test-vision',
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          content: caption,
          createdAt: now,
          updatedAt,
        },
      );

      app.db.run(
        `UPDATE images
         SET active_caption_id = :captionId
         WHERE id = :imageId`,
        {
          imageId,
          captionId: Number(captionResult.lastInsertRowid),
        },
      );

      for (const tagName of tags) {
        app.db.run(
          `INSERT INTO tags (name, language, created_at)
           VALUES (:name, 'zh', :createdAt)
           ON CONFLICT(name, language) DO NOTHING`,
          { name: tagName, createdAt: now },
        );

        const tag = app.db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", { name: tagName });
        app.db.run(
          `INSERT INTO image_tags (image_id, tag_id, source, created_at)
           VALUES (:imageId, :tagId, 'ai', :createdAt)`,
          {
            imageId,
            tagId: tag.id,
            createdAt: now,
          },
        );
      }

      return imageId;
    };

    const unrelatedImageId = insertReadyImage({
      fileName: 'sunlight.jpg',
      hash: 'search-rank-unrelated',
      updatedAt: '2026-03-17T11:30:00.000Z',
      caption: '阳光照射下的室内植物与器皿静物。',
      tags: ['暖光氛围', '居家园艺'],
    });

    const birdImageId = insertReadyImage({
      fileName: 'bird.jpg',
      hash: 'search-rank-bird',
      updatedAt: '2026-03-17T10:00:00.000Z',
      caption: '花枝上的小鸟在春日光线中停驻，呈现轻盈灵动的自然画面。',
      tags: ['鸟类', '春日主题', '动物摄影'],
    });

    app.db.run(
      `INSERT INTO embeddings (
        image_id,
        vector,
        dimension,
        model_provider,
        model_name,
        created_at
      ) VALUES (
        :imageId,
        :vector,
        :dimension,
        'zhipu',
        'embedding-3',
        :createdAt
      )`,
      {
        imageId: unrelatedImageId,
        vector: JSON.stringify(queryVector),
        dimension: queryVector.length,
        createdAt: now,
      },
    );

    app.db.run(
      `INSERT INTO embeddings (
        image_id,
        vector,
        dimension,
        model_provider,
        model_name,
        created_at
      ) VALUES (
        :imageId,
        :vector,
        :dimension,
        'zhipu',
        'embedding-3',
        :createdAt
      )`,
      {
        imageId: birdImageId,
        vector: JSON.stringify(reversedVector),
        dimension: reversedVector.length,
        createdAt: now,
      },
    );

    const result = await app.searchImages(query, []);

    assert.equal(result.total, 2);
    assert.equal(result.items[0].id, unrelatedImageId);
    assert.equal(result.items[1].id, birdImageId);
    assert.ok(result.items[0].distance < result.items[1].distance);
    assert.ok(result.items[1].lexicalScore > result.items[0].lexicalScore);
  } finally {
    app.close();
  }
});

test('searchImages avoids single-character lexical false positives for infant queries', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-search-infant-query-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const now = new Date().toISOString();

    const insertReadyImage = ({ fileName, hash, caption, tags, vector }) => {
      const imageResult = app.db.run(
        `INSERT INTO images (
          original_file_name,
          source_path,
          library_path,
          thumbnail_path,
          md5_hash,
          file_size,
          width,
          height,
          import_status,
          analysis_status,
          active_tag_source,
          created_at,
          updated_at
        ) VALUES (
          :fileName,
          :sourcePath,
          :libraryPath,
          :thumbnailPath,
          :hash,
          100,
          NULL,
          NULL,
          'imported',
          'ready',
          'ai',
          :createdAt,
          :updatedAt
        )`,
        {
          fileName,
          sourcePath: `/tmp/${fileName}`,
          libraryPath: `/tmp/${fileName}`,
          thumbnailPath: `/tmp/${fileName}.thumb`,
          hash,
          createdAt: now,
          updatedAt: now,
        },
      );

      const imageId = Number(imageResult.lastInsertRowid);
      const captionResult = app.db.run(
        `INSERT INTO captions (
          image_id,
          content,
          source,
          is_active,
          model_provider,
          model_name,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :content,
          'ai',
          1,
          'zhipu',
          'glm-test-vision',
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          content: caption,
          createdAt: now,
          updatedAt: now,
        },
      );

      app.db.run(
        `UPDATE images
         SET active_caption_id = :captionId
         WHERE id = :imageId`,
        {
          imageId,
          captionId: Number(captionResult.lastInsertRowid),
        },
      );

      for (const tagName of tags) {
        app.db.run(
          `INSERT INTO tags (name, language, created_at)
           VALUES (:name, 'zh', :createdAt)
           ON CONFLICT(name, language) DO NOTHING`,
          { name: tagName, createdAt: now },
        );

        const tag = app.db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", { name: tagName });
        app.db.run(
          `INSERT INTO image_tags (image_id, tag_id, source, created_at)
           VALUES (:imageId, :tagId, 'ai', :createdAt)`,
          {
            imageId,
            tagId: tag.id,
            createdAt: now,
          },
        );
      }

      app.db.run(
        `INSERT INTO embeddings (
          image_id,
          vector,
          dimension,
          model_provider,
          model_name,
          created_at
        ) VALUES (
          :imageId,
          :vector,
          :dimension,
          'zhipu',
          'embedding-3',
          :createdAt
        )`,
        {
          imageId,
          vector: JSON.stringify(vector),
          dimension: vector.length,
          createdAt: now,
        },
      );

      return imageId;
    };

    const infantImageId = insertReadyImage({
      fileName: 'infant.jpg',
      hash: 'search-infant-hit',
      caption: '新生儿安静地躺在柔软的针织毯子上。',
      tags: ['新生儿', '针织毯子'],
      vector: embedTextDeterministic('新生儿 针织毯子'),
    });

    const birdImageId = insertReadyImage({
      fileName: 'bird.jpg',
      hash: 'search-infant-noise',
      caption: '一只鸟儿停在春日的树枝上。',
      tags: ['小鸟', '春日'],
      vector: embedTextDeterministic('春日 小鸟'),
    });

    const result = await app.searchImages('婴儿', []);

    assert.equal(result.total, 2);
    assert.equal(result.items[0].id, infantImageId);
    assert.equal(result.items[1].id, birdImageId);
    assert.equal(result.items[1].lexicalScore, 0);
  } finally {
    app.close();
  }
});

test('searchImages boosts cute-intent queries toward baby subjects over scenery', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-search-cute-intent-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const now = new Date().toISOString();
    const cuteQueryVector = embedTextDeterministic('可爱的样子');

    const insertReadyImage = ({ fileName, hash, caption, tags, vector }) => {
      const imageResult = app.db.run(
        `INSERT INTO images (
          original_file_name,
          source_path,
          library_path,
          thumbnail_path,
          md5_hash,
          file_size,
          width,
          height,
          import_status,
          analysis_status,
          active_tag_source,
          created_at,
          updated_at
        ) VALUES (
          :fileName,
          :sourcePath,
          :libraryPath,
          :thumbnailPath,
          :hash,
          100,
          NULL,
          NULL,
          'imported',
          'ready',
          'ai',
          :createdAt,
          :updatedAt
        )`,
        {
          fileName,
          sourcePath: `/tmp/${fileName}`,
          libraryPath: `/tmp/${fileName}`,
          thumbnailPath: `/tmp/${fileName}.thumb`,
          hash,
          createdAt: now,
          updatedAt: now,
        },
      );

      const imageId = Number(imageResult.lastInsertRowid);
      const captionResult = app.db.run(
        `INSERT INTO captions (
          image_id,
          content,
          source,
          is_active,
          model_provider,
          model_name,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :content,
          'ai',
          1,
          'zhipu',
          'glm-test-vision',
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          content: caption,
          createdAt: now,
          updatedAt: now,
        },
      );

      app.db.run(
        `UPDATE images
         SET active_caption_id = :captionId
         WHERE id = :imageId`,
        {
          imageId,
          captionId: Number(captionResult.lastInsertRowid),
        },
      );

      for (const tagName of tags) {
        app.db.run(
          `INSERT INTO tags (name, language, created_at)
           VALUES (:name, 'zh', :createdAt)
           ON CONFLICT(name, language) DO NOTHING`,
          { name: tagName, createdAt: now },
        );

        const tag = app.db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", { name: tagName });
        app.db.run(
          `INSERT INTO image_tags (image_id, tag_id, source, created_at)
           VALUES (:imageId, :tagId, 'ai', :createdAt)`,
          {
            imageId,
            tagId: tag.id,
            createdAt: now,
          },
        );
      }

      app.db.run(
        `INSERT INTO embeddings (
          image_id,
          vector,
          dimension,
          model_provider,
          model_name,
          created_at
        ) VALUES (
          :imageId,
          :vector,
          :dimension,
          'zhipu',
          'embedding-3',
          :createdAt
        )`,
        {
          imageId,
          vector: JSON.stringify(vector),
          dimension: vector.length,
          createdAt: now,
        },
      );

      return imageId;
    };

    const sceneryImageId = insertReadyImage({
      fileName: 'scenery.jpg',
      hash: 'search-cute-scenery',
      caption: '雨滴落在水面上形成涟漪，画面呈现自然与宁静的氛围。',
      tags: ['自然风光', '水面', '涟漪'],
      vector: cuteQueryVector,
    });

    const babyImageId = insertReadyImage({
      fileName: 'baby.jpg',
      hash: 'search-cute-baby',
      caption: '新生儿裹在柔软针织毯子里安静入睡。',
      tags: ['新生儿', '睡觉', '针织毯子'],
      vector: embedTextDeterministic('新生儿 睡觉 针织毯子'),
    });

    const result = await app.searchImages('可爱的样子', []);

    assert.equal(result.total, 2);
    assert.equal(result.items[0].id, babyImageId);
    assert.equal(result.items[1].id, sceneryImageId);
    assert.ok(result.items[0].lexicalScore > 0);
  } finally {
    app.close();
  }
});

test('database migration moves flat tags under the uncategorized parent', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-migration-test-'));
  const dbPath = path.join(root, 'data', 'inspiradb.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_file_name TEXT NOT NULL,
      source_path TEXT NOT NULL,
      library_path TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      md5_hash TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      import_status TEXT NOT NULL DEFAULT 'imported',
      analysis_status TEXT NOT NULL DEFAULT 'ready',
      active_caption_id INTEGER,
      active_tag_source TEXT NOT NULL DEFAULT 'ai',
      needs_embedding_refresh INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'zh',
      created_at TEXT NOT NULL,
      UNIQUE(name, language)
    );
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_provider TEXT NOT NULL DEFAULT 'mock',
      api_key_ref TEXT,
      cloud_analysis_enabled INTEGER NOT NULL DEFAULT 0,
      library_root_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE image_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(image_id, tag_id, source)
    );
  `);

  legacyDb.prepare(
    `INSERT INTO images (
      original_file_name,
      source_path,
      library_path,
      thumbnail_path,
      md5_hash,
      file_size,
      created_at,
      updated_at
    ) VALUES (
      'legacy.jpg',
      '/tmp/legacy.jpg',
      '/tmp/legacy.jpg',
      '/tmp/legacy.jpg.thumb',
      'legacy-hash',
      100,
      '2026-03-18T10:00:00.000Z',
      '2026-03-18T10:00:00.000Z'
    )`,
  ).run();
  legacyDb.prepare(
    `INSERT INTO tags (name, language, created_at)
     VALUES ('旧标签', 'zh', '2026-03-18T10:00:00.000Z')`,
  ).run();
  legacyDb.prepare(
    `INSERT INTO image_tags (image_id, tag_id, source, created_at)
     VALUES (1, 1, 'ai', '2026-03-18T10:00:00.000Z')`,
  ).run();
  legacyDb.prepare(
    `INSERT INTO app_settings (
      api_provider,
      api_key_ref,
      cloud_analysis_enabled,
      library_root_path,
      created_at,
      updated_at
    ) VALUES (
      'mock',
      'legacy-key-ref',
      0,
      '/Volumes/Legacy Library',
      '2026-03-18T10:00:00.000Z',
      '2026-03-18T10:00:00.000Z'
    )`,
  ).run();
  legacyDb.close();

  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const uncategorized = app.db.get(
      `SELECT id
       FROM tags
       WHERE name = '未分组'
         AND level = 1`,
    );
    assert.ok(uncategorized?.id);

    const migratedTag = app.db.get(
      `SELECT id, parent_id, level
       FROM tags
       WHERE name = '旧标签'`,
    );
    assert.equal(migratedTag.level, 2);
    assert.equal(migratedTag.parent_id, uncategorized.id);

    const relation = app.db.get(
      `SELECT tag_id
       FROM image_tags
       WHERE image_id = 1
         AND source = 'ai'`,
    );
    assert.equal(relation.tag_id, migratedTag.id);

    const backupSettingsTable = app.db.get(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name LIKE 'app_settings_legacy_v%'`,
    );
    assert.ok(backupSettingsTable?.name);

    const nextSetting = app.db.get(
      `SELECT value
       FROM app_settings
       WHERE key = 'tag_filter_mode'`,
    );
    assert.equal(nextSetting?.value, 'and');

    const legacyLibraryRootSetting = app.db.get(
      `SELECT value
       FROM app_settings
       WHERE key = 'legacy_library_root_path'`,
    );
    assert.equal(legacyLibraryRootSetting?.value, '/Volumes/Legacy Library');
  } finally {
    app.close();
  }
});

test('legacy library root repair is idempotent and does not overwrite an existing migrated value', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-legacy-settings-idempotent-test-'));
  const dbPath = path.join(root, 'data', 'inspiradb.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
    CREATE TABLE images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_file_name TEXT NOT NULL,
      source_path TEXT NOT NULL,
      library_path TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      md5_hash TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      import_status TEXT NOT NULL DEFAULT 'imported',
      analysis_status TEXT NOT NULL DEFAULT 'ready',
      active_caption_id INTEGER,
      active_tag_source TEXT NOT NULL DEFAULT 'ai',
      needs_embedding_refresh INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'zh',
      created_at TEXT NOT NULL,
      UNIQUE(name, language)
    );
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_provider TEXT NOT NULL DEFAULT 'mock',
      api_key_ref TEXT,
      cloud_analysis_enabled INTEGER NOT NULL DEFAULT 0,
      library_root_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  legacyDb.prepare(
    `INSERT INTO app_settings (
      api_provider,
      library_root_path,
      created_at,
      updated_at
    ) VALUES (
      'mock',
      '/Volumes/Legacy Library',
      '2026-03-18T10:00:00.000Z',
      '2026-03-18T10:00:00.000Z'
    )`,
  ).run();
  legacyDb.close();

  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    assert.equal(app.getSetting('legacy_library_root_path'), '/Volumes/Legacy Library');
    app.setSetting('legacy_library_root_path', '/Users/apple/Custom Library');
  } finally {
    app.close();
  }

  const reopenedApp = createTestApp({ rootDir: root, autoStartQueue: false });
  try {
    assert.equal(reopenedApp.getSetting('legacy_library_root_path'), '/Users/apple/Custom Library');
  } finally {
    reopenedApp.close();
  }
});

test('searchImages applies AND/OR filtering across secondary tags', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-filter-mode-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const themeGroup = app.createTag({ name: '测试主题', level: 1 });
    const styleGroup = app.createTag({ name: '测试风格', level: 1 });
    const brandTag = app.createTag({ name: '品牌展示', level: 2, parentId: themeGroup.id });
    const posterTag = app.createTag({ name: '促销海报', level: 2, parentId: themeGroup.id });
    const minimalTag = app.createTag({ name: '留白极简', level: 2, parentId: styleGroup.id });

    const imageBrandMinimal = insertReadyImageWithTagIds(app, {
      fileName: 'brand-minimal.jpg',
      hash: 'filter-brand-minimal',
      caption: '品牌展示海报采用留白极简布局。',
      tagIds: [brandTag.id, posterTag.id, minimalTag.id],
      vector: embedTextDeterministic('品牌展示 促销海报 留白极简'),
      updatedAt: '2026-03-18T12:00:00.000Z',
    });

    const imageBrandOnly = insertReadyImageWithTagIds(app, {
      fileName: 'brand-only.jpg',
      hash: 'filter-brand-only',
      caption: '品牌展示延展物料。',
      tagIds: [brandTag.id],
      vector: embedTextDeterministic('品牌展示 视觉'),
      updatedAt: '2026-03-18T11:00:00.000Z',
    });

    const imageMinimalOnly = insertReadyImageWithTagIds(app, {
      fileName: 'minimal-only.jpg',
      hash: 'filter-minimal-only',
      caption: '留白极简风格的版式研究。',
      tagIds: [minimalTag.id],
      vector: embedTextDeterministic('留白极简 版式'),
      updatedAt: '2026-03-18T10:00:00.000Z',
    });

    const andResult = await app.searchImages('', [brandTag.id, minimalTag.id], 'and', { page: 1, pageSize: 50 });
    assert.deepEqual(andResult.items.map((item) => item.id), [imageBrandMinimal]);

    const orResult = await app.searchImages('', [brandTag.id, minimalTag.id], 'or', { page: 1, pageSize: 50 });
    assert.deepEqual(
      new Set(orResult.items.map((item) => item.id)),
      new Set([imageBrandMinimal, imageBrandOnly, imageMinimalOnly]),
    );

    const tagTree = await app.getFilterTags('', [brandTag.id, minimalTag.id], 'or');
    const themeNode = tagTree.find((group) => group.id === themeGroup.id);
    const styleNode = tagTree.find((group) => group.id === styleGroup.id);
    assert.equal(themeNode.children.find((tag) => tag.id === brandTag.id).count, 2);
    assert.equal(themeNode.children.find((tag) => tag.id === brandTag.id).usageCount, 2);
    assert.equal(themeNode.usageCount, 3);
    assert.equal(styleNode.children.find((tag) => tag.id === minimalTag.id).count, 2);
    assert.equal(styleNode.children.find((tag) => tag.id === minimalTag.id).usageCount, 2);

    const emptyGroup = app.createTag({ name: '空分组', level: 1 });
    const emptyTag = app.createTag({ name: '空二级标签', level: 2, parentId: emptyGroup.id });
    const treeWithEmptyTag = await app.getFilterTags('', [emptyTag.id], 'or');
    const emptyNode = treeWithEmptyTag.find((group) => group.id === emptyGroup.id);
    assert.equal(emptyNode.children.find((tag) => tag.id === emptyTag.id).count, 0);
    assert.equal(emptyNode.children.find((tag) => tag.id === emptyTag.id).usageCount, 0);
  } finally {
    app.close();
  }
});

test('tag filter mode persists and tag CRUD manages hierarchy', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-tag-crud-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    assert.equal(app.getTagFilterMode(), 'and');
    assert.equal(app.setTagFilterMode('or').mode, 'or');

    const usageGroup = app.createTag({ name: '用途', level: 1 });
    const styleGroup = app.createTag({ name: '版式风格', level: 1 });
    const heroTag = app.createTag({ name: '首页横幅', level: 2, parentId: usageGroup.id });

    const updatedTag = app.updateTag({
      tagId: heroTag.id,
      name: '首页头图',
      parentId: styleGroup.id,
    });

    assert.equal(updatedTag.name, '首页头图');
    assert.equal(updatedTag.parentId, styleGroup.id);

    const tree = app.listTagTree();
    assert.ok(tree.some((group) => group.name === '用途'));
    assert.ok(tree.some((group) => group.name === '版式风格' && group.children.some((tag) => tag.name === '首页头图')));

    const deletedChild = app.deleteTag(updatedTag.id);
    assert.equal(deletedChild.deleted, true);

    const deletedGroup = app.deleteTag(usageGroup.id);
    assert.equal(deletedGroup.deleted, true);
  } finally {
    app.close();
  }

  const reopened = createTestApp({ rootDir: root, autoStartQueue: false });
  try {
    assert.equal(reopened.getTagFilterMode(), 'or');
  } finally {
    reopened.close();
  }
});

test('deleteTag cascades through used child tags and parent hierarchies', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-delete-tag-cascade-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const parent = app.createTag({ name: '测试分类', level: 1 });
    const child = app.createTag({ name: '测试子标签', level: 2, parentId: parent.id });
    const secondChild = app.createTag({ name: '另一个子标签', level: 2, parentId: parent.id });

    const imageId = insertReadyImageWithTagIds(app, {
      fileName: 'delete-cascade.jpg',
      hash: 'delete-cascade',
      caption: '测试删除级联',
      tagIds: [child.id, secondChild.id],
      vector: embedTextDeterministic('测试删除级联'),
      source: 'user',
    });

    const deletedChild = app.deleteTag(child.id);
    assert.equal(deletedChild.deleted, true);
    assert.equal(deletedChild.affectedImageCount, 1);
    assert.equal(app.db.get('SELECT id FROM tags WHERE id = :tagId', { tagId: child.id }), undefined);
    assert.equal(
      app.db.get(
        `SELECT id
         FROM image_tags
         WHERE image_id = :imageId
           AND tag_id = :tagId
         LIMIT 1`,
        { imageId, tagId: child.id },
      ),
      undefined,
    );

    const deletedParent = app.deleteTag(parent.id);
    assert.equal(deletedParent.deleted, true);
    assert.equal(deletedParent.affectedImageCount, 1);
    assert.equal(app.db.get('SELECT id FROM tags WHERE id = :tagId', { tagId: parent.id }), undefined);
    assert.equal(app.db.get('SELECT id FROM tags WHERE id = :tagId', { tagId: secondChild.id }), undefined);
    assert.equal(
      app.db.get(
        `SELECT id
         FROM image_tags
         WHERE image_id = :imageId
           AND tag_id = :tagId
         LIMIT 1`,
        { imageId, tagId: secondChild.id },
      ),
      undefined,
    );

    const refreshJobs = app.db.all(
      `SELECT image_id
       FROM analysis_jobs
       WHERE job_type = 'refresh_embedding'
       ORDER BY id ASC`,
    );
    assert.deepEqual(refreshJobs.map((row) => Number(row.image_id)), [imageId]);
  } finally {
    app.close();
  }
});

test('listTagTree usageCount only counts currently active tag source', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-tag-usage-source-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const styleGroup = app.createTag({ name: '测试风格', level: 1 });
    const aiOnlyTag = app.createTag({ name: '旧AI标签', level: 2, parentId: styleGroup.id });
    const userTag = app.createTag({ name: '人工标签', level: 2, parentId: styleGroup.id });

    const imageId = insertReadyImageWithTagIds(app, {
      fileName: 'usage-source.jpg',
      hash: 'usage-source',
      caption: '测试图片',
      tagIds: [aiOnlyTag.id],
      vector: embedTextDeterministic('测试图片 旧AI标签'),
      source: 'ai',
    });

    app.db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'user', :createdAt)`,
      {
        imageId,
        tagId: userTag.id,
        createdAt: '2026-03-18T10:00:00.000Z',
      },
    );
    app.db.run(
      `UPDATE images
       SET active_tag_source = 'user'
       WHERE id = :imageId`,
      { imageId },
    );

    const tree = app.listTagTree();
    const styleNode = tree.find((group) => group.id === styleGroup.id);
    assert.equal(styleNode.children.find((tag) => tag.id === aiOnlyTag.id).usageCount, 0);
    assert.equal(styleNode.children.find((tag) => tag.id === userTag.id).usageCount, 1);
  } finally {
    app.close();
  }
});

test('ai tag organization previews and applies batched create/merge/move/delete operations', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-tag-organization-test-'));
  const app = createTestApp({ rootDir: root, autoStartQueue: false });

  try {
    const styleGroup = app.createTag({ name: '风格', level: 1 });
    const topicGroup = app.createTag({ name: '主题', level: 1 });
    const minimalTag = app.createTag({ name: '极简', level: 2, parentId: styleGroup.id });
    const simpleTag = app.createTag({ name: '简约', level: 2, parentId: styleGroup.id });
    const nicheTag = app.createTag({ name: '冷门标签', level: 2, parentId: topicGroup.id });
    const nightTag = app.createTag({ name: '夜景', level: 2, parentId: topicGroup.id });

    const imageMinimal = insertReadyImageWithTagIds(app, {
      fileName: 'minimal.jpg',
      hash: 'org-minimal',
      caption: '极简风格海报参考。',
      tagIds: [minimalTag.id],
      vector: embedTextDeterministic('极简 海报'),
    });
    const imageSimple = insertReadyImageWithTagIds(app, {
      fileName: 'simple.jpg',
      hash: 'org-simple',
      caption: '简约风格页面。',
      tagIds: [simpleTag.id],
      vector: embedTextDeterministic('简约 页面'),
    });
    const imageNight = insertReadyImageWithTagIds(app, {
      fileName: 'night.jpg',
      hash: 'org-night',
      caption: '夜景街头摄影。',
      tagIds: [nightTag.id, nicheTag.id],
      vector: embedTextDeterministic('夜景 街头 摄影'),
    });

    app.aiService.zhipuService.request = async (endpoint, payload = {}) => {
      if (endpoint === '/embeddings') {
        return {
          data: [
            {
              embedding: embedTextDeterministic(payload.input),
            },
          ],
        };
      }

      if (endpoint === '/chat/completions') {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  operations: [
                    {
                      kind: 'create',
                      level: 1,
                      name: '场景',
                      source: 'generated',
                      reason: '补充一个更明确的场景类一级分类。',
                    },
                    {
                      kind: 'create',
                      level: 2,
                      name: '雨夜街头',
                      parentName: '场景',
                      source: 'generated',
                      sourceTagId: nightTag.id,
                      reason: '这是当前库里没有的具体场景词。',
                    },
                    {
                      kind: 'merge',
                      sourceTagId: simpleTag.id,
                      targetTagName: '极简',
                      targetParentName: '风格',
                      source: 'existing',
                      reason: '简约和极简语义高度重合。',
                    },
                    {
                      kind: 'move',
                      tagId: nightTag.id,
                      targetParentName: '场景',
                      reason: '夜景更适合作为场景标签管理。',
                    },
                    {
                      kind: 'delete',
                      tagId: nicheTag.id,
                      replacementTargets: [
                        {
                          targetTagName: '夜景',
                          targetParentName: '场景',
                          source: 'existing',
                        },
                      ],
                      reason: '低频且信息价值不足。',
                    },
                  ],
                }),
              },
            },
          ],
        };
      }

      throw new Error(`UNSUPPORTED_TEST_ENDPOINT:${endpoint}`);
    };

    const preview = await app.previewTagOrganization();
    assert.equal(preview.summary.createCount, 2);
    assert.equal(preview.summary.mergeCount, 1);
    assert.equal(preview.summary.moveCount, 1);
    assert.equal(preview.summary.deleteCount, 1);
    assert.equal(preview.affectedImageCount, 2);
    assert.ok(preview.operations.some((operation) => operation.kind === 'merge' && operation.currentName === '简约'));

    const applyResult = app.applyTagOrganizationPlan({ operations: preview.operations });
    assert.equal(applyResult.appliedCount, 5);
    assert.equal(applyResult.skippedCount, 0);
    assert.equal(applyResult.affectedImageCount, 2);
    assert.ok(applyResult.lastOrganizedAt);

    const tree = app.listTagTree();
    const sceneGroup = tree.find((group) => group.name === '场景');
    assert.ok(sceneGroup);
    assert.ok(sceneGroup.children.some((tag) => tag.name === '夜景'));
    assert.ok(sceneGroup.children.some((tag) => tag.name === '雨夜街头'));
    assert.ok(!tree.some((group) => (group.children || []).some((tag) => tag.name === '简约')));
    assert.ok(!tree.some((group) => (group.children || []).some((tag) => tag.name === '冷门标签')));

    const mergedRelation = app.db.get(
      `SELECT tag_id
       FROM image_tags
       WHERE image_id = :imageId
         AND tag_id = :tagId
       LIMIT 1`,
      {
        imageId: imageSimple,
        tagId: minimalTag.id,
      },
    );
    assert.ok(mergedRelation);

    const deletedRelation = app.db.get(
      `SELECT id
       FROM image_tags
       WHERE image_id = :imageId
         AND tag_id = :tagId
       LIMIT 1`,
      {
        imageId: imageNight,
        tagId: nicheTag.id,
      },
    );
    assert.equal(deletedRelation, undefined);

    const refreshJobs = app.db.all(
      `SELECT image_id
       FROM analysis_jobs
       WHERE job_type = 'refresh_embedding'
       ORDER BY image_id ASC`,
    );
    assert.deepEqual(
      refreshJobs.map((row) => Number(row.image_id)),
      [imageSimple, imageNight],
    );

    const organizationStatus = app.getTagOrganizationStatus();
    assert.equal(organizationStatus.recommended, false);
  } finally {
    app.close();
  }
});
