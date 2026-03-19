import fs from 'node:fs';
import path from 'node:path';

import { nowIso } from '../core/database.js';
import { modelConfig as defaultModelConfig } from '../model-config.js';
import { buildEmbeddingText, getEffectiveTagNames } from '../utils/embedding.js';
import { uniqueNonEmptyTags } from '../utils/text.js';
import { normalizeVector } from '../utils/vector.js';
import { saveAiTags, upsertEmbedding } from './ai-persistence.js';

function toMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function fileToDataUrl(filePath) {
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${toMimeType(filePath)};base64,${base64}`;
}

function extractMessageText(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item?.type === 'text') {
          return item.text || '';
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function stripCodeFence(raw) {
  return String(raw || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function buildFallbackTags(fileName) {
  const baseName = String(fileName || '').replace(/\.[^.]+$/, '');
  const parts = baseName
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return uniqueNonEmptyTags(['设计参考', '视觉灵感', ...parts]).slice(0, 8);
}

function parseAnalysisPayload(rawText, image) {
  const cleanText = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(cleanText);
    const caption = String(parsed.caption || '').trim();
    const tags = uniqueNonEmptyTags(Array.isArray(parsed.tags) ? parsed.tags : []);
    if (caption) {
      return {
        caption,
        tags: tags.length ? tags.slice(0, 8) : buildFallbackTags(image.original_file_name),
      };
    }
  } catch {
    // Fallback below.
  }

  return {
    caption: cleanText || `这是一张与「${image.original_file_name}」相关的设计参考图。`,
    tags: buildFallbackTags(image.original_file_name),
  };
}

export class ZhipuAiService {
  constructor(db, logger, options = {}) {
    this.db = db;
    this.logger = logger;
    this.modelConfig = options.modelConfig || defaultModelConfig;
  }

  getSettings() {
    const zhipuConfig = this.modelConfig?.zhipu || {};

    return {
      apiBase: String(zhipuConfig.apiBase || '').trim(),
      apiKey: String(zhipuConfig.apiKey || '').trim(),
      visionModel: String(zhipuConfig.visionModel || '').trim(),
      embeddingModel: String(zhipuConfig.embeddingModel || '').trim(),
      embeddingDimensions: Number(zhipuConfig.embeddingDimensions),
    };
  }

  async request(endpoint, payload) {
    const settings = this.getSettings();
    if (!settings.apiKey) {
      const error = new Error('ZHIPU_API_KEY_MISSING');
      error.code = 'ZHIPU_API_KEY_MISSING';
      throw error;
    }

    const response = await fetch(`${settings.apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.error?.message || data?.message || text || 'ZHIPU_API_REQUEST_FAILED');
      error.code = data?.error?.code || data?.code || 'ZHIPU_API_REQUEST_FAILED';
      throw error;
    }

    return data;
  }

  async embedText(text) {
    const settings = this.getSettings();
    const response = await this.request('/embeddings', {
      model: settings.embeddingModel,
      input: String(text || ''),
      dimensions: settings.embeddingDimensions,
    });

    const embedding = response?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.length) {
      const error = new Error('ZHIPU_EMBEDDING_EMPTY');
      error.code = 'ZHIPU_EMBEDDING_EMPTY';
      throw error;
    }

    return normalizeVector(embedding.map((value) => Number(value)));
  }

  async analyzeImage(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      const error = new Error('IMAGE_NOT_FOUND');
      error.code = 'IMAGE_NOT_FOUND';
      throw error;
    }

    const imageDataUrl = fileToDataUrl(image.library_path);
    const settings = this.getSettings();
    const response = await this.request('/chat/completions', {
      model: settings.visionModel,
      messages: [
        {
          role: 'system',
          content: '你是设计素材库分析助手。请仅输出 JSON 对象，格式为 {"caption":"...","tags":["..."]}。caption 使用简体中文，30到90字；tags 返回4到8个中文短标签；不要输出 markdown 或额外解释。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张设计参考图的主要内容、风格和可检索要点。',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const rawContent = extractMessageText(response?.choices?.[0]?.message?.content);
    const { caption: aiCaption, tags: aiTags } = parseAnalysisPayload(rawContent, image);

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
          'zhipu',
          :modelName,
          :now,
          :now
        )`,
        {
          imageId,
          content: aiCaption,
          isActive: userActiveCaption ? 0 : 1,
          modelName: settings.visionModel,
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
      this.db.run(
        `UPDATE images
         SET analysis_status = 'ready',
             needs_embedding_refresh = 0,
             updated_at = :now
         WHERE id = :imageId`,
        { imageId, now },
      );
    });

    const finalCaption = this.db.get(
      `SELECT c.content
       FROM images i
       JOIN captions c ON c.id = i.active_caption_id
       WHERE i.id = :imageId`,
      { imageId },
    );

    const embeddingText = buildEmbeddingText(
      finalCaption?.content || aiCaption,
      getEffectiveTagNames(this.db, imageId),
    );
    const vector = await this.embedText(embeddingText);

    this.db.transaction(() => {
      upsertEmbedding(this.db, imageId, vector, 'zhipu', settings.embeddingModel);
      this.db.run(
        `UPDATE images
         SET needs_embedding_refresh = 0,
             updated_at = :now
         WHERE id = :imageId`,
        { imageId, now: nowIso() },
      );
    });

    this.logger.info('zhipu-ai-analysis-succeeded', { imageId, model: settings.visionModel });
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

    if (!activeCaption?.content) {
      const error = new Error('ACTIVE_CAPTION_NOT_FOUND');
      error.code = 'ACTIVE_CAPTION_NOT_FOUND';
      throw error;
    }

    const settings = this.getSettings();
    const embeddingText = buildEmbeddingText(activeCaption.content, getEffectiveTagNames(this.db, imageId));
    const vector = await this.embedText(embeddingText);

    this.db.transaction(() => {
      upsertEmbedding(this.db, imageId, vector, 'zhipu', settings.embeddingModel);
      this.db.run(
        `UPDATE images
         SET needs_embedding_refresh = 0,
             updated_at = :now
         WHERE id = :imageId`,
        { imageId, now: nowIso() },
      );
    });

    this.logger.info('zhipu-embedding-refresh-succeeded', { imageId, model: settings.embeddingModel });
  }
}
