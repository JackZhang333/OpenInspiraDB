import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { nowIso } from '../core/database.js';
import {
  listTagTree,
  PRESET_PARENT_TAGS,
  PRESET_TAXONOMY,
  PRESET_TAXONOMY_EN,
  UNCATEGORIZED_TAG_NAME,
  getAppSetting,
} from '../core/tag-store.js';
import {
  calculateAllowedNewParentTags,
  calculateMaxParentTags,
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
const MAX_ORGANIZATION_EVIDENCE_TAGS = 20;
const MAX_ORGANIZATION_SAMPLE_CAPTIONS = 3;
const MAX_ORGANIZATION_COTAG_COUNT = 5;

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

async function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // HEIC 格式需要转换为 JPEG 才能被 AI 服务识别
  if (ext === '.heic') {
    try {
      // 使用 macOS 内置的 sips 命令转换 HEIC 到 JPEG
      const jpegPath = `${filePath}.temp.jpg`;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('HEIC conversion timeout'));
        }, 10000); // 10秒超时

        const proc = spawn('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', filePath, '--out', jpegPath]);

        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`sips exited with code ${code}`));
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const base64 = fs.readFileSync(jpegPath).toString('base64');
      fs.unlinkSync(jpegPath); // 删除临时文件
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      // 转换失败则发送原始 HEIC 数据（AI 服务会报错但不会卡住应用）
      const base64 = fs.readFileSync(filePath).toString('base64');
      return `data:${toMimeType(filePath)};base64,${base64}`;
    }
  }

  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${toMimeType(filePath)};base64,${base64}`;
}

function extractMessageText(content, reasoningContent) {
  // GLM-4.5 系列模型将推理内容放在 reasoning_content 中
  if (typeof reasoningContent === 'string' && reasoningContent.trim()) {
    return reasoningContent.trim();
  }

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

function getLanguage(db) {
  return getAppSetting(db, 'language', 'zh-CN');
}

function buildTaxonomyContext(db, language = 'zh-CN') {
  const customGroups = listTagTree(db)
    .filter((parent) => !PRESET_PARENT_TAGS.includes(parent.name) && parent.name !== UNCATEGORIZED_TAG_NAME && parent.name !== 'Uncategorized')
    .slice(0, MAX_CUSTOM_PARENT_COUNT)
    .map((parent) => {
      const childNames = parent.children
        .slice(0, MAX_CUSTOM_CHILDREN_PER_PARENT)
        .map((child) => child.name);

      return `${parent.name}：${childNames.length ? childNames.join(language === 'en' ? ', ' : '、') : (language === 'en' ? 'No sub-tags yet' : '暂无二级标签')}`;
    });

  // 根据语言选择预设标签
  const presetTaxonomy = language === 'en' ? PRESET_TAXONOMY_EN : PRESET_TAXONOMY;
  const presetGroups = presetTaxonomy.map((group) => `${group.name}：${group.children.join(language === 'en' ? ', ' : '、')}`);

  if (language === 'en') {
    return [
      'Please classify according to the following system preset categories:',
      ...presetGroups,
      customGroups.length ? 'Current tag library also has these extended categories (reuse when appropriate):' : '',
      ...customGroups,
      `If none of the above fit, you may create new parent categories or child tags; fallback parent category is "${language === 'en' ? 'Uncategorized' : UNCATEGORIZED_TAG_NAME}".`,
      'Child tag names are globally unique in the system, do not create duplicate names for different parent categories.',
    ].filter(Boolean).join('\n');
  }

  return [
    '请优先按以下系统预设分类标准归类：',
    ...presetGroups,
    customGroups.length ? '当前标签库中还存在以下扩展分类，可在合适时复用：' : '',
    ...customGroups,
    `如果以上都没有合适项，可新增一级分类或二级标签；兜底一级分类为「${language === 'en' ? 'Uncategorized' : UNCATEGORIZED_TAG_NAME}」.`,
    '同一个二级标签名在系统中全局唯一，不要为不同一级分类重复创造同名标签。',
  ].filter(Boolean).join('\n');
}

function buildSystemPrompt(language = 'zh-CN') {
  if (language === 'en') {
    return 'You are a design asset library analysis assistant. Please output ONLY a JSON object with format {"caption":"...","taxonomyTags":[{"parentName":"...","childName":"...","isNewParent":false,"isNewChild":false}]}. Caption should be in English, 30-90 words; taxonomyTags should return 4-8 short English tags; prioritize reusing system preset categories and existing tags, only create new ones when no suitable option exists; maximum 1 new parent category and 4 new child tags; do not output markdown or any additional explanations.';
  }
  return '你是设计素材库分析助手。请仅输出 JSON 对象，格式为 {"caption":"...","taxonomyTags":[{"parentName":"...","childName":"...","isNewParent":false,"isNewChild":false}]}。caption 使用简体中文，30到90字；taxonomyTags 返回4到8个中文短标签；优先复用系统预设分类和现有标签，只有没有合适项时才允许新增；最多新增1个一级分类、最多新增4个二级标签；不要输出 markdown 或额外解释。';
}

function buildUserPrompt(language = 'zh-CN') {
  if (language === 'en') {
    return 'Please analyze the main content, style, and searchable aspects of this design reference image, and provide suggestions for parent categories and child tags based on the existing tag system.\n\n';
  }
  return '请分析这张设计参考图的主要内容、风格和可检索要点，并根据现有标签体系给出一级分类与二级标签建议。\n\n';
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

function truncateInlineText(value, maxLength = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function buildTagEvidenceLines(db, candidates = [], language = 'zh-CN') {
  const output = [];

  for (const candidate of candidates) {
    const sampleRows = db.all(
      `SELECT DISTINCT i.id, COALESCE(c.content, '') AS caption
       FROM image_tags it
       JOIN images i ON i.id = it.image_id
       LEFT JOIN captions c ON c.id = i.active_caption_id
       WHERE it.tag_id = :tagId
       ORDER BY i.updated_at DESC, i.id DESC
       LIMIT :limit`,
      {
        tagId: candidate.id,
        limit: MAX_ORGANIZATION_SAMPLE_CAPTIONS,
      },
    );

    const coTagRows = db.all(
      `SELECT t.name, COUNT(*) AS total
       FROM image_tags base
       JOIN image_tags related ON related.image_id = base.image_id
       JOIN tags t ON t.id = related.tag_id
       WHERE base.tag_id = :tagId
         AND related.tag_id != :tagId
         AND t.level = 2
       GROUP BY related.tag_id
       ORDER BY total DESC, t.name ASC
       LIMIT :limit`,
      {
        tagId: candidate.id,
        limit: MAX_ORGANIZATION_COTAG_COUNT,
      },
    );

    const captionSummary = sampleRows
      .map((row) => truncateInlineText(row.caption, 42))
      .filter(Boolean)
      .join(' / ');

    const coTagSummary = coTagRows
      .map((row) => `${row.name}(${Number(row.total || 0)})`)
      .join(language === 'en' ? ', ' : '、');

    if (language === 'en') {
      output.push([
        `${candidate.name}[id:${candidate.id},parent:${candidate.parentName},count:${candidate.count}]`,
        coTagSummary ? `Co-occurrence: ${coTagSummary}` : 'Co-occurrence: no significant co-occurring tags',
        captionSummary ? `Caption samples: ${captionSummary}` : 'Caption samples: no captions',
      ].join('; '));
    } else {
      output.push([
        `${candidate.name}[id:${candidate.id},parent:${candidate.parentName},count:${candidate.count}]`,
        coTagSummary ? `共现：${coTagSummary}` : '共现：暂无明显共现标签',
        captionSummary ? `示例摘要：${captionSummary}` : '示例摘要：暂无图片文案',
      ].join('；'));
    }
  }

  return output;
}

function buildTagOrganizationContext(db, language = 'zh-CN') {
  const groups = listTagTree(db);
  const groupLines = groups.map((group) => {
    const childText = (group.children || []).length
      ? group.children.map((child) => `${child.name}[id:${child.id},count:${Number(child.usageCount || 0)}]`).join('、')
      : (language === 'en' ? 'No sub-tags' : '暂无二级标签');
    return `${group.name}[id:${group.id}]：${childText}`;
  });

  // 计算当前标签统计
  const parentCount = groups.length;
  const childCount = groups.reduce((sum, g) => sum + (g.children || []).length, 0);

  // 动态计算标签限制
  const maxParentTags = calculateMaxParentTags(childCount);
  const allowedNewParents = calculateAllowedNewParentTags(parentCount, childCount);

  const lowUsageTags = groups
    .flatMap((group) => (group.children || [])
      .filter((child) => Number(child.usageCount || 0) <= 5)
      .map((child) => ({
        name: child.name,
        id: child.id,
        parentName: group.name,
        count: Number(child.usageCount || 0),
      })))
    .sort((left, right) => left.count - right.count || left.name.localeCompare(right.name, language === 'en' ? 'en' : 'zh-Hans-CN'))
    .slice(0, 80);

  const presetTaxonomy = language === 'en' ? PRESET_TAXONOMY_EN : PRESET_TAXONOMY;
  const presetGroups = presetTaxonomy.map((group) => `${group.name}：${group.children.join(language === 'en' ? ', ' : '、')}`);
  const evidenceLines = buildTagEvidenceLines(db, lowUsageTags.slice(0, MAX_ORGANIZATION_EVIDENCE_TAGS), language);

  if (language === 'en') {
    return {
      text: [
        'Current database tags (format: tagName[id:ID,count:usageCount]):',
        ...(groupLines.length ? groupLines : ['No tags in database']),
        '',
        'Hidden preset word bank (reusable, or create new when inappropriate):',
        ...presetGroups,
        '',
        lowUsageTags.length ? `Low usage tags (<=5 times): ${lowUsageTags.map(t => `${t.name}[id:${t.id},count:${t.count}]`).join(', ')}` : 'No low usage tags.',
        '',
        evidenceLines.length ? 'Low-frequency tag sample evidence (reference for deciding create/merge/delete/move):' : '',
        ...evidenceLines,
      ].join('\n'),
      stats: {
        parentCount,
        childCount,
        maxParentTags,
        allowedNewParents,
      },
    };
  }

  return {
    text: [
      '当前数据库真实标签如下（格式：标签名[id:数字ID,count:使用次数]）：',
      ...(groupLines.length ? groupLines : ['暂无已落库标签']),
      '',
      '隐藏预设词库如下（可复用，也允许在不合适时造新词）：',
      ...presetGroups,
      '',
      lowUsageTags.length ? `低使用标签（<=5次）：${lowUsageTags.map(t => `${t.name}[id:${t.id},count:${t.count}]`).join('、')}` : '当前没有低使用标签。',
      '',
      evidenceLines.length ? '低频标签样例证据（优先参考这些标签决定是否新增/合并/删除/移动）：' : '',
      ...evidenceLines,
    ].join('\n'),
    stats: {
      parentCount,
      childCount,
      maxParentTags,
      allowedNewParents,
    },
  };
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

function truncateLogText(value, maxLength = 6000) {
  const text = String(value || '');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...[truncated]`;
}

export class ZhipuAiService {
  constructor(db, logger, options = {}) {
    this.db = db;
    this.logger = logger;
    this.modelConfig = options.modelConfig || defaultModelConfig;
    this.resolveImageForRead = typeof options.resolveImageForRead === 'function'
      ? options.resolveImageForRead
      : null;
  }

  getSettings() {
    const zhipuConfig = this.modelConfig?.zhipu || {};

    return {
      apiBase: String(zhipuConfig.apiBase || '').trim(),
      apiKey: String(zhipuConfig.apiKey || '').trim(),
      visionModel: String(zhipuConfig.visionModel || '').trim(),
      reasoningModel: String(zhipuConfig.reasoningModel || zhipuConfig.visionModel || '').trim(),
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
    const image = this.resolveImageForRead
      ? this.resolveImageForRead(imageId, { ensureThumbnail: true })
      : this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      const error = new Error('IMAGE_NOT_FOUND');
      error.code = 'IMAGE_NOT_FOUND';
      throw error;
    }

    const imageDataUrl = await fileToDataUrl(image.library_path);
    const settings = this.getSettings();
    const language = getLanguage(this.db);
    const taxonomyContext = buildTaxonomyContext(this.db, language);
    const systemPrompt = buildSystemPrompt(language);
    const userPrompt = buildUserPrompt(language);
    const response = await this.request('/chat/completions', {
      model: settings.visionModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${userPrompt}${taxonomyContext}`,
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

    const message = response?.choices?.[0]?.message;
    const rawContent = extractMessageText(message?.content, message?.reasoning_content);
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
    const language = getLanguage(this.db);
    const { text: contextText, stats } = buildTagOrganizationContext(this.db, language);
    const deleteStrategy = language === 'en'
      ? '[Delete Strategy] Only delete level-2 tags with 0 usage; deleting tags with associated images is prohibited'
      : '【删除策略】仅删除使用次数为0的二级标签；禁止删除有关联图片的标签';

    // 动态生成一级标签限制说明
    const parentLimitRule = language === 'en'
      ? `Dynamic parent tag limit: Currently ${stats.childCount} child tags, parent tag limit is ${stats.maxParentTags}. You can create up to ${stats.allowedNewParents} new parent tags.`
      : `一级标签数量动态限制：当前有 ${stats.childCount} 个二级标签，一级标签上限为 ${stats.maxParentTags} 个，最多可新增 ${stats.allowedNewParents} 个一级标签`;

    const systemPrompt = language === 'en'
      ? `You are a tag organization assistant. Output ONLY a JSON object with format {“operations”:[...]}, no reasoning or explanations.

Available operations:
- create: {“kind”:”create”,”level”:2,”name”:”new tag”,”parentName”:”parent category”,”source”:”generated”,”sourceTagId”:18,”reason”:”...”}
- rename: {“kind”:”rename”,”tagId”:12,”nextName”:”minimalist”,”reason”:”...”}
- merge: {“kind”:”merge”,”sourceTagId”:18,”targetTagName”:”minimalist”,”targetParentName”:”style”,”source”:”existing”,”reason”:”...”}
- move: {“kind”:”move”,”tagId”:28,”targetParentName”:”industry / usage”,”reason”:”...”}
- delete: {“kind”:”delete”,”tagId”:33,”replacementTargets”:[{“targetTagName”:”minimalist”,”targetParentName”:”style”,”source”:”existing”}],”reason”:”...”}

Organization rules (important):
1. [No parent deletion] Only level-2 tags can be deleted
2. [Handle “uncategorized” carefully] Don't delete tags under “uncategorized”; allow moving to more appropriate parent categories when classification is clear
3. create is only for adding parent categories or “batch deriving a new level-2 tag from existing source tag”. For new level-2 tags, must fill sourceTagId
4. merge migrates all image relationships from sourceTagId to an [EXISTING] target tag, then deletes sourceTagId (target must exist and cannot have same name as source)
5. move only changes parent category from A to B, without changing image-tag relationships
6. delete operation restrictions (extremely important):
   - Only level-2 tags with 0 usage can be deleted
   - Tags with any image associations cannot be deleted
   - If tag usage > 0, suggest merge (to semantically similar existing tag) or keep as-is
7. [Important merge rules]
   - merge target must be an [EXISTING] level-2 tag in database (source must be “existing”)
   - Don't suggest merging to same-name tags
   - Only suggest merge when tags are semantically highly similar
   - Low-frequency tags shouldn't merge to equally low-frequency tags; consider move instead
8. ${deleteStrategy}
9. Prioritize reusing existing tags, then preset word bank, only create new when necessary
10. Unify synonyms directly, don't keep multiple similar tags
11. ${parentLimitRule}
12. Max ${MAX_ORGANIZATION_NEW_CHILD_COUNT} new child tags
13. Must output JSON directly, no markdown or explanatory text`
      : `你是图片标签治理助手。请直接输出 JSON 对象，格式为 {“operations”:[...]}，不要有任何推理过程或解释文字。

可用操作类型：
- create: {“kind”:”create”,”level”:2,”name”:”新标签”,”parentName”:”一级分类”,”source”:”generated”,”sourceTagId”:18,”reason”:”...”}
- rename: {“kind”:”rename”,”tagId”:12,”nextName”:”极简”,”reason”:”...”}
- merge: {“kind”:”merge”,”sourceTagId”:18,”targetTagName”:”极简”,”targetParentName”:”风格”,”source”:”existing”,”reason”:”...”}
- move: {“kind”:”move”,”tagId”:28,”targetParentName”:”行业 / 用途”,”reason”:”...”}
- delete: {“kind”:”delete”,”tagId”:33,”replacementTargets”:[{“targetTagName”:”极简”,”targetParentName”:”风格”,”source”:”existing”}],”reason”:”...”}

整理规则（重要）：
1. 【禁止删除一级分类】只能删除二级标签
2. 【谨慎处理”未分组”分类】”未分组”下的标签不要删除；允许在分类明确时把它们移动到更合适的一级分类
3. create 仅用于新增一级分类，或”基于已有来源标签批量派生一个新二级标签”。如果是新增二级标签，必须填写 sourceTagId
4. merge 表示把 sourceTagId 的全部图片关系迁移到【已存在的】目标标签，再删除 sourceTagId（目标必须已存在且不能与源标签同名）
5. move 表示仅把一个二级标签从父分类 A 挪到父分类 B，不改变图片上的标签关系
6. delete 操作限制（极其重要）：
   - 仅允许删除使用次数为 0 的二级标签
   - 禁止删除有任何图片关联的标签
   - 如果标签使用次数 > 0，建议 merge 或保持现状
7. 【重要merge规则】
   - merge 目标必须是【已存在】的二级标签（source 必须是 “existing”）
   - 不要建议 merge 到同名标签
   - 只有当标签语义高度相似时才建议 merge
   - 低频标签不应 merge 到同样低频的标签，考虑 move 更合适
8. ${deleteStrategy}
9. 优先复用已有标签，其次预设词库，最后才造新词
10. 近义词直接统一，不保留多个相似标签
11. ${parentLimitRule}
12. 最多新增 ${MAX_ORGANIZATION_NEW_CHILD_COUNT} 个二级标签
13. 必须直接输出 JSON，禁止 markdown 或解释性文字`;

    const userPrompt = language === 'en'
      ? `Please provide a “preview first, then execute” organization plan based on the current tag database.

[Important judgment principles]
1. merge can only target [EXISTING] tags in database with similar semantics
2. Don't suggest merging to [same-name] tags
3. Don't suggest merging low-frequency tags to equally low-frequency tags
4. If low-frequency tags can't find semantically similar high-frequency merge targets, suggest move or keep as-is

${contextText}`
      : `请根据当前标签数据库给出一份”先预览、后执行”的整理方案。

【重要判断原则】
1. merge 只能合并到数据库中【已存在】的标签，且必须语义相近
2. 不要建议将标签合并到【同名】标签
3. 不要建议将低频标签合并到【同样低频】的标签
4. 如果低频标签找不到语义相近的高频合并目标，建议 move 或保持现状

${contextText}`;

    const response = await this.request('/chat/completions', {
      model: settings.reasoningModel || settings.visionModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const message = response?.choices?.[0]?.message;
    const rawContent = extractMessageText(message?.content, message?.reasoning_content);
    const operations = parseTagOrganizationPayload(rawContent);

    this.logger.info('zhipu-tag-organization-preview-generated', {
      model: settings.reasoningModel || settings.visionModel,
      operationCount: operations.length,
      operations,
      rawContent: truncateLogText(rawContent),
      fullResponse: JSON.stringify(response),
    });

    if (!operations.length) {
      this.logger.error('zhipu-tag-organization-preview-empty', {
        model: settings.reasoningModel || settings.visionModel,
        rawContent: truncateLogText(rawContent),
        responseChoices: JSON.stringify(response?.choices),
      });
    }

    return operations;
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
