import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { InspiraDBApp } from '../src/index.js';
import { createModelConfig } from '../src/model-config.js';
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
                tags: ['设计参考', '视觉灵感', '构图'],
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

    const duplicateResult = await app.importFile(sourceFile);
    assert.equal(duplicateResult.status, 'duplicate');

    const updateCaptionResult = await app.updateImageCaption(imageId, '这是人工修订的品牌海报参考描述');
    assert.equal(updateCaptionResult.imageId, imageId);

    const tagResult = await app.updateImageTags(imageId, ['品牌', '海报', '极简']);
    assert.equal(tagResult.activeTagSource, 'user');

    const embeddingAfterTagUpdate = app.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId });
    assertVectorsAlmostEqual(
      JSON.parse(embeddingAfterTagUpdate.vector),
      embedTextDeterministic(buildEmbeddingText('这是人工修订的品牌海报参考描述', tagResult.tags)),
    );

    await app.rebuildImageAnalysis(imageId);
    await waitForImageStatus(app, imageId, 'ready', 8000);

    const detailAfterReanalyze = app.getImageDetail(imageId);
    assert.equal(detailAfterReanalyze.activeCaption?.source, 'user');
    assert.equal(detailAfterReanalyze.activeCaption?.content, '这是人工修订的品牌海报参考描述');
    assert.deepEqual(detailAfterReanalyze.effectiveTags.sort(), ['品牌', '极简', '海报'].sort());

    const embeddingAfterReanalyze = app.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId });
    assertVectorsAlmostEqual(
      JSON.parse(embeddingAfterReanalyze.vector),
      embedTextDeterministic(buildEmbeddingText(detailAfterReanalyze.activeCaption.content, detailAfterReanalyze.effectiveTags)),
    );

    const searchResult = await app.searchImages('品牌海报', ['品牌']);
    assert.ok(searchResult.total >= 1);
    assert.ok(searchResult.items.some((item) => item.id === imageId));
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
