import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { InspiraDBApp } from './inspiradb.js';
import {
  UNCATEGORIZED_TAG_NAME,
  ensureParentTag,
  ensureSecondaryTag,
  getTagByName,
} from './tag-store.js';

const NOW = '2026-03-19T00:00:00.000Z';

function createTestApp() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-tag-org-'));
  const app = new InspiraDBApp({
    rootDir,
    dbPath: path.join(rootDir, 'app.db'),
    libraryRootPath: path.join(rootDir, 'library'),
    thumbnailRootPath: path.join(rootDir, 'thumbs'),
    autoStartQueue: false,
  });

  return { app, rootDir };
}

function disposeTestApp(app, rootDir) {
  app.close();
  fs.rmSync(rootDir, { recursive: true, force: true });
}

function createChildTag(app, parentName, childName) {
  const parent = ensureParentTag(app.db, parentName, { createdAt: NOW });
  return ensureSecondaryTag(app.db, childName, {
    parentId: parent.id,
    createdAt: NOW,
  });
}

function createImageWithAiTags(app, { fileName, caption, tagIds }) {
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
      needs_embedding_refresh,
      created_at,
      updated_at
    ) VALUES (
      :fileName,
      :sourcePath,
      :libraryPath,
      :thumbnailPath,
      :md5Hash,
      1,
      100,
      100,
      'imported',
      'ready',
      'ai',
      0,
      :now,
      :now
    )`,
    {
      fileName,
      sourcePath: `/tmp/${fileName}`,
      libraryPath: `/tmp/library/${fileName}`,
      thumbnailPath: `/tmp/thumbs/${fileName}`,
      md5Hash: `${fileName}-hash`,
      now: NOW,
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
      'test-model',
      :now,
      :now
    )`,
    {
      imageId,
      content: caption,
      now: NOW,
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
       VALUES (:imageId, :tagId, 'ai', :createdAt)`,
      {
        imageId,
        tagId,
        createdAt: NOW,
      },
    );
  }

  return imageId;
}

function listImageTagNames(app, imageId) {
  return app.db.all(
    `SELECT t.name
     FROM image_tags it
     JOIN tags t ON t.id = it.tag_id
     WHERE it.image_id = :imageId
     ORDER BY t.name ASC`,
    { imageId },
  ).map((row) => row.name);
}

test('sanitizeTagOrganizationOperations enforces source tags, replacement cleanup, uncategorized delete protection, and terminal conflicts', () => {
  const { app, rootDir } = createTestApp();

  try {
    const sourceTag = createChildTag(app, '风格', '极简');
    const replacementTag = createChildTag(app, '风格', '轻奢');
    const uncategorizedTag = createChildTag(app, UNCATEGORIZED_TAG_NAME, '待整理');
    createImageWithAiTags(app, {
      fileName: 'source.jpg',
      caption: '极简风格海报',
      tagIds: [sourceTag.id],
    });
    createImageWithAiTags(app, {
      fileName: 'uncategorized.jpg',
      caption: '暂时未分组',
      tagIds: [uncategorizedTag.id],
    });

    const operations = app.sanitizeTagOrganizationOperations([
      { kind: 'create', level: 2, name: '奶油风', parentName: '风格', source: 'generated' },
      { kind: 'move', tagId: uncategorizedTag.id, targetParentName: '风格' },
      { kind: 'delete', tagId: uncategorizedTag.id, replacementTargets: [{ targetTagName: replacementTag.name, targetParentName: '风格', source: 'existing' }] },
      {
        kind: 'delete',
        tagId: sourceTag.id,
        replacementTargets: [
          { targetTagName: sourceTag.name, targetParentName: '风格', source: 'existing' },
          { targetTagName: replacementTag.name, targetParentName: '风格', source: 'existing' },
          { targetTagName: replacementTag.name, targetParentName: '风格', source: 'existing' },
          { targetTagName: '???', targetParentName: '风格', source: 'generated' },
        ],
      },
      { kind: 'merge', sourceTagId: sourceTag.id, targetTagName: '高级感', targetParentName: '情绪 / 氛围', source: 'preset' },
    ]);

    assert.equal(operations.length, 2);
    assert.equal(operations[0].kind, 'move');
    assert.equal(operations[0].tagId, uncategorizedTag.id);
    assert.equal(operations[1].kind, 'delete');
    assert.equal(operations[1].tagId, sourceTag.id);
    assert.deepEqual(
      operations[1].replacementTargets,
      [{ targetTagName: replacementTag.name, targetParentName: '风格', source: 'existing' }],
    );
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('applyTagOrganizationPlan creates child tags from a source tag and copies image relations', () => {
  const { app, rootDir } = createTestApp();

  try {
    const sourceTag = createChildTag(app, '风格', '极简');
    const imageIdA = createImageWithAiTags(app, {
      fileName: 'a.jpg',
      caption: '极简宣传图',
      tagIds: [sourceTag.id],
    });
    const imageIdB = createImageWithAiTags(app, {
      fileName: 'b.jpg',
      caption: '极简电商图',
      tagIds: [sourceTag.id],
    });

    const result = app.applyTagOrganizationPlan({
      operations: [
        {
          kind: 'create',
          level: 2,
          name: '奶油风',
          parentName: '风格',
          source: 'generated',
          sourceTagId: sourceTag.id,
        },
      ],
    });

    const createdTag = getTagByName(app.db, '奶油风');
    assert.ok(createdTag);
    assert.deepEqual(listImageTagNames(app, imageIdA), ['奶油风', '极简']);
    assert.deepEqual(listImageTagNames(app, imageIdB), ['奶油风', '极简']);
    assert.equal(result.appliedCount, 1);
    assert.equal(app.db.get('SELECT needs_embedding_refresh AS value FROM images WHERE id = :id', { id: imageIdA })?.value, 1);
    assert.equal(app.db.get('SELECT needs_embedding_refresh AS value FROM images WHERE id = :id', { id: imageIdB })?.value, 1);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('applyTagOrganizationPlan deletes in-use tags only after attaching replacement targets', () => {
  const { app, rootDir } = createTestApp();

  try {
    const sourceTag = createChildTag(app, '行业 / 用途', '专题页');
    const imageIdA = createImageWithAiTags(app, {
      fileName: 'topic-a.jpg',
      caption: '专题页设计',
      tagIds: [sourceTag.id],
    });
    const imageIdB = createImageWithAiTags(app, {
      fileName: 'topic-b.jpg',
      caption: '专题页 Banner',
      tagIds: [sourceTag.id],
    });

    const result = app.applyTagOrganizationPlan({
      operations: [
        {
          kind: 'delete',
          tagId: sourceTag.id,
          replacementTargets: [
            { targetTagName: 'Banner', targetParentName: '行业 / 用途', source: 'preset' },
            { targetTagName: '主视觉', targetParentName: '行业 / 用途', source: 'generated' },
          ],
        },
      ],
    });

    assert.equal(getTagByName(app.db, '专题页'), null);
    assert.deepEqual(listImageTagNames(app, imageIdA), ['Banner', '主视觉']);
    assert.deepEqual(listImageTagNames(app, imageIdB), ['Banner', '主视觉']);
    assert.equal(result.appliedCount, 1);
  } finally {
    disposeTestApp(app, rootDir);
  }
});

test('applyTagOrganizationPlan keeps move as parent change only and merge as relation migration', () => {
  const { app, rootDir } = createTestApp();

  try {
    const moveTag = createChildTag(app, 'A 分类', '子标签');
    const mergeSourceTag = createChildTag(app, '风格', '冷淡');
    const moveImageId = createImageWithAiTags(app, {
      fileName: 'move.jpg',
      caption: '移动测试',
      tagIds: [moveTag.id],
    });
    const mergeImageId = createImageWithAiTags(app, {
      fileName: 'merge.jpg',
      caption: '合并测试',
      tagIds: [mergeSourceTag.id],
    });

    const result = app.applyTagOrganizationPlan({
      operations: [
        { kind: 'move', tagId: moveTag.id, targetParentName: 'B 分类' },
        { kind: 'merge', sourceTagId: mergeSourceTag.id, targetTagName: '极简', targetParentName: '风格', source: 'preset' },
      ],
    });

    const movedTag = getTagByName(app.db, '子标签');
    assert.equal(movedTag.parentName, 'B 分类');
    assert.deepEqual(listImageTagNames(app, moveImageId), ['子标签']);
    assert.equal(getTagByName(app.db, '冷淡'), null);
    assert.deepEqual(listImageTagNames(app, mergeImageId), ['极简']);
    assert.equal(result.appliedCount, 2);
  } finally {
    disposeTestApp(app, rootDir);
  }
});
