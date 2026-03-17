import { nowIso } from '../core/database.js';
import { embedTextMock } from '../utils/vector.js';
import { uniqueNonEmptyTags } from '../utils/text.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenizeBaseName(baseName) {
  return baseName
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildMockCaption(image) {
  const fileName = image.original_file_name.replace(/\.[^.]+$/, '');
  return `这是一张与「${fileName}」相关的设计参考图，画面强调构图、材质和风格线索。`;
}

function buildMockTags(image) {
  const baseName = image.original_file_name.replace(/\.[^.]+$/, '');
  const tokens = tokenizeBaseName(baseName);
  const seedTags = ['设计参考', '视觉灵感'];
  const merged = [...seedTags, ...tokens.slice(0, 4)];
  return uniqueNonEmptyTags(merged).slice(0, 8);
}

function upsertEmbedding(db, imageId, vector) {
  const now = nowIso();
  const serialized = JSON.stringify(vector);
  const existing = db.get('SELECT id FROM embeddings WHERE image_id = :imageId', { imageId });
  if (existing) {
    db.run(
      `UPDATE embeddings
       SET vector = :vector,
           dimension = :dimension,
           model_provider = 'mock',
           model_name = 'mock-embed-v1',
           created_at = :now
       WHERE image_id = :imageId`,
      {
        imageId,
        vector: serialized,
        dimension: vector.length,
        now,
      },
    );
    return;
  }

  db.run(
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
      'mock',
      'mock-embed-v1',
      :now
    )`,
    {
      imageId,
      vector: serialized,
      dimension: vector.length,
      now,
    },
  );
}

function saveAiTags(db, imageId, tagNames) {
  const now = nowIso();
  db.run("DELETE FROM image_tags WHERE image_id = :imageId AND source = 'ai'", { imageId });

  for (const tagName of tagNames) {
    db.run(
      `INSERT INTO tags (name, language, created_at)
       VALUES (:name, 'zh', :createdAt)
       ON CONFLICT(name, language) DO NOTHING`,
      { name: tagName, createdAt: now },
    );

    const tag = db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", { name: tagName });
    if (tag) {
      db.run(
        `INSERT INTO image_tags (image_id, tag_id, source, created_at)
         VALUES (:imageId, :tagId, 'ai', :createdAt)
         ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
        { imageId, tagId: tag.id, createdAt: now },
      );
    }
  }
}

export class MockAiService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async analyzeImage(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      const error = new Error('IMAGE_NOT_FOUND');
      error.code = 'IMAGE_NOT_FOUND';
      throw error;
    }

    const pause = 200 + Math.floor(Math.random() * 1000);
    await sleep(pause);

    if (image.original_file_name.toLowerCase().includes('fail-ai')) {
      const error = new Error('MOCK_AI_FAILED');
      error.code = 'MOCK_AI_FAILED';
      throw error;
    }

    const aiCaption = buildMockCaption(image);
    const aiTags = buildMockTags(image);

    this.db.transaction(() => {
      const now = nowIso();
      const userActiveCaption = this.db.get(
        `SELECT id, content
         FROM captions
         WHERE image_id = :imageId
           AND source = 'user'
           AND is_active = 1
         LIMIT 1`,
        { imageId },
      );

      let activeCaptionContent = aiCaption;

      if (!userActiveCaption) {
        this.db.run('UPDATE captions SET is_active = 0 WHERE image_id = :imageId', { imageId });
      }

      const result = this.db.run(
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
          :isActive,
          'mock',
          'mock-caption-v1',
          :now,
          :now
        )`,
        {
          imageId,
          content: aiCaption,
          isActive: userActiveCaption ? 0 : 1,
          now,
        },
      );

      if (userActiveCaption) {
        activeCaptionContent = userActiveCaption.content;
      } else {
        this.db.run(
          `UPDATE images
           SET active_caption_id = :captionId,
               updated_at = :now
           WHERE id = :imageId`,
          {
            imageId,
            captionId: Number(result.lastInsertRowid),
            now,
          },
        );
      }

      saveAiTags(this.db, imageId, aiTags);

      const vector = embedTextMock(activeCaptionContent);
      upsertEmbedding(this.db, imageId, vector);

      this.db.run(
        `UPDATE images
         SET analysis_status = 'ready',
             needs_embedding_refresh = 0,
             updated_at = :now
         WHERE id = :imageId`,
        { imageId, now },
      );
    });

    this.logger.info('mock-ai-analysis-succeeded', { imageId });
  }

  async refreshEmbedding(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      const error = new Error('IMAGE_NOT_FOUND');
      error.code = 'IMAGE_NOT_FOUND';
      throw error;
    }

    const activeCaption = this.db.get(
      `SELECT id, content
       FROM captions
       WHERE id = :captionId
       LIMIT 1`,
      { captionId: image.active_caption_id },
    );

    if (!activeCaption) {
      const error = new Error('ACTIVE_CAPTION_NOT_FOUND');
      error.code = 'ACTIVE_CAPTION_NOT_FOUND';
      throw error;
    }

    if (activeCaption.content.includes('[fail-embed]')) {
      const error = new Error('EMBEDDING_REFRESH_FAILED');
      error.code = 'EMBEDDING_REFRESH_FAILED';
      throw error;
    }

    await sleep(50 + Math.floor(Math.random() * 100));

    this.db.transaction(() => {
      const vector = embedTextMock(activeCaption.content);
      upsertEmbedding(this.db, imageId, vector);
      this.db.run(
        `UPDATE images
         SET needs_embedding_refresh = 0,
             updated_at = :now
         WHERE id = :imageId`,
        { imageId, now: nowIso() },
      );
    });

    this.logger.info('embedding-refresh-succeeded', { imageId });
  }
}
