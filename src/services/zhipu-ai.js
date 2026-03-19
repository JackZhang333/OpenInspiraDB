import fs from 'node:fs';
import path from 'node:path';

import { nowIso } from '../core/database.js';
import {
  listTagTree,
  PRESET_PARENT_TAGS,
  PRESET_TAXONOMY,
  UNCATEGORIZED_TAG_NAME,
} from '../core/tag-store.js';
import {
  MAX_ORGANIZATION_NEW_CHILD_COUNT,
  MAX_ORGANIZATION_NEW_PARENT_COUNT,
  normalizeOrganizationOperations,
} from '../core/tag-organization.js';
import { modelConfig as defaultModelConfig } from '../model-config.js';
import { buildEmbeddingText, getEffectiveTagNames } from '../utils/embedding.js';
import { normalizeTagName, uniqueNonEmptyTags } from '../utils/text.js';
import { normalizeVector } from '../utils/vector.js';
import { saveAiTags, upsertEmbedding } from './ai-persistence.js';

const MAX_CUSTOM_PARENT_COUNT = 10;
const MAX_CUSTOM_CHILDREN_PER_PARENT = 16;

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

function buildFallbackTaxonomyTags(fileName) {
  return buildFallbackTags(fileName).map((tagName) => ({
    parentName: UNCATEGORIZED_TAG_NAME,
    childName: tagName,
    isNewParent: false,
    isNewChild: true,
  }));
}

function normalizeTaxonomyTags(items) {
  const seen = new Set();
  const output = [];

  for (const rawItem of Array.isArray(items) ? items : []) {
    const childName = normalizeTagName(String(rawItem?.childName || ''));
    if (!childName || seen.has(childName)) {
      continue;
    }

    seen.add(childName);
    output.push({
      parentName: normalizeTagName(String(rawItem?.parentName || '')),
      childName,
      isNewParent: Boolean(rawItem?.isNewParent),
      isNewChild: Boolean(rawItem?.isNewChild),
    });
  }

  return output.slice(0, 8);
}

function buildTaxonomyContext(db) {
  const customGroups = listTagTree(db)
    .filter((parent) => !PRESET_PARENT_TAGS.includes(parent.name) && parent.name !== UNCATEGORIZED_TAG_NAME)
    .slice(0, MAX_CUSTOM_PARENT_COUNT)
    .map((parent) => {
      const childNames = parent.children
        .slice(0, MAX_CUSTOM_CHILDREN_PER_PARENT)
        .map((child) => child.name);

      return `${parent.name}：${childNames.length ? childNames.join('、') : '暂无二级标签'}`;
    });

  const presetGroups = PRESET_TAXONOMY.map((group) => `${group.name}：${group.children.join('、')}`);

  return [
    '请优先按以下系统预设分类标准归类：',
    ...presetGroups,
    customGroups.length ? '当前标签库中还存在以下扩展分类，可在合适时复用：' : '',
    ...customGroups,
    `如果以上都没有合适项，可新增一级分类或二级标签；兜底一级分类为「${UNCATEGORIZED_TAG_NAME}」。`,
    '同一个二级标签名在系统中全局唯一，不要为不同一级分类重复创造同名标签。',
  ].filter(Boolean).join('\n');
}

function parseAnalysisPayload(rawText, image) {
  const cleanText = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(cleanText);
    const caption = String(parsed.caption || '').trim();
    const taxonomyTags = normalizeTaxonomyTags(parsed.taxonomyTags);
    const tags = uniqueNonEmptyTags(Array.isArray(parsed.tags) ? parsed.tags : []);
    if (caption) {
      return {
        caption,
        taxonomyTags: taxonomyTags.length
          ? taxonomyTags
          : tags.length
            ? tags.slice(0, 8).map((tagName) => ({
              parentName: UNCATEGORIZED_TAG_NAME,
              childName: tagName,
              isNewParent: false,
              isNewChild: true,
            }))
            : buildFallbackTaxonomyTags(image.original_file_name),
      };
    }
  } catch {
    // Fallback below.
  }

  return {
    caption: cleanText || `这是一张与「${image.original_file_name}」相关的设计参考图。`,
    taxonomyTags: buildFallbackTaxonomyTags(image.original_file_name),
  };
}

function buildTagOrganizationContext(db) {
  const groups = listTagTree(db);
  const groupLines = groups.map((group) => {
    const childText = (group.children || []).length
      ? group.children.map((child) => `${child.name}(${Number(child.usageCount || 0)})`).join('、')
      : '暂无二级标签';
    return `${group.name}：${childText}`;
  });

  const lowUsageTags = groups
    .flatMap((group) => (group.children || [])
      .filter((child) => Number(child.usageCount || 0) <= 5)
      .map((child) => `${child.name}(${Number(child.usageCount || 0)})`))
    .slice(0, 80);

  const presetGroups = PRESET_TAXONOMY.map((group) => `${group.name}：${group.children.join('、')}`);

  return [
    '当前数据库真实标签如下：',
    ...(groupLines.length ? groupLines : ['暂无已落库标签']),
    '',
    '隐藏预设词库如下（可复用，也允许在不合适时造新词）：',
    ...presetGroups,
    '',
    lowUsageTags.length ? `低使用标签（使用次数 <= 5）：${lowUsageTags.join('、')}` : '当前没有低使用标签。',
  ].join('\n');
}

function parseTagOrganizationPayload(rawText) {
  const cleanText = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(cleanText);
    return normalizeOrganizationOperations(parsed?.operations);
  } catch {
    return [];
  }
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
    const taxonomyContext = buildTaxonomyContext(this.db);
    const response = await this.request('/chat/completions', {
      model: settings.visionModel,
      messages: [
        {
          role: 'system',
          content: '你是设计素材库分析助手。请仅输出 JSON 对象，格式为 {"caption":"...","taxonomyTags":[{"parentName":"...","childName":"...","isNewParent":false,"isNewChild":false}]}。caption 使用简体中文，30到90字；taxonomyTags 返回4到8个中文短标签；优先复用系统预设分类和现有标签，只有没有合适项时才允许新增；最多新增1个一级分类、最多新增4个二级标签；不要输出 markdown 或额外解释。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请分析这张设计参考图的主要内容、风格和可检索要点，并根据现有标签体系给出一级分类与二级标签建议。\n\n${taxonomyContext}`,
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
    const { caption: aiCaption, taxonomyTags } = parseAnalysisPayload(rawContent, image);

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

      saveAiTags(this.db, imageId, { taxonomyTags });
      this.db.run(
        `UPDATE images
         SET analysis_status = 'ready',
             active_tag_source = 'ai',
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

  async previewTagOrganization() {
    const settings = this.getSettings();
    const context = buildTagOrganizationContext(this.db);
    const response = await this.request('/chat/completions', {
      model: settings.visionModel,
      messages: [
        {
          role: 'system',
          content: `你是图片标签治理助手。请仅输出 JSON 对象，格式为 {"operations":[...]}。可用操作只有 create、rename、merge、move、delete。
create 形如 {"kind":"create","level":2,"name":"新标签","parentName":"一级分类","source":"generated","reason":"..."}；
rename 形如 {"kind":"rename","tagId":12,"nextName":"极简","reason":"..."}；
merge 形如 {"kind":"merge","sourceTagId":18,"targetTagName":"极简","targetParentName":"风格","source":"existing","reason":"..."}；
move 形如 {"kind":"move","tagId":28,"targetParentName":"行业 / 用途","reason":"..."}；
delete 形如 {"kind":"delete","tagId":33,"reason":"..."}。
规则：
1. 优先复用已有标签，其次复用预设词库，最后才允许造新词。
2. 遇到近义词直接统一，不要为相近概念保留多个标签。
3. 使用次数 <= 5 的标签优先考虑合并或删除。
4. 允许造新词，但必须是中文短标签或必要的简短行业术语；不要输出泛词。
5. 最多新增 ${MAX_ORGANIZATION_NEW_PARENT_COUNT} 个一级标签、最多新增 ${MAX_ORGANIZATION_NEW_CHILD_COUNT} 个二级标签。
6. 不要输出 markdown，不要输出解释性段落，只输出 JSON。`,
        },
        {
          role: 'user',
          content: `请根据当前标签数据库给出一份“先预览、后执行”的整理方案。\n\n${context}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const rawContent = extractMessageText(response?.choices?.[0]?.message?.content);
    return parseTagOrganizationPayload(rawContent);
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
