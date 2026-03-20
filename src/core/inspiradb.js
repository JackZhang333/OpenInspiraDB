import fs from 'node:fs';
import path from 'node:path';

import {
  defaultPaths,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_COUNT,
  SEARCH_PAGE_SIZE,
  IMAGE_STATUS,
  JOB_STATUS,
} from './config.js';
import { InspiraDatabase, nowIso } from './database.js';
import {
  ensureDirectories,
  walkFilesRecursive,
  isSupportedImageFile,
  copyFile,
  createThumbnailPlaceholder,
  buildLibraryPath,
  buildThumbnailPath,
  removeFileIfExists,
} from '../utils/files.js';
import { md5File } from '../utils/hash.js';
import { cosineDistance } from '../utils/vector.js';
import { normalizeTagName, uniqueNonEmptyTags } from '../utils/text.js';
import {
  buildXmpSidecarPathForImage,
  readXmpMetadataForImage,
  writeXmpForImage,
} from '../utils/xmp.js';
import {
  DEFAULT_TAG_FILTER_MODE,
  TAG_LEVEL_CHILD,
  TAG_LEVEL_PARENT,
  UNCATEGORIZED_TAG_NAME,
  ensureParentTag,
  findPresetTaxonomyMatch,
  getAppSetting,
  getTagById,
  getTagByName,
  getTagFilterMode as readTagFilterMode,
  getUncategorizedParentTag,
  listEffectiveTagRecords,
  listImageTagsBySource,
  listParentTags,
  listTagTree,
  normalizeTagFilterMode,
  normalizeTagIds,
  resolveSecondaryTagIdsByNames,
  setAppSetting,
  validateSecondaryTagIds,
  cleanupUnusedPresetTags,
  ensureSecondaryTag,
} from './tag-store.js';
import {
  isValidGeneratedTagName,
  MAX_ORGANIZATION_NEW_CHILD_COUNT,
  MAX_ORGANIZATION_NEW_PARENT_COUNT,
  normalizeOrganizationOperations,
  normalizeOrganizationSource,
  summarizeOrganizationOperations,
  TAG_ORGANIZATION_LOW_USAGE_THRESHOLD,
  TAG_ORGANIZATION_RECOMMENDED_INTERVAL_DAYS,
} from './tag-organization.js';
import { createLogger } from '../utils/logger.js';
import { modelConfig as defaultModelConfig } from '../model-config.js';
import { RoutedAiService } from '../services/ai-factory.js';
import { AnalysisQueue } from '../services/analysis-queue.js';

function resolveExistingFilePath(filePath) {
  if (!fs.existsSync(filePath)) {
    const error = new Error('FILE_NOT_FOUND');
    error.code = 'FILE_NOT_FOUND';
    throw error;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    const error = new Error('NOT_A_FILE');
    error.code = 'NOT_A_FILE';
    throw error;
  }

  return { filePath: path.resolve(filePath), stat };
}

function resolveExistingFolderPath(folderPath) {
  if (!fs.existsSync(folderPath)) {
    const error = new Error('FOLDER_NOT_FOUND');
    error.code = 'FOLDER_NOT_FOUND';
    throw error;
  }

  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    const error = new Error('NOT_A_FOLDER');
    error.code = 'NOT_A_FOLDER';
    throw error;
  }

  return path.resolve(folderPath);
}

function toJsonVector(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function buildInClauseParams(prefix, values) {
  const placeholders = [];
  const params = {};

  values.forEach((value, index) => {
    const key = `${prefix}${index}`;
    placeholders.push(`:${key}`);
    params[key] = value;
  });

  return {
    clause: placeholders.join(', '),
    params,
  };
}

function fingerprintOrganizationOperation(operation = {}) {
  if (operation.kind === 'create') {
    return `create:${operation.level}:${operation.name}:${operation.parentName || ''}:${operation.sourceTagId || 0}`;
  }
  if (operation.kind === 'rename') {
    return `rename:${operation.tagId}:${operation.nextName}`;
  }
  if (operation.kind === 'merge') {
    return `merge:${operation.sourceTagId}:${operation.targetTagName}:${operation.targetParentName || ''}`;
  }
  if (operation.kind === 'move') {
    return `move:${operation.tagId}:${operation.targetParentName || ''}`;
  }
  if (operation.kind === 'delete') {
    const replacementFingerprint = (Array.isArray(operation.replacementTargets) ? operation.replacementTargets : [])
      .map((target) => [
        target?.targetTagName || '',
        target?.targetParentName || '',
        normalizeOrganizationSource(target?.source),
      ].join(':'))
      .join('|');
    return `delete:${operation.tagId}:${replacementFingerprint}`;
  }
  return JSON.stringify(operation);
}

function diffOrganizationOperations(before = [], after = []) {
  const afterFingerprints = new Set(after.map((operation) => fingerprintOrganizationOperation(operation)));
  return before.filter((operation) => !afterFingerprints.has(fingerprintOrganizationOperation(operation)));
}

function getOrganizationSubjectTagId(operation = {}) {
  if (operation.kind === 'create' || operation.kind === 'merge') {
    return Number(operation.sourceTagId || 0);
  }
  if (operation.kind === 'rename' || operation.kind === 'move' || operation.kind === 'delete') {
    return Number(operation.tagId || 0);
  }
  return 0;
}

function isUncategorizedChildTag(tag) {
  const isUncategorizedParent = tag?.parentName === UNCATEGORIZED_TAG_NAME ||
    tag?.parentName?.toLowerCase() === 'uncategorized';
  return tag?.level === TAG_LEVEL_CHILD && isUncategorizedParent;
}

function getOrganizationDeleteThreshold(snapshot = {}) {
  // 仅允许删除使用次数为 0 的标签
  return 0;
}

function normalizeSelectedTagIds(db, selectedTagIds = []) {
  const normalizedIds = normalizeTagIds(selectedTagIds);
  if (normalizedIds.length > 0) {
    return normalizedIds;
  }

  if (!Array.isArray(selectedTagIds) || selectedTagIds.length === 0) {
    return [];
  }

  return resolveSecondaryTagIdsByNames(db, selectedTagIds);
}

function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenTagTree(tagTree = []) {
  return (tagTree || []).flatMap((group) => [
    {
      id: Number(group.id),
      name: group.name,
      level: TAG_LEVEL_PARENT,
      parentId: null,
      isSystem: Boolean(group.isSystem),
      usageCount: Number(group.usageCount || 0),
    },
    ...((group.children || []).map((child) => ({
      id: Number(child.id),
      name: child.name,
      level: TAG_LEVEL_CHILD,
      parentId: Number(group.id),
      parentName: group.name,
      isSystem: Boolean(child.isSystem),
      usageCount: Number(child.usageCount || 0),
    }))),
  ]);
}

function daysSinceIso(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
}

const SEARCH_INTENT_RULES = [
  {
    name: 'cute',
    match: /可爱|萌|萌系|治愈|童趣|软萌|可爱的样子/u,
    semanticExpansions: ['可爱', '萌', '童趣', '温柔', '婴儿', '新生儿', '宝宝'],
    lexicalExpansions: ['婴儿', '新生儿', '宝宝', '儿童'],
    positiveSignals: [
      { terms: ['婴儿', '新生儿', '宝宝', '婴童'], score: 18 },
      { terms: ['儿童', '小孩', '男孩', '女孩', '亲子'], score: 12 },
      { terms: ['猫', '狗', '兔', '熊猫', '宠物', '小鸟', '鸟儿', '猫头鹰'], score: 5 },
    ],
    negativeSignals: [
      { terms: ['自然风光', '风景', '海滩', '水面', '涟漪', '建筑', '教堂', '几何', '科技感', '园艺'], score: -4 },
    ],
  },
  {
    name: 'infant',
    match: /婴儿|新生儿|宝宝|婴童/u,
    semanticExpansions: ['婴儿', '新生儿', '宝宝', '婴童'],
    lexicalExpansions: ['婴儿', '新生儿', '宝宝'],
    positiveSignals: [
      { terms: ['婴儿', '新生儿', '宝宝', '婴童'], score: 20 },
      { terms: ['儿童', '小孩', '男孩', '女孩'], score: 10 },
    ],
    negativeSignals: [
      { terms: ['自然风光', '风景', '海滩', '建筑', '几何', '科技感'], score: -4 },
    ],
  },
  {
    name: 'landscape',
    match: /自然风景|自然风光|风景|海景|山景|日落/u,
    semanticExpansions: ['自然风景', '自然风光', '风景', '海滩', '山景', '日落'],
    lexicalExpansions: ['自然风景', '自然风光', '风景', '海滩'],
    positiveSignals: [
      { terms: ['自然风光', '风景', '海滩', '水面', '涟漪', '绿树', '樱花', '山景', '日落'], score: 12 },
    ],
  },
];

function mergeWeightedTerm(termMap, term, weight) {
  const normalized = normalizeSearchText(term);
  if (!normalized) {
    return;
  }

  const existing = termMap.get(normalized);
  if (!existing || existing.weight < weight) {
    termMap.set(normalized, { term: normalized, weight });
  }
}

function collectWeightedSearchTerms(query, baseWeight = 1) {
  const normalized = normalizeSearchText(query);
  const terms = new Map();

  if (!normalized) {
    return [];
  }

  mergeWeightedTerm(terms, normalized, 1 * baseWeight);

  const words = normalized
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const word of words) {
    mergeWeightedTerm(terms, word, 0.94 * baseWeight);
    if (/[儿兒]$/u.test(word) && word.length > 1) {
      mergeWeightedTerm(terms, word.replace(/[儿兒]$/u, ''), 0.82 * baseWeight);
    }
  }

  const hanText = normalized.replace(/[^\p{Script=Han}]+/gu, '');
  if (hanText) {
    mergeWeightedTerm(terms, hanText, 0.96 * baseWeight);

    if (/[儿兒]$/u.test(hanText) && hanText.length > 1) {
      mergeWeightedTerm(terms, hanText.replace(/[儿兒]$/u, ''), 0.82 * baseWeight);
    }

    for (let index = 0; index < hanText.length - 1; index += 1) {
      mergeWeightedTerm(terms, hanText.slice(index, index + 2), 0.72 * baseWeight);
    }

    if (hanText.length <= 6) {
      for (let index = 0; index < hanText.length - 2; index += 1) {
        mergeWeightedTerm(terms, hanText.slice(index, index + 3), 0.62 * baseWeight);
      }
    }
  }

  return Array.from(terms.values());
}

function buildSearchProfile(query) {
  const normalized = normalizeSearchText(query);
  const lexicalTerms = new Map();
  const semanticTerms = new Set();
  const intents = [];

  for (const entry of collectWeightedSearchTerms(normalized, 1)) {
    mergeWeightedTerm(lexicalTerms, entry.term, entry.weight);
    semanticTerms.add(entry.term);
  }

  for (const rule of SEARCH_INTENT_RULES) {
    if (!rule.match.test(normalized)) {
      continue;
    }

    intents.push(rule);

    for (const term of rule.semanticExpansions || []) {
      semanticTerms.add(normalizeSearchText(term));
    }

    for (const term of rule.lexicalExpansions || []) {
      for (const entry of collectWeightedSearchTerms(term, 0.88)) {
        mergeWeightedTerm(lexicalTerms, entry.term, entry.weight);
      }
    }
  }

  return {
    normalized,
    hanText: normalized.replace(/[^\p{Script=Han}]+/gu, ''),
    semanticText: Array.from(semanticTerms).filter(Boolean).join(' '),
    lexicalTerms: Array.from(lexicalTerms.values()),
    intents,
  };
}

function matchesSignalTerm(text, term) {
  const normalizedText = normalizeSearchText(text);
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  return normalizedText.includes(normalizedTerm);
}

function scoreSearchIntent(profile, activeCaption, tags) {
  if (!profile?.intents?.length) {
    return 0;
  }

  const haystacks = [activeCaption?.content || '', ...(tags || [])].map((value) => normalizeSearchText(value));
  let total = 0;

  for (const rule of profile.intents) {
    for (const signal of rule.positiveSignals || []) {
      if (signal.terms.some((term) => haystacks.some((text) => matchesSignalTerm(text, term)))) {
        total += signal.score;
      }
    }

    for (const signal of rule.negativeSignals || []) {
      if (signal.terms.some((term) => haystacks.some((text) => matchesSignalTerm(text, term)))) {
        total += signal.score;
      }
    }
  }

  return total;
}

function scoreSearchTextMatch(profile, image, activeCaption, tags) {
  const queryTerms = profile?.lexicalTerms || [];
  if (!queryTerms.length) {
    return 0;
  }

  const fileName = normalizeSearchText(String(image?.original_file_name || '').replace(/\.[^.]+$/, ''));
  const caption = normalizeSearchText(activeCaption?.content || '');
  const normalizedTags = (tags || []).map((tag) => normalizeSearchText(tag));
  const haystacks = [fileName, caption, ...normalizedTags].filter(Boolean);

  let bestScore = 0;

  for (const { term, weight } of queryTerms) {
    const isSingleHan = /^\p{Script=Han}$/u.test(term);
    const childSuffixBase = profile.hanText?.replace(/[儿兒]$/u, '');
    const allowSingleHanPartial = isSingleHan && childSuffixBase === term && term.length === 1;

    for (const tag of normalizedTags) {
      if (tag === term) {
        bestScore = Math.max(bestScore, 12 * weight);
      } else if (((!isSingleHan && term.length >= 2) || allowSingleHanPartial) && (tag.includes(term) || term.includes(tag))) {
        bestScore = Math.max(bestScore, 9 * weight);
      }
    }

    for (const text of [caption, fileName]) {
      if (text === term) {
        bestScore = Math.max(bestScore, 8 * weight);
      } else if (((!isSingleHan && term.length >= 2) || allowSingleHanPartial) && text.includes(term)) {
        bestScore = Math.max(bestScore, 6 * weight);
      }
    }
  }

  const chars = Array.from(new Set(profile.hanText?.match(/\p{Script=Han}/gu) || []));
  if (chars.length >= 2) {
    for (const text of haystacks) {
      const covered = chars.filter((char) => text.includes(char)).length / chars.length;
      if (covered >= 1) {
        bestScore = Math.max(bestScore, 3);
      } else if (covered >= 0.6) {
        bestScore = Math.max(bestScore, 1 + covered);
      }
    }
  }

  return bestScore;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImageIds(imageIds) {
  return Array.from(
    new Set(
      (imageIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

function sanitizeExportFileName(fileName, fallback = 'image.jpg') {
  const cleaned = String(fileName || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_');
  return cleaned || fallback;
}

function appendOriginalExtensionIfMissing(filePath, originalFileName) {
  if (path.extname(filePath)) {
    return filePath;
  }

  const originalExt = path.extname(String(originalFileName || '')).toLowerCase();
  if (!originalExt) {
    return filePath;
  }

  return `${filePath}${originalExt}`;
}

export class InspiraDBApp {
  constructor({
    rootDir = process.cwd(),
    dbPath,
    libraryRootPath,
    thumbnailRootPath,
    autoStartQueue = true,
    modelConfig = defaultModelConfig,
  } = {}) {
    const defaults = defaultPaths(rootDir);

    this.paths = {
      dbPath: dbPath || defaults.dbPath,
      libraryRootPath: libraryRootPath || defaults.libraryRootPath,
      thumbnailRootPath: thumbnailRootPath || defaults.thumbnailRootPath,
    };

    ensureDirectories([path.dirname(this.paths.dbPath), this.paths.libraryRootPath, this.paths.thumbnailRootPath]);

    this.logger = createLogger('inspiradb');
    this.db = new InspiraDatabase(this.paths.dbPath);
    cleanupUnusedPresetTags(this.db);
    this.modelConfig = modelConfig;

    this.aiService = new RoutedAiService(this.db, this.logger, {
      modelConfig: this.modelConfig,
    });
    this.queue = new AnalysisQueue({
      db: this.db,
      aiService: this.aiService,
      logger: this.logger,
    });

    if (autoStartQueue) {
      this.queue.start();
    }
  }

  close() {
    this.queue.stop();
    this.db.close();
  }

  getImageCount() {
    const row = this.db.get('SELECT COUNT(*) AS total FROM images');
    return Number(row?.total || 0);
  }

  getTagFilterMode() {
    return readTagFilterMode(this.db);
  }

  setTagFilterMode(mode) {
    const nextMode = normalizeTagFilterMode(mode);
    setAppSetting(this.db, 'tag_filter_mode', nextMode, nowIso());
    return {
      mode: nextMode,
    };
  }

  getSetting(key, fallback = '') {
    return getAppSetting(this.db, key, fallback);
  }

  setSetting(key, value) {
    setAppSetting(this.db, key, value, nowIso());
    return { key, value };
  }

  getTagOrganizationStatus() {
    const lastOrganizedAt = getAppSetting(this.db, 'last_tag_organization_at', '');
    const daysSinceLastOrganization = daysSinceIso(lastOrganizedAt);

    return {
      lastOrganizedAt: lastOrganizedAt || '',
      daysSinceLastOrganization,
      recommended: daysSinceLastOrganization == null
        || daysSinceLastOrganization >= TAG_ORGANIZATION_RECOMMENDED_INTERVAL_DAYS,
      intervalDays: TAG_ORGANIZATION_RECOMMENDED_INTERVAL_DAYS,
    };
  }

  buildTagOrganizationSnapshot() {
    const tagTree = listTagTree(this.db);
    const flatTags = flattenTagTree(tagTree);
    const tagById = new Map(flatTags.map((tag) => [Number(tag.id), tag]));
    const tagByName = new Map(flatTags.map((tag) => [String(tag.name), tag]));
    const imageCount = this.getImageCount();

    return {
      tagTree,
      flatTags,
      tagById,
      tagByName,
      imageCount,
      lowUsageTagCount: flatTags.filter(
        (tag) => tag.level === TAG_LEVEL_CHILD && Number(tag.usageCount || 0) <= TAG_ORGANIZATION_LOW_USAGE_THRESHOLD,
      ).length,
    };
  }

  reservePlannedOrganizationParent(parentName, snapshot, state) {
    const normalizedParentName = normalizeTagName(parentName);
    if (!normalizedParentName) {
      return false;
    }

    const existingParent = snapshot.tagByName.get(normalizedParentName);
    if (existingParent) {
      return existingParent.level === TAG_LEVEL_PARENT;
    }

    if (state.plannedParentNames.has(normalizedParentName)) {
      return true;
    }

    if (!isValidGeneratedTagName(normalizedParentName) || state.newParentCount >= MAX_ORGANIZATION_NEW_PARENT_COUNT) {
      return false;
    }

    state.plannedParentNames.add(normalizedParentName);
    state.newParentCount += 1;
    return true;
  }

  reservePlannedOrganizationChild(target, snapshot, state) {
    const childName = normalizeTagName(target?.targetTagName || target?.name);
    if (!childName) {
      return null;
    }

    const existingChild = snapshot.tagByName.get(childName);
    if (existingChild) {
      return existingChild.level === TAG_LEVEL_CHILD
        ? {
          targetTagName: existingChild.name,
          targetParentName: existingChild.parentName,
          source: normalizeOrganizationSource(target?.source),
        }
        : null;
    }

    const source = normalizeOrganizationSource(target?.source);
    let targetParentName = normalizeTagName(target?.targetParentName || target?.parentName || '');

    if (state.plannedChildNames.has(childName)) {
      return {
        targetTagName: childName,
        targetParentName,
        source,
      };
    }

    if (source === 'preset') {
      const presetMatch = findPresetTaxonomyMatch(targetParentName, childName);
      if (!presetMatch) {
        return null;
      }
      targetParentName = presetMatch.parentName;
    } else {
      if (!isValidGeneratedTagName(childName) || !targetParentName || !isValidGeneratedTagName(targetParentName)) {
        return null;
      }
    }

    if (!this.reservePlannedOrganizationParent(targetParentName, snapshot, state)) {
      return null;
    }
    if (state.newChildCount >= MAX_ORGANIZATION_NEW_CHILD_COUNT) {
      return null;
    }

    state.plannedChildNames.add(childName);
    state.newChildCount += 1;

    return {
      targetTagName: childName,
      targetParentName,
      source,
    };
  }

  sanitizeDeleteReplacementTargets(rawTargets, current, snapshot, state) {
    const output = [];
    const seenTargets = new Set();

    for (const rawTarget of Array.isArray(rawTargets) ? rawTargets : []) {
      const childName = normalizeTagName(rawTarget?.targetTagName);
      if (!childName || childName === current.name) {
        continue;
      }

      // 检查目标标签是否已存在
      const existingChild = snapshot.tagByName.get(childName);
      if (existingChild) {
        if (existingChild.level === TAG_LEVEL_CHILD) {
          const fingerprint = `${existingChild.name}:${existingChild.parentName}:existing`;
          if (!seenTargets.has(fingerprint)) {
            seenTargets.add(fingerprint);
            output.push({
              targetTagName: existingChild.name,
              targetParentName: existingChild.parentName,
              source: 'existing',
            });
          }
        }
        continue;
      }

      // 对于不存在的标签，如果是有效的生成名称，允许创建
      const targetParentName = normalizeTagName(rawTarget?.targetParentName);
      if (!isValidGeneratedTagName(childName) || !targetParentName) {
        continue;
      }

      // 检查父标签是否可创建
      if (!this.reservePlannedOrganizationParent(targetParentName, snapshot, state)) {
        continue;
      }
      if (state.newChildCount >= MAX_ORGANIZATION_NEW_CHILD_COUNT) {
        continue;
      }
      if (state.plannedChildNames.has(childName)) {
        continue;
      }

      state.plannedChildNames.add(childName);
      state.newChildCount += 1;

      const fingerprint = `${childName}:${targetParentName}:generated`;
      if (!seenTargets.has(fingerprint)) {
        seenTargets.add(fingerprint);
        output.push({
          targetTagName: childName,
          targetParentName,
          source: 'generated',
        });
      }
    }

    return output;
  }

  sanitizeTagOrganizationOperations(rawOperations, snapshot = this.buildTagOrganizationSnapshot()) {
    const normalized = normalizeOrganizationOperations(rawOperations);
    const operations = [];
    const state = {
      newParentCount: 0,
      newChildCount: 0,
      plannedParentNames: new Set(),
      plannedChildNames: new Set(),
      terminalSourceTagIds: new Set(),
    };

    for (const operation of normalized) {
      if (operation.kind === 'create') {
        if (snapshot.tagByName.has(operation.name)) {
          continue;
        }

        if (operation.level === TAG_LEVEL_PARENT) {
          if (!isValidGeneratedTagName(operation.name) || !this.reservePlannedOrganizationParent(operation.name, snapshot, state)) {
            continue;
          }
          operations.push(operation);
          continue;
        }

        const sourceTag = snapshot.tagById.get(Number(operation.sourceTagId));
        if (!sourceTag || sourceTag.level !== TAG_LEVEL_CHILD || sourceTag.isSystem) {
          continue;
        }

        const resolvedTarget = this.reservePlannedOrganizationChild({
          targetTagName: operation.name,
          targetParentName: operation.parentName,
          source: operation.source,
        }, snapshot, state);
        if (!resolvedTarget) {
          continue;
        }

        operations.push({
          ...operation,
          name: resolvedTarget.targetTagName,
          parentName: resolvedTarget.targetParentName,
          source: resolvedTarget.source,
        });
        continue;
      }

      if (operation.kind === 'rename') {
        const current = snapshot.tagById.get(Number(operation.tagId));
        if (!current || current.isSystem) {
          continue;
        }
        if (normalizeTagName(current.name) === operation.nextName) {
          continue;
        }
        const existing = snapshot.tagByName.get(operation.nextName);
        if (!existing && !isValidGeneratedTagName(operation.nextName)) {
          continue;
        }
        operations.push(operation);
        continue;
      }

      if (operation.kind === 'merge') {
        const current = snapshot.tagById.get(Number(operation.sourceTagId));
        if (!current || current.level !== TAG_LEVEL_CHILD || current.isSystem || state.terminalSourceTagIds.has(current.id)) {
          continue;
        }

        const resolvedTarget = this.reservePlannedOrganizationChild({
          targetTagName: operation.targetTagName,
          targetParentName: operation.targetParentName,
          source: operation.source,
        }, snapshot, state);
        if (!resolvedTarget || resolvedTarget.targetTagName === current.name) {
          continue;
        }

        state.terminalSourceTagIds.add(current.id);
        operations.push({
          ...operation,
          targetTagName: resolvedTarget.targetTagName,
          targetParentName: resolvedTarget.targetParentName,
          source: resolvedTarget.source,
        });
        continue;
      }

      if (operation.kind === 'move') {
        const current = snapshot.tagById.get(Number(operation.tagId));
        if (!current || current.level !== TAG_LEVEL_CHILD || current.isSystem) {
          continue;
        }
        if (!operation.targetParentName || state.terminalSourceTagIds.has(current.id)) {
          continue;
        }

        if (!this.reservePlannedOrganizationParent(operation.targetParentName, snapshot, state)) {
          continue;
        }

        state.terminalSourceTagIds.add(current.id);
        operations.push(operation);
        continue;
      }

      if (operation.kind === 'delete') {
        const current = snapshot.tagById.get(Number(operation.tagId));
        if (!current || current.isSystem || current.level === TAG_LEVEL_PARENT) {
          continue;
        }
        if (isUncategorizedChildTag(current) || state.terminalSourceTagIds.has(current.id)) {
          continue;
        }

        const usageCount = Number(current.usageCount || 0);
        // 仅允许删除使用次数为 0 的标签
        if (usageCount > 0) {
          continue;
        }

        const replacementTargets = this.sanitizeDeleteReplacementTargets(
          operation.replacementTargets,
          current,
          snapshot,
          state,
        );

        if (usageCount > getOrganizationDeleteThreshold(snapshot)) {
          continue;
        }

        state.terminalSourceTagIds.add(current.id);
        operations.push({
          ...operation,
          replacementTargets,
        });
      }
    }

    return operations;
  }

  collectAffectedImageIdsForOrganization(operations = [], snapshot = this.buildTagOrganizationSnapshot()) {
    const affectedTagIds = new Set();

    for (const operation of operations) {
      const current = snapshot.tagById.get(getOrganizationSubjectTagId(operation));
      if (current?.level === TAG_LEVEL_CHILD) {
        affectedTagIds.add(current.id);
      }
    }

    if (!affectedTagIds.size) {
      return [];
    }

    const { clause, params } = buildInClauseParams('tag', Array.from(affectedTagIds));
    const rows = this.db.all(
      `SELECT DISTINCT image_id
       FROM image_tags
       WHERE tag_id IN (${clause})`,
      params,
    );

    return rows.map((row) => Number(row.image_id)).filter((value) => Number.isInteger(value) && value > 0);
  }

  decorateTagOrganizationOperations(operations = [], snapshot = this.buildTagOrganizationSnapshot()) {
    return operations.map((operation) => {
      const currentTag = snapshot.tagById.get(getOrganizationSubjectTagId(operation));
      const replacementTargetNames = (Array.isArray(operation.replacementTargets) ? operation.replacementTargets : [])
        .map((target) => target?.targetTagName)
        .filter(Boolean);

      return {
        ...operation,
        currentName: currentTag?.name || '',
        currentParentName: currentTag?.parentName || '',
        currentLevel: currentTag?.level || 0,
        sourceName: operation.kind === 'create' ? currentTag?.name || '' : '',
        sourceParentName: operation.kind === 'create' ? currentTag?.parentName || '' : '',
        affectedUsageCount: Number(currentTag?.usageCount || 0),
        replacementTargetNames,
      };
    });
  }

  async previewTagOrganization() {
    const snapshot = this.buildTagOrganizationSnapshot();
    const rawOperations = await this.aiService.previewTagOrganization();
    const normalizedOperations = normalizeOrganizationOperations(rawOperations);
    const operations = this.prioritizeTagOrganizationOperations(
      this.sanitizeTagOrganizationOperations(normalizedOperations, snapshot),
    );
    const droppedOperations = diffOrganizationOperations(normalizedOperations, operations);
    const affectedImageIds = this.collectAffectedImageIdsForOrganization(operations, snapshot);
    const summary = summarizeOrganizationOperations(operations);

    this.logger.info('tag-organization-preview-sanitized', {
      rawOperationCount: Array.isArray(rawOperations) ? rawOperations.length : 0,
      normalizedOperationCount: normalizedOperations.length,
      sanitizedOperationCount: operations.length,
      droppedOperationCount: droppedOperations.length,
      normalizedOperations,
      droppedOperations,
      sanitizedOperations: operations,
      affectedImageCount: affectedImageIds.length,
    });

    if (!operations.length) {
      this.logger.error('tag-organization-preview-no-effective-operations', {
        rawOperationCount: Array.isArray(rawOperations) ? rawOperations.length : 0,
        normalizedOperationCount: normalizedOperations.length,
        droppedOperationCount: droppedOperations.length,
        droppedOperations,
      });
    }

    return {
      generatedAt: nowIso(),
      summary: {
        totalTags: snapshot.flatTags.length,
        lowUsageTagCount: snapshot.lowUsageTagCount,
        ...summary,
      },
      operations: this.decorateTagOrganizationOperations(operations, snapshot),
      affectedImageCount: affectedImageIds.length,
      ...this.getTagOrganizationStatus(),
    };
  }

  ensureImportCapacity() {
    const total = this.getImageCount();
    if (total < MAX_IMAGE_COUNT) {
      return;
    }

    const error = new Error('IMAGE_LIMIT_REACHED');
    error.code = 'IMAGE_LIMIT_REACHED';
    error.limit = MAX_IMAGE_COUNT;
    error.currentCount = total;
    throw error;
  }

  getEffectiveTagRecords(imageId) {
    return listEffectiveTagRecords(this.db, imageId);
  }

  getEffectiveTags(imageId) {
    return this.getEffectiveTagRecords(imageId).map((tag) => tag.name);
  }

  getAiSuggestedTagRecords(imageId) {
    return listImageTagsBySource(this.db, imageId, 'ai');
  }

  listTagTree() {
    return listTagTree(this.db);
  }

  createTag(payload = {}) {
    const level = Number(payload.level || TAG_LEVEL_CHILD);
    const name = String(payload.name || '').trim();
    if (!name) {
      const error = new Error('EMPTY_TAG_NAME');
      error.code = 'EMPTY_TAG_NAME';
      throw error;
    }

    const createdAt = nowIso();

    if (level === TAG_LEVEL_PARENT) {
      const existing = this.db.get(
        `SELECT id
         FROM tags
         WHERE name = :name
           AND language = 'zh'
         LIMIT 1`,
        { name },
      );

      if (existing) {
        const error = new Error('TAG_ALREADY_EXISTS');
        error.code = 'TAG_ALREADY_EXISTS';
        throw error;
      }

      const sortRow = this.db.get(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
         FROM tags
         WHERE level = :level`,
        { level: TAG_LEVEL_PARENT },
      );

      const insert = this.db.run(
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
          :level,
          :sortOrder,
          0,
          :createdAt,
          :updatedAt
        )`,
        {
          name,
          level: TAG_LEVEL_PARENT,
          sortOrder: Number(sortRow?.next_sort_order || 0),
          createdAt,
          updatedAt: createdAt,
        },
      );

      return getTagById(this.db, Number(insert.lastInsertRowid));
    }

    const existing = this.db.get(
      `SELECT id
       FROM tags
       WHERE name = :name
         AND language = 'zh'
       LIMIT 1`,
      { name },
    );

    if (existing) {
      const error = new Error('TAG_ALREADY_EXISTS');
      error.code = 'TAG_ALREADY_EXISTS';
      throw error;
    }

    return ensureSecondaryTag(this.db, name, {
      parentId: payload.parentId,
      createdAt,
    });
  }

  updateTag(payload = {}) {
    const tagId = Number(payload.tagId || payload.id || 0);
    const currentTag = getTagById(this.db, tagId);
    if (!currentTag) {
      const error = new Error('TAG_NOT_FOUND');
      error.code = 'TAG_NOT_FOUND';
      throw error;
    }

    const nextName = typeof payload.name === 'string'
      ? String(payload.name || '').trim()
      : currentTag.name;

    if (!nextName) {
      const error = new Error('EMPTY_TAG_NAME');
      error.code = 'EMPTY_TAG_NAME';
      throw error;
    }

    if (currentTag.isSystem) {
      const parentChanged = Object.prototype.hasOwnProperty.call(payload, 'parentId')
        && Number(payload.parentId || 0) !== Number(currentTag.parentId || 0);
      if (nextName !== currentTag.name || parentChanged) {
        const error = new Error('SYSTEM_TAG_LOCKED');
        error.code = 'SYSTEM_TAG_LOCKED';
        throw error;
      }
      return currentTag;
    }

    const conflict = this.db.get(
      `SELECT id
       FROM tags
       WHERE name = :name
         AND language = 'zh'
         AND id != :tagId
       LIMIT 1`,
      {
        name: nextName,
        tagId,
      },
    );

    if (conflict) {
      const error = new Error('TAG_ALREADY_EXISTS');
      error.code = 'TAG_ALREADY_EXISTS';
      throw error;
    }

    const updatedAt = nowIso();

    if (currentTag.level === TAG_LEVEL_PARENT) {
      this.db.run(
        `UPDATE tags
         SET name = :name,
             updated_at = :updatedAt
         WHERE id = :tagId`,
        {
          tagId,
          name: nextName,
          updatedAt,
        },
      );
      return getTagById(this.db, tagId);
    }

    let parentId = currentTag.parentId;
    if (Object.prototype.hasOwnProperty.call(payload, 'parentId')) {
      const nextParent = getTagById(this.db, Number(payload.parentId || 0));
      if (!nextParent || nextParent.level !== TAG_LEVEL_PARENT) {
        const error = new Error('PARENT_TAG_NOT_FOUND');
        error.code = 'PARENT_TAG_NOT_FOUND';
        throw error;
      }
      parentId = nextParent.id;
    }

    let nextSortOrder = currentTag.sortOrder;
    if (parentId !== currentTag.parentId) {
      const sortRow = this.db.get(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
         FROM tags
         WHERE parent_id = :parentId
           AND level = :level`,
        {
          parentId,
          level: TAG_LEVEL_CHILD,
        },
      );
      nextSortOrder = Number(sortRow?.next_sort_order || 0);
    }

    this.db.run(
      `UPDATE tags
       SET name = :name,
           parent_id = :parentId,
           sort_order = :sortOrder,
           updated_at = :updatedAt
       WHERE id = :tagId`,
      {
        tagId,
        name: nextName,
        parentId,
        sortOrder: nextSortOrder,
        updatedAt,
      },
    );

    return getTagById(this.db, tagId);
  }

  deleteTag(tagId) {
    const tag = getTagById(this.db, tagId);
    if (!tag) {
      const error = new Error('TAG_NOT_FOUND');
      error.code = 'TAG_NOT_FOUND';
      throw error;
    }

    if (tag.isSystem) {
      const error = new Error('SYSTEM_TAG_LOCKED');
      error.code = 'SYSTEM_TAG_LOCKED';
      throw error;
    }

    const now = nowIso();

    if (tag.level === TAG_LEVEL_PARENT) {
      const childRows = this.db.all(
        `SELECT id
         FROM tags
         WHERE parent_id = :tagId`,
        { tagId },
      );
      const childTagIds = childRows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0);
      const affectedImageIds = this.collectImageIdsByTagIds(childTagIds);

      this.db.transaction(() => {
        if (childTagIds.length) {
          const { clause, params } = buildInClauseParams('tag', childTagIds);
          this.db.run(
            `DELETE FROM image_tags
             WHERE tag_id IN (${clause})`,
            params,
          );
          this.db.run(
            `DELETE FROM tags
             WHERE id IN (${clause})`,
            params,
          );
        }

        this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId });
        this.markImagesForEmbeddingRefresh(affectedImageIds, now);
      });

      return {
        deleted: true,
        tagId,
        affectedImageCount: affectedImageIds.length,
      };
    }

    const affectedImageIds = this.collectImageIdsByTagIds([tag.id]);

    this.db.transaction(() => {
      this.db.run('DELETE FROM image_tags WHERE tag_id = :tagId', { tagId });
      this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId });
      this.markImagesForEmbeddingRefresh(affectedImageIds, now);
    });

    return {
      deleted: true,
      tagId,
      affectedImageCount: affectedImageIds.length,
    };
  }

  cleanupEmptyParentTags(updatedAt = nowIso()) {
    const rows = this.db.all(
      `SELECT t.id
       FROM tags t
       LEFT JOIN tags c ON c.parent_id = t.id
       WHERE t.level = :level
         AND t.is_system = 0
       GROUP BY t.id
       HAVING COUNT(c.id) = 0`,
      { level: TAG_LEVEL_PARENT },
    );

    for (const row of rows) {
      this.db.run(
        `DELETE FROM tags
         WHERE id = :tagId`,
        {
          tagId: Number(row.id),
        },
      );
    }
  }

  collectImageIdsByTagIds(tagIds = []) {
    const normalizedTagIds = normalizeTagIds(tagIds);
    if (!normalizedTagIds.length) {
      return [];
    }

    const { clause, params } = buildInClauseParams('tag', normalizedTagIds);
    const rows = this.db.all(
      `SELECT DISTINCT image_id
       FROM image_tags
       WHERE tag_id IN (${clause})`,
      params,
    );

    return rows
      .map((row) => Number(row.image_id))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  markImagesForEmbeddingRefresh(imageIds = [], updatedAt = nowIso()) {
    const normalizedImageIds = normalizeImageIds(imageIds);
    if (!normalizedImageIds.length) {
      return;
    }

    const { clause, params } = buildInClauseParams('image', normalizedImageIds);
    this.db.run(
      `UPDATE images
       SET needs_embedding_refresh = 1,
           updated_at = :updatedAt
       WHERE id IN (${clause})`,
      {
        ...params,
        updatedAt,
      },
    );

    for (const imageId of normalizedImageIds) {
      this.createAnalysisJob(imageId, {
        jobType: 'refresh_embedding',
        maxRetryCount: 2,
        asTransaction: true,
      });
    }
  }

  listTagImageRelations(tagId) {
    return this.db.all(
      `SELECT image_id, source
       FROM image_tags
       WHERE tag_id = :tagId`,
      { tagId: Number(tagId) || 0 },
    );
  }

  attachTagToRelations(targetTagId, relations = [], createdAt = nowIso()) {
    for (const relation of relations) {
      this.db.run(
        `INSERT INTO image_tags (image_id, tag_id, source, created_at)
         VALUES (:imageId, :tagId, :source, :createdAt)
         ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
        {
          imageId: Number(relation.image_id),
          tagId: Number(targetTagId),
          source: String(relation.source || 'ai'),
          createdAt,
        },
      );
    }
  }

  prioritizeTagOrganizationOperations(operations = []) {
    const priorityByKind = new Map([
      ['create', 1],
      ['rename', 2],
      ['move', 3],
      ['merge', 4],
      ['delete', 5],
    ]);

    return [...operations].sort((left, right) => {
      const leftPriority = priorityByKind.get(left?.kind) || 99;
      const rightPriority = priorityByKind.get(right?.kind) || 99;
      return leftPriority - rightPriority;
    });
  }

  resolveOrganizationTargetChildTag(operation, createdAt) {
    const existing = getTagByName(this.db, operation.targetTagName);
    if (existing) {
      return existing.level === TAG_LEVEL_CHILD ? existing : null;
    }

    const source = normalizeOrganizationSource(operation.source);
    if (source === 'preset') {
      const presetMatch = findPresetTaxonomyMatch(operation.targetParentName, operation.targetTagName);
      if (!presetMatch) {
        return null;
      }
      const parentTag = ensureParentTag(this.db, presetMatch.parentName, { createdAt });
      return ensureSecondaryTag(this.db, presetMatch.childName, {
        parentId: parentTag?.id,
        createdAt,
      });
    }

    if (!isValidGeneratedTagName(operation.targetTagName)) {
      return null;
    }

    const parentName = normalizeTagName(operation.targetParentName);
    if (!parentName || !isValidGeneratedTagName(parentName)) {
      return null;
    }

    const parentTag = ensureParentTag(this.db, parentName, { createdAt });
    return ensureSecondaryTag(this.db, operation.targetTagName, {
      parentId: parentTag?.id,
      createdAt,
    });
  }

  applySingleTagOrganizationOperation(operation, createdAt) {
    if (operation.kind === 'create') {
      if (operation.level === TAG_LEVEL_PARENT) {
        const existing = getTagByName(this.db, operation.name);
        if (existing) {
          return existing.level === TAG_LEVEL_PARENT
            ? { applied: false, skipped: 'TAG_ALREADY_EXISTS' }
            : { applied: false, skipped: 'TAG_NAME_CONFLICT' };
        }

        const created = ensureParentTag(this.db, operation.name, { createdAt });
        return { applied: Boolean(created), tag: created };
      }

      const existing = getTagByName(this.db, operation.name);
      if (existing) {
        return existing.level === TAG_LEVEL_CHILD
          ? { applied: false, skipped: 'TAG_ALREADY_EXISTS' }
          : { applied: false, skipped: 'TAG_NAME_CONFLICT' };
      }

      const sourceTag = getTagById(this.db, operation.sourceTagId);
      if (!sourceTag || sourceTag.level !== TAG_LEVEL_CHILD || sourceTag.isSystem) {
        return { applied: false, skipped: 'SOURCE_TAG_NOT_FOUND' };
      }

      const parentTag = ensureParentTag(this.db, operation.parentName, { createdAt });
      const created = ensureSecondaryTag(this.db, operation.name, {
        parentId: parentTag?.id,
        createdAt,
      });
      if (!created) {
        return { applied: false, skipped: 'TAG_CREATE_FAILED' };
      }

      const relations = this.listTagImageRelations(sourceTag.id);
      this.attachTagToRelations(created.id, relations, createdAt);
      return { applied: true, tag: created };
    }

    if (operation.kind === 'rename') {
      const current = getTagById(this.db, operation.tagId);
      if (!current || current.isSystem) {
        return { applied: false, skipped: 'TAG_NOT_FOUND' };
      }

      const existing = getTagByName(this.db, operation.nextName);
      if (existing && existing.id !== current.id) {
        if (current.level === TAG_LEVEL_CHILD && existing.level === TAG_LEVEL_CHILD) {
          return this.applySingleTagOrganizationOperation({
            kind: 'merge',
            sourceTagId: current.id,
            targetTagName: existing.name,
            targetParentName: existing.parentName,
            source: 'existing',
          }, createdAt);
        }

        if (current.level === TAG_LEVEL_PARENT && existing.level === TAG_LEVEL_PARENT) {
          this.db.run(
            `UPDATE tags
             SET parent_id = :targetParentId,
                 updated_at = :updatedAt
             WHERE parent_id = :sourceParentId`,
            {
              targetParentId: existing.id,
              sourceParentId: current.id,
              updatedAt: createdAt,
            },
          );
          this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId: current.id });
          return { applied: true, mergedIntoTagId: existing.id };
        }

        return { applied: false, skipped: 'TAG_NAME_CONFLICT' };
      }

      this.db.run(
        `UPDATE tags
         SET name = :name,
             updated_at = :updatedAt
         WHERE id = :tagId`,
        {
          tagId: current.id,
          name: operation.nextName,
          updatedAt: createdAt,
        },
      );
      return { applied: true, tag: getTagById(this.db, current.id) };
    }

    if (operation.kind === 'move') {
      const current = getTagById(this.db, operation.tagId);
      if (!current || current.level !== TAG_LEVEL_CHILD || current.isSystem) {
        return { applied: false, skipped: 'TAG_NOT_FOUND' };
      }

      let parentTag = getTagByName(this.db, operation.targetParentName);
      if (!parentTag) {
        if (!isValidGeneratedTagName(operation.targetParentName)) {
          return { applied: false, skipped: 'PARENT_TAG_NOT_FOUND' };
        }
        parentTag = ensureParentTag(this.db, operation.targetParentName, { createdAt });
      }

      if (!parentTag || parentTag.level !== TAG_LEVEL_PARENT) {
        return { applied: false, skipped: 'PARENT_TAG_NOT_FOUND' };
      }

      this.db.run(
        `UPDATE tags
         SET parent_id = :parentId,
             updated_at = :updatedAt
         WHERE id = :tagId`,
        {
          tagId: current.id,
          parentId: parentTag.id,
          updatedAt: createdAt,
        },
      );
      return { applied: true, tag: getTagById(this.db, current.id) };
    }

    if (operation.kind === 'merge') {
      const current = getTagById(this.db, operation.sourceTagId);
      if (!current || current.level !== TAG_LEVEL_CHILD || current.isSystem) {
        return { applied: false, skipped: 'TAG_NOT_FOUND' };
      }

      const targetTag = this.resolveOrganizationTargetChildTag(operation, createdAt);
      if (!targetTag || targetTag.level !== TAG_LEVEL_CHILD) {
        return { applied: false, skipped: 'TARGET_TAG_NOT_FOUND' };
      }

      if (targetTag.id === current.id) {
        return { applied: false, skipped: 'MERGE_TARGET_SAME' };
      }

      const relations = this.listTagImageRelations(current.id);
      this.attachTagToRelations(targetTag.id, relations, createdAt);

      this.db.run('DELETE FROM image_tags WHERE tag_id = :tagId', { tagId: current.id });
      this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId: current.id });
      return { applied: true, mergedIntoTagId: targetTag.id };
    }

    if (operation.kind === 'delete') {
      const current = getTagById(this.db, operation.tagId);
      if (!current || current.isSystem) {
        return { applied: false, skipped: 'TAG_NOT_FOUND' };
      }

      if (current.level === TAG_LEVEL_PARENT) {
        const child = this.db.get(
          `SELECT id
           FROM tags
           WHERE parent_id = :tagId
           LIMIT 1`,
          { tagId: current.id },
        );
        if (child) {
          return { applied: false, skipped: 'TAG_HAS_CHILDREN' };
        }
        this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId: current.id });
        return { applied: true };
      }

      const relations = this.listTagImageRelations(current.id);
      const targetTagIds = [];
      for (const target of Array.isArray(operation.replacementTargets) ? operation.replacementTargets : []) {
        const targetTag = this.resolveOrganizationTargetChildTag(target, createdAt);
        if (!targetTag || targetTag.level !== TAG_LEVEL_CHILD || targetTag.id === current.id) {
          continue;
        }
        targetTagIds.push(targetTag.id);
      }

      for (const targetTagId of targetTagIds) {
        this.attachTagToRelations(targetTagId, relations, createdAt);
      }

      this.db.run('DELETE FROM image_tags WHERE tag_id = :tagId', { tagId: current.id });
      this.db.run('DELETE FROM tags WHERE id = :tagId', { tagId: current.id });
      return { applied: true };
    }

    return { applied: false, skipped: 'UNSUPPORTED_OPERATION' };
  }

  applyTagOrganizationPlan(payload = {}) {
    const inputOperations = Array.isArray(payload) ? payload : payload.operations;
    const snapshot = this.buildTagOrganizationSnapshot();
    const normalizedOperations = normalizeOrganizationOperations(inputOperations);
    const operations = this.prioritizeTagOrganizationOperations(
      this.sanitizeTagOrganizationOperations(normalizedOperations, snapshot),
    );
    const droppedOperations = diffOrganizationOperations(normalizedOperations, operations);
    const affectedImageIds = this.collectAffectedImageIdsForOrganization(operations, snapshot);
    const appliedOperations = [];
    const skippedOperations = [];
    const now = nowIso();

    this.logger.info('tag-organization-apply-started', {
      inputOperationCount: Array.isArray(inputOperations) ? inputOperations.length : 0,
      normalizedOperationCount: normalizedOperations.length,
      sanitizedOperationCount: operations.length,
      droppedOperationCount: droppedOperations.length,
      normalizedOperations,
      droppedOperations,
      sanitizedOperations: operations,
      affectedImageCount: affectedImageIds.length,
    });

    this.db.transaction(() => {
      for (const operation of operations) {
        try {
          const result = this.applySingleTagOrganizationOperation(operation, now);
          if (result?.applied) {
            appliedOperations.push(operation);
          } else {
            skippedOperations.push({
              ...operation,
              reason: result?.skipped || 'SKIPPED',
            });
          }
        } catch (error) {
          skippedOperations.push({
            ...operation,
            reason: error?.code || error?.message || 'SKIPPED',
          });
        }
      }

      this.cleanupEmptyParentTags(now);

      if (affectedImageIds.length) {
        this.markImagesForEmbeddingRefresh(affectedImageIds, now);
      }

      if (appliedOperations.length) {
        setAppSetting(this.db, 'last_tag_organization_at', now, now);
      }
    });

    this.logger.info('tag-organization-apply-finished', {
      appliedCount: appliedOperations.length,
      skippedCount: skippedOperations.length,
      appliedOperations,
      skippedOperations,
      affectedImageCount: affectedImageIds.length,
    });

    return {
      appliedCount: appliedOperations.length,
      skippedCount: skippedOperations.length,
      appliedOperations,
      skippedOperations,
      affectedImageCount: affectedImageIds.length,
      tagTree: this.listTagTree(),
      ...this.getTagOrganizationStatus(),
    };
  }

  async importFolder(folderPath, options = {}) {
    const reportProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const emitProgress = (payload) => {
      if (!reportProgress) {
        return;
      }

      try {
        reportProgress(payload);
      } catch (error) {
        this.logger.error('import-progress-callback-failed', {
          error: String(error?.message || error),
        });
      }
    };

    const resolvedFolder = resolveExistingFolderPath(folderPath);
    const files = walkFilesRecursive(resolvedFolder);

    const summary = {
      totalScanned: files.length,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      imported: [],
      duplicates: [],
      skipped: [],
    };

    emitProgress({
      mode: 'folder',
      phase: 'importing',
      current: 0,
      total: files.length,
      importedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
    });

    for (let index = 0; index < files.length; index += 1) {
      const filePath = files[index];
      const result = await this.importFile(filePath, { sourceFolder: resolvedFolder, asStandalone: false });
      if (result.status === 'imported') {
        summary.importedCount += 1;
        summary.imported.push(result.image);
      } else if (result.status === 'duplicate') {
        summary.duplicateCount += 1;
        summary.duplicates.push(result);
      } else {
        summary.skippedCount += 1;
        summary.skipped.push(result);
      }

      emitProgress({
        mode: 'folder',
        phase: 'importing',
        current: index + 1,
        total: files.length,
        importedCount: summary.importedCount,
        duplicateCount: summary.duplicateCount,
        skippedCount: summary.skippedCount,
        lastStatus: result.status,
        filePath,
      });
    }

    const importedImageIds = summary.imported.map((item) => item.id).filter(Boolean);
    if (importedImageIds.length > 0) {
      await this.waitForImportedImagesSettled(importedImageIds, (analysisProgress) => {
        emitProgress({
          mode: 'folder',
          phase: 'analyzing',
          ...analysisProgress,
          importedCount: summary.importedCount,
          duplicateCount: summary.duplicateCount,
          skippedCount: summary.skippedCount,
        });
      });
    }

    emitProgress({
      mode: 'folder',
      phase: 'completed',
      current: summary.importedCount,
      total: summary.importedCount,
      importedCount: summary.importedCount,
      duplicateCount: summary.duplicateCount,
      skippedCount: summary.skippedCount,
    });

    return summary;
  }

  async waitForImportedImagesSettled(imageIds, onProgress) {
    const normalizedImageIds = normalizeImageIds(imageIds);
    if (!normalizedImageIds.length) {
      if (typeof onProgress === 'function') {
        onProgress({
          current: 0,
          total: 0,
          readyCount: 0,
          failedCount: 0,
          queuedCount: 0,
          analyzingCount: 0,
          importedCount: 0,
        });
      }
      return;
    }

    const { clause, params } = buildInClauseParams('image', normalizedImageIds);
    const query = `
      SELECT analysis_status
      FROM images
      WHERE id IN (${clause})
    `;

    while (true) {
      await this.queue.drain();

      const rows = this.db.all(query, params);
      let readyCount = 0;
      let failedCount = 0;
      let queuedCount = 0;
      let analyzingCount = 0;
      let importedCount = 0;

      for (const row of rows) {
        const status = String(row.analysis_status || '');
        if (status === IMAGE_STATUS.READY) {
          readyCount += 1;
        } else if (status === IMAGE_STATUS.FAILED) {
          failedCount += 1;
        } else if (status === IMAGE_STATUS.ANALYZING) {
          analyzingCount += 1;
        } else if (status === IMAGE_STATUS.QUEUED) {
          queuedCount += 1;
        } else if (status === IMAGE_STATUS.IMPORTED) {
          importedCount += 1;
        }
      }

      const settledCount = readyCount + failedCount;
      if (typeof onProgress === 'function') {
        onProgress({
          current: settledCount,
          total: normalizedImageIds.length,
          readyCount,
          failedCount,
          queuedCount,
          analyzingCount,
          importedCount,
        });
      }

      if (settledCount >= normalizedImageIds.length) {
        return;
      }

      await sleep(160);
    }
  }

  async importFile(filePath, options = {}) {
    this.logger.info('importFile-start', { filePath });
    let resolved;

    try {
      resolved = resolveExistingFilePath(filePath);
      this.logger.info('importFile-path-resolved', { filePath: resolved.filePath });
    } catch (error) {
      this.logger.error('importFile-path-resolve-failed', { filePath, error: error.message });
      return {
        status: 'skipped',
        reason: error.code || 'FILE_ACCESS_FAILED',
        filePath,
      };
    }

    const ext = path.extname(resolved.filePath).toLowerCase();
    this.logger.info('importFile-checking-format', { filePath: resolved.filePath, ext });

    const isSupported = isSupportedImageFile(resolved.filePath, this.logger);
    if (!isSupported) {
      this.logger.warn('importFile-unsupported-format', { filePath: resolved.filePath, ext });
      return {
        status: 'skipped',
        reason: 'UNSUPPORTED_FORMAT',
        filePath: resolved.filePath,
      };
    }

    this.logger.info('importFile-format-supported', { filePath: resolved.filePath, ext });

    this.logger.info('importFile-checking-size', { filePath: resolved.filePath, size: resolved.stat.size, maxSize: MAX_FILE_SIZE_BYTES });
    if (resolved.stat.size > MAX_FILE_SIZE_BYTES) {
      this.logger.warn('importFile-file-too-large', { filePath: resolved.filePath, size: resolved.stat.size });
      return {
        status: 'skipped',
        reason: 'FILE_TOO_LARGE',
        filePath: resolved.filePath,
      };
    }

    let md5Hash;
    try {
      this.logger.info('importFile-computing-md5', { filePath: resolved.filePath });
      md5Hash = md5File(resolved.filePath);
      this.logger.info('importFile-md5-computed', { filePath: resolved.filePath, md5Hash });
    } catch (error) {
      this.logger.error('importFile-md5-failed', { filePath: resolved.filePath, error: String(error) });
      return {
        status: 'skipped',
        reason: 'HASH_COMPUTE_FAILED',
        filePath: resolved.filePath,
      };
    }

    this.logger.info('importFile-checking-duplicate', { md5Hash });
    let existed;
    try {
      existed = this.db.get('SELECT id, library_path FROM images WHERE md5_hash = :md5Hash', { md5Hash });
      this.logger.info('importFile-duplicate-checked', { md5Hash, isDuplicate: !!existed });
    } catch (dbError) {
      this.logger.error('importFile-db-error', { md5Hash, error: String(dbError) });
      throw dbError;
    }
    if (existed) {
      return {
        status: 'duplicate',
        reason: 'STRICT_DUPLICATE',
        filePath: resolved.filePath,
        imageId: existed.id,
      };
    }

    this.logger.info('importFile-checking-capacity');
    this.ensureImportCapacity();
    this.logger.info('importFile-capacity-ok');

    const fileName = path.basename(resolved.filePath);
    this.logger.info('importFile-building-paths', { fileName });
    const libraryPath = buildLibraryPath(this.paths.libraryRootPath, md5Hash, fileName);
    const thumbnailPath = buildThumbnailPath(this.paths.thumbnailRootPath, md5Hash, ext);
    const now = nowIso();
    let importedXmpMetadata = null;

    try {
      this.logger.info('importFile-reading-xmp', { filePath: resolved.filePath });
      const xmpMetadata = await Promise.race([
        new Promise((resolve) => {
          const result = readXmpMetadataForImage(resolved.filePath);
          resolve(result);
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('XMP_READ_TIMEOUT')), 5000);
        }),
      ]);
      this.logger.info('importFile-xmp-read', { filePath: resolved.filePath, hasCaption: xmpMetadata.hasCaption, hasTags: xmpMetadata.hasTags });
      if (xmpMetadata.hasCaption && xmpMetadata.hasTags) {
        importedXmpMetadata = {
          caption: xmpMetadata.caption,
          tags: xmpMetadata.tags,
          source: xmpMetadata.source,
        };
      }
    } catch (error) {
      this.logger.error('xmp-read-failed', {
        filePath: resolved.filePath,
        error: String(error?.message || error),
      });
    }

    let imageId;

    try {
      this.logger.info('importFile-copying-file', { from: resolved.filePath, to: libraryPath });
      copyFile(resolved.filePath, libraryPath);
      this.logger.info('importFile-file-copied', { libraryPath });

      this.logger.info('importFile-creating-thumbnail', { libraryPath, thumbnailPath });
      await createThumbnailPlaceholder(libraryPath, thumbnailPath);
      this.logger.info('importFile-thumbnail-created', { thumbnailPath });

      this.logger.info('importFile-inserting-db', { fileName, md5Hash });
      this.db.transaction(() => {
        const result = this.db.run(
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
            :originalFileName,
            :sourcePath,
            :libraryPath,
            :thumbnailPath,
            :md5Hash,
            :fileSize,
            NULL,
            NULL,
            'imported',
            :analysisStatus,
            :activeTagSource,
            :createdAt,
            :updatedAt
          )`,
          {
            originalFileName: fileName,
            sourcePath: resolved.filePath,
            libraryPath,
            thumbnailPath,
            md5Hash,
            fileSize: resolved.stat.size,
            analysisStatus: importedXmpMetadata ? IMAGE_STATUS.IMPORTED : IMAGE_STATUS.QUEUED,
            activeTagSource: importedXmpMetadata ? 'user' : 'ai',
            createdAt: now,
            updatedAt: now,
          },
        );

        imageId = Number(result.lastInsertRowid);

        if (importedXmpMetadata) {
          const captionInsert = this.db.run(
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
              'user',
              1,
              NULL,
              NULL,
              :createdAt,
              :updatedAt
            )`,
            {
              imageId,
              content: importedXmpMetadata.caption,
              createdAt: now,
              updatedAt: now,
            },
          );

          this.upsertImageTagsBySource(imageId, importedXmpMetadata.tags, 'user', now);

          this.db.run(
            `UPDATE images
             SET active_caption_id = :captionId,
                 updated_at = :updatedAt
             WHERE id = :imageId`,
            {
              imageId,
              captionId: Number(captionInsert.lastInsertRowid),
              updatedAt: now,
            },
          );
        } else {
          this.logger.info('importFile-creating-analysis-job', { imageId });
          this.createAnalysisJob(imageId, { jobType: 'analyze_image', maxRetryCount: 2, asTransaction: true });
          this.logger.info('importFile-analysis-job-created', { imageId });
        }
      });
      this.logger.info('importFile-db-insert-complete', { imageId });
    } catch (error) {
      removeFileIfExists(libraryPath);
      removeFileIfExists(thumbnailPath);
      this.logger.error('import-file-failed', {
        filePath: resolved.filePath,
        error: String(error?.message || error),
      });

      return {
        status: 'skipped',
        reason: 'IMPORT_WRITE_FAILED',
        filePath: resolved.filePath,
      };
    }

    let embeddingStatus = null;
    if (importedXmpMetadata) {
      try {
        this.syncImageMetadataToXmp(imageId);
      } catch (error) {
        this.logger.error('xmp-write-library-failed', {
          imageId,
          libraryPath,
          error: String(error?.message || error),
        });
      }

      const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
      embeddingStatus = embeddingResult.embeddingStatus;

      const nextStatus = embeddingResult.analysisStatus
        || (embeddingResult.embeddingStatus === 'refreshed'
          ? IMAGE_STATUS.READY
          : embeddingResult.embeddingStatus === 'failed'
            ? IMAGE_STATUS.FAILED
            : IMAGE_STATUS.QUEUED);

      this.db.run(
        `UPDATE images
         SET analysis_status = :analysisStatus,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          imageId,
          analysisStatus: nextStatus,
          updatedAt: nowIso(),
        },
      );
    } else {
      await this.queue.drain();
    }

    this.logger.info('importFile-success', {
      imageId,
      filePath: resolved.filePath,
      analysisStatus: importedXmpMetadata ? IMAGE_STATUS.IMPORTED : IMAGE_STATUS.QUEUED,
    });

    return {
      status: 'imported',
      image: {
        id: imageId,
        sourcePath: resolved.filePath,
        libraryPath,
        thumbnailPath,
        fileSize: resolved.stat.size,
      },
      metadataSource: importedXmpMetadata ? importedXmpMetadata.source : null,
      embeddingStatus,
      mode: options.asStandalone === false ? 'folder' : 'single',
    };
  }

  createAnalysisJob(imageId, { jobType = 'analyze_image', maxRetryCount = 2, asTransaction = false } = {}) {
    const action = () => {
      const existing = this.db.get(
        `SELECT id
         FROM analysis_jobs
         WHERE image_id = :imageId
           AND job_type = :jobType
           AND status IN (:pending, :processing, :retrying)
         LIMIT 1`,
        {
          imageId,
          jobType,
          pending: JOB_STATUS.PENDING,
          processing: JOB_STATUS.PROCESSING,
          retrying: JOB_STATUS.RETRYING,
        },
      );

      if (existing) {
        return existing.id;
      }

      const now = nowIso();
      const result = this.db.run(
        `INSERT INTO analysis_jobs (
          image_id,
          job_type,
          status,
          retry_count,
          max_retry_count,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          :jobType,
          :status,
          0,
          :maxRetryCount,
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          jobType,
          status: JOB_STATUS.PENDING,
          maxRetryCount,
          createdAt: now,
          updatedAt: now,
        },
      );

      if (jobType === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :queued,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            queued: IMAGE_STATUS.QUEUED,
            updatedAt: now,
            imageId,
          },
        );
      }

      return Number(result.lastInsertRowid);
    };

    if (asTransaction) {
      return action();
    }

    return this.db.transaction(action);
  }

  async enqueueAnalysis(imageId) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const jobId = this.createAnalysisJob(imageId, { jobType: 'analyze_image' });
    await this.queue.drain();
    return { jobId, imageId };
  }

  async retryAnalysis(jobId) {
    const job = this.db.get('SELECT * FROM analysis_jobs WHERE id = :jobId', { jobId });
    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    const now = nowIso();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :pending,
             retry_count = 0,
             last_error_code = NULL,
             last_error_message = NULL,
             started_at = NULL,
             finished_at = NULL,
             updated_at = :updatedAt
         WHERE id = :jobId`,
        {
          pending: JOB_STATUS.PENDING,
          updatedAt: now,
          jobId,
        },
      );

      if (job.job_type === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :queued,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            queued: IMAGE_STATUS.QUEUED,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }
    });

    const timer = this.queue.retryTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.queue.retryTimers.delete(jobId);
    }

    await this.queue.drain();
    return { jobId, status: JOB_STATUS.PENDING };
  }

  async collectSearchItems(query = '', selectedTagIds = [], filterMode = DEFAULT_TAG_FILTER_MODE) {
    const cleanQuery = String(query || '').trim();
    const normalizedTagIds = normalizeSelectedTagIds(this.db, selectedTagIds);
    const effectiveFilterMode = normalizeTagFilterMode(filterMode);
    const candidates = this.getReadyImagesByTagIds(normalizedTagIds, effectiveFilterMode);

    if (cleanQuery.length === 0) {
      const sorted = [...candidates].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return this.attachActiveDataForImages(sorted);
    }

    const searchProfile = buildSearchProfile(cleanQuery);

    // 尝试获取语义向量，离线时降级为纯文本匹配
    let queryVector = null;
    let useSemanticSearch = false;
    try {
      queryVector = await this.aiService.embedText(searchProfile.semanticText || cleanQuery);
      useSemanticSearch = true;
    } catch (error) {
      // 网络错误时降级为纯文本匹配（离线模式）
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        this.logger?.info('search-embedding-failed-offline-mode', { query: cleanQuery, error: error.message });
      } else {
        throw error; // 非网络错误继续抛出
      }
    }

    const scored = [];

    for (const image of candidates) {
      const activeCaption = this.db.get(
        `SELECT id, content
         FROM captions
         WHERE id = :captionId`,
        { captionId: image.active_caption_id },
      );
      const effectiveTags = this.getEffectiveTags(image.id);

      // 纯文本匹配始终可用
      const lexicalScore = scoreSearchTextMatch(searchProfile, image, activeCaption, effectiveTags);
      const intentScore = scoreSearchIntent(searchProfile, activeCaption, effectiveTags);

      // 语义搜索（仅在在线模式下）
      let semanticScore = 0;
      let distance = 1;
      if (useSemanticSearch && queryVector) {
        const embedding = this.db.get('SELECT vector FROM embeddings WHERE image_id = :imageId', { imageId: image.id });
        if (embedding) {
          const vector = toJsonVector(embedding.vector);
          distance = cosineDistance(queryVector, vector);
          semanticScore = Math.max(0, 1 - distance);
        }
      }

      // 调整权重：在线时使用语义+文本，离线时仅用文本
      const rankScore = useSemanticSearch
        ? semanticScore * 70 + lexicalScore * 4 + intentScore
        : lexicalScore * 10 + intentScore;

      scored.push({
        image,
        distance,
        score: semanticScore,
        lexicalScore,
        intentScore,
        rankScore,
      });
    }

    scored.sort((a, b) => {
      if (Math.abs(b.rankScore - a.rankScore) >= 1e-9) {
        return b.rankScore - a.rankScore;
      }

      if (Math.abs(a.distance - b.distance) < 1e-9) {
        return b.image.updated_at.localeCompare(a.image.updated_at);
      }
      return a.distance - b.distance;
    });

    return this.attachActiveDataForImages(scored.map((item) => ({
      ...item.image,
      distance: Number(item.distance.toFixed(6)),
      score: Number(item.score.toFixed(6)),
      lexicalScore: Number(item.lexicalScore.toFixed(6)),
    })));
  }

  async searchImages(query = '', selectedTagIds = [], filterModeOrPagination = {}, maybePagination = null) {
    const filterMode = typeof filterModeOrPagination === 'string'
      ? normalizeTagFilterMode(filterModeOrPagination)
      : DEFAULT_TAG_FILTER_MODE;
    const pagination = typeof filterModeOrPagination === 'string'
      ? (maybePagination || {})
      : (filterModeOrPagination || {});
    const page = Number(pagination.page || 1);
    const pageSize = Math.min(Number(pagination.pageSize || SEARCH_PAGE_SIZE), SEARCH_PAGE_SIZE);
    const offset = (Math.max(page, 1) - 1) * pageSize;
    const items = await this.collectSearchItems(query, selectedTagIds, filterMode);
    const paged = items.slice(offset, offset + pageSize);

    return {
      total: items.length,
      page,
      pageSize,
      items: paged,
    };
  }

  getReadyImagesByTagIds(selectedTagIds, filterMode = DEFAULT_TAG_FILTER_MODE) {
    const normalizedTagIds = normalizeTagIds(selectedTagIds);
    if (!normalizedTagIds.length) {
      return this.db.all(
        `SELECT *
         FROM images
         WHERE analysis_status = :ready`,
        { ready: IMAGE_STATUS.READY },
      );
    }

    const { clause, params } = buildInClauseParams('tag', normalizedTagIds);
    const effectiveFilterMode = normalizeTagFilterMode(filterMode);
    const query = `
      SELECT DISTINCT i.*
      FROM images i
      JOIN image_tags it ON it.image_id = i.id
      JOIN tags t ON t.id = it.tag_id
      WHERE i.analysis_status = :ready
        AND ((i.active_tag_source = 'user' AND it.source = 'user')
             OR (i.active_tag_source = 'ai' AND it.source = 'ai'))
        AND t.level = :level
        AND t.id IN (${clause})
      GROUP BY i.id
      ${effectiveFilterMode === 'and' ? 'HAVING COUNT(DISTINCT t.id) = :tagCount' : ''}
    `;

    const queryParams = {
      ready: IMAGE_STATUS.READY,
      level: TAG_LEVEL_CHILD,
      ...params,
    };

    if (effectiveFilterMode === 'and') {
      queryParams.tagCount = normalizedTagIds.length;
    }

    return this.db.all(query, queryParams);
  }

  attachActiveDataForImages(images) {
    return images.map((image) => {
      const activeCaption = this.db.get(
        `SELECT id, content, source, created_at, updated_at
         FROM captions
         WHERE id = :captionId`,
        { captionId: image.active_caption_id },
      );

      const tagRecords = this.getEffectiveTagRecords(image.id);

      return {
        ...image,
        activeCaption,
        tags: tagRecords.map((tag) => tag.name),
        tagDetails: tagRecords,
      };
    });
  }

  getImageDetail(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const activeCaption = this.db.get('SELECT * FROM captions WHERE id = :captionId', {
      captionId: image.active_caption_id,
    });

    const captionHistory = this.db.all(
      `SELECT *
       FROM captions
       WHERE image_id = :imageId
      ORDER BY created_at DESC`,
      { imageId },
    );

    const effectiveTags = this.getEffectiveTagRecords(imageId);
    const aiSuggestedTags = this.getAiSuggestedTagRecords(imageId);

    const latestJob = this.db.get(
      `SELECT *
       FROM analysis_jobs
       WHERE image_id = :imageId
       ORDER BY created_at DESC
       LIMIT 1`,
      { imageId },
    );

    return {
      image,
      activeCaption,
      effectiveTags,
      effectiveTagNames: effectiveTags.map((tag) => tag.name),
      aiSuggestedTags,
      aiSuggestedTagNames: aiSuggestedTags.map((tag) => tag.name),
      captionHistory,
      latestJob,
    };
  }

  upsertImageTagsBySource(imageId, tags, source, createdAt, options = {}) {
    const inputMode = options.inputMode === 'ids' ? 'ids' : 'names';
    const tagRows = inputMode === 'ids'
      ? validateSecondaryTagIds(this.db, tags)
      : resolveSecondaryTagIdsByNames(this.db, tags, {
        parentId: options.parentId,
        createdAt,
      }).map((tagId) => getTagById(this.db, tagId)).filter(Boolean);

    this.db.run(
      `DELETE FROM image_tags
       WHERE image_id = :imageId
         AND source = :source`,
      { imageId, source },
    );

    for (const tag of tagRows) {
      this.db.run(
        `INSERT INTO image_tags (image_id, tag_id, source, created_at)
         VALUES (:imageId, :tagId, :source, :createdAt)
         ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
        {
          imageId,
          tagId: tag.id,
          source,
          createdAt,
        },
      );
    }

    return tagRows;
  }

  getImageWritebackMetadata(imageId) {
    const image = this.db.get('SELECT id, library_path, active_caption_id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const caption = image.active_caption_id
      ? this.db.get(
        `SELECT content
         FROM captions
         WHERE id = :captionId`,
        { captionId: image.active_caption_id },
      )?.content || ''
      : '';

    const tags = this.getEffectiveTags(imageId);
    return {
      image,
      caption: String(caption || '').trim(),
      tags,
    };
  }

  syncImageMetadataToXmp(imageId, targetImagePath = '') {
    const metadata = this.getImageWritebackMetadata(imageId);
    const outputPath = targetImagePath ? path.resolve(targetImagePath) : metadata.image.library_path;
    const writeResult = writeXmpForImage(outputPath, {
      caption: metadata.caption,
      tags: metadata.tags,
    });

    return {
      imageId,
      outputPath,
      sidecarPath: writeResult.sidecarPath || '',
      embedded: Boolean(writeResult.embedded),
      writeMode: writeResult.mode || (writeResult.sidecarPath ? 'sidecar' : 'embedded'),
      caption: metadata.caption,
      tags: metadata.tags,
    };
  }

  async refreshEmbeddingWithFallback(imageId) {
    try {
      await this.aiService.refreshEmbedding(imageId);
      return {
        embeddingStatus: 'refreshed',
        analysisStatus: IMAGE_STATUS.READY,
      };
    } catch (error) {
      this.db.transaction(() => {
        const now = nowIso();
        this.db.run(
          `UPDATE images
           SET needs_embedding_refresh = 1,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            imageId,
            updatedAt: now,
          },
        );

        this.createAnalysisJob(imageId, {
          jobType: 'refresh_embedding',
          maxRetryCount: 2,
          asTransaction: true,
        });
      });

      await this.queue.drain();

      return {
        embeddingStatus: 'queued_for_refresh',
        analysisStatus: IMAGE_STATUS.QUEUED,
        errorCode: error?.code || 'EMBEDDING_REFRESH_FAILED',
      };
    }
  }

  async updateImageCaption(imageId, content) {
    const cleanContent = String(content || '').trim();
    if (!cleanContent) {
      throw new Error('EMPTY_CAPTION');
    }

    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    let captionId;

    this.db.transaction(() => {
      const now = nowIso();

      this.db.run('UPDATE captions SET is_active = 0 WHERE image_id = :imageId', { imageId });
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
          'user',
          1,
          NULL,
          NULL,
          :now,
          :now
        )`,
        {
          imageId,
          content: cleanContent,
          now,
        },
      );

      captionId = Number(result.lastInsertRowid);

      this.db.run(
        `UPDATE images
         SET active_caption_id = :captionId,
             needs_embedding_refresh = 0,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          captionId,
          updatedAt: now,
          imageId,
        },
      );
    });

    const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
    let xmpSidecarPath = '';
    try {
      xmpSidecarPath = this.syncImageMetadataToXmp(imageId).sidecarPath;
    } catch (error) {
      this.logger.error('xmp-write-library-failed', {
        imageId,
        error: String(error?.message || error),
      });
    }

    return { imageId, captionId, ...embeddingResult, xmpSidecarPath };
  }

  async updateImageTags(imageId, tagIds) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const normalizedTagIds = normalizeTagIds(tagIds);
    const useIdInput = normalizedTagIds.length > 0
      || (Array.isArray(tagIds) && tagIds.length === 0);

    this.db.transaction(() => {
      const now = nowIso();
      this.upsertImageTagsBySource(
        imageId,
        useIdInput ? normalizedTagIds : tagIds,
        'user',
        now,
        { inputMode: useIdInput ? 'ids' : 'names' },
      );

      this.db.run(
        `UPDATE images
         SET active_tag_source = 'user',
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          imageId,
          updatedAt: now,
        },
      );
    });

    const embeddingResult = await this.refreshEmbeddingWithFallback(imageId);
    let xmpSidecarPath = '';
    try {
      xmpSidecarPath = this.syncImageMetadataToXmp(imageId).sidecarPath;
    } catch (error) {
      this.logger.error('xmp-write-library-failed', {
        imageId,
        error: String(error?.message || error),
      });
    }

    return {
      imageId,
      activeTagSource: 'user',
      tags: this.getEffectiveTagRecords(imageId),
      tagNames: this.getEffectiveTags(imageId),
      ...embeddingResult,
      xmpSidecarPath,
    };
  }

  exportImage(imageId, destinationPath) {
    const image = this.db.get(
      `SELECT id, original_file_name, library_path
       FROM images
       WHERE id = :imageId`,
      { imageId },
    );

    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    if (!destinationPath) {
      throw new Error('EXPORT_PATH_REQUIRED');
    }

    const outputPath = appendOriginalExtensionIfMissing(path.resolve(destinationPath), image.original_file_name);
    copyFile(image.library_path, outputPath);
    const xmpSync = this.syncImageMetadataToXmp(imageId, outputPath);

    return {
      imageId,
      filePath: outputPath,
      sidecarPath: xmpSync.sidecarPath,
      embedded: xmpSync.embedded,
      writeMode: xmpSync.writeMode,
    };
  }

  exportImages(imageIds, destinationDir) {
    const resolvedDir = resolveExistingFolderPath(destinationDir);
    const normalizedImageIds = normalizeImageIds(imageIds);
    if (!normalizedImageIds.length) {
      throw new Error('EMPTY_EXPORT_SELECTION');
    }

    const usedPaths = new Set();
    const exported = [];
    const failed = [];

    for (const imageId of normalizedImageIds) {
      const image = this.db.get(
        `SELECT id, original_file_name, library_path
         FROM images
         WHERE id = :imageId`,
        { imageId },
      );

      if (!image) {
        failed.push({
          imageId,
          reason: 'IMAGE_NOT_FOUND',
        });
        continue;
      }

      const baseName = sanitizeExportFileName(image.original_file_name, `image-${image.id}.jpg`);
      const parsed = path.parse(baseName);
      const ext = parsed.ext || path.extname(image.original_file_name) || '.jpg';
      const stem = parsed.name || `image-${image.id}`;

      let index = 0;
      let outputPath = '';
      do {
        const suffix = index === 0 ? '' : `-${index + 1}`;
        outputPath = path.join(resolvedDir, `${stem}${suffix}${ext}`);
        index += 1;
      } while (usedPaths.has(outputPath.toLowerCase()) || fs.existsSync(outputPath));

      usedPaths.add(outputPath.toLowerCase());

      try {
        copyFile(image.library_path, outputPath);
        const xmpSync = this.syncImageMetadataToXmp(image.id, outputPath);
        exported.push({
          imageId: image.id,
          filePath: outputPath,
          sidecarPath: xmpSync.sidecarPath,
          embedded: xmpSync.embedded,
          writeMode: xmpSync.writeMode,
        });
      } catch (error) {
        failed.push({
          imageId: image.id,
          reason: error?.code || 'EXPORT_FAILED',
          message: String(error?.message || error),
        });
      }
    }

    return {
      destinationDir: resolvedDir,
      requestedCount: normalizedImageIds.length,
      exportedCount: exported.length,
      failedCount: failed.length,
      exported,
      failed,
    };
  }

  deleteImage(imageId) {
    const image = this.db.get('SELECT * FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    this.db.transaction(() => {
      this.db.run('DELETE FROM images WHERE id = :imageId', { imageId });
    });

    removeFileIfExists(image.library_path);
    removeFileIfExists(image.thumbnail_path);
    removeFileIfExists(buildXmpSidecarPathForImage(image.library_path));

    return {
      imageId,
      deleted: true,
    };
  }

  async rebuildImageAnalysis(imageId) {
    const image = this.db.get('SELECT id FROM images WHERE id = :imageId', { imageId });
    if (!image) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const now = nowIso();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE images
         SET analysis_status = :queued,
             updated_at = :updatedAt
         WHERE id = :imageId`,
        {
          queued: IMAGE_STATUS.QUEUED,
          updatedAt: now,
          imageId,
        },
      );

      this.db.run(
        `INSERT INTO analysis_jobs (
          image_id,
          job_type,
          status,
          retry_count,
          max_retry_count,
          created_at,
          updated_at
        ) VALUES (
          :imageId,
          'analyze_image',
          :status,
          0,
          2,
          :createdAt,
          :updatedAt
        )`,
        {
          imageId,
          status: JOB_STATUS.PENDING,
          createdAt: now,
          updatedAt: now,
        },
      );
    });

    const status = await this.waitForImageAnalysisSettled(imageId);

    return {
      imageId,
      status,
    };
  }

  async waitForImageAnalysisSettled(imageId, timeoutMs = 120000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await this.queue.drain();

      const image = this.db.get(
        `SELECT analysis_status
         FROM images
         WHERE id = :imageId`,
        { imageId },
      );

      if (!image) {
        throw new Error('IMAGE_NOT_FOUND');
      }

      if (image.analysis_status === IMAGE_STATUS.READY || image.analysis_status === IMAGE_STATUS.FAILED) {
        return image.analysis_status;
      }

      await sleep(120);
    }

    const error = new Error('JOB_TIMEOUT');
    error.code = 'JOB_TIMEOUT';
    throw error;
  }

  async getFilterTags(query = '', selectedTagIds = [], filterMode = DEFAULT_TAG_FILTER_MODE) {
    const cleanQuery = String(query || '').trim();
    const sourceItems = await this.collectSearchItems(cleanQuery, selectedTagIds, filterMode);

    const counter = new Map();
    // groupCounter 用于存储每个分组的不重复图片数量
    const groupCounter = new Map();
    // 临时存储每个分组的图片 ID 集合用于去重
    const groupImageIds = new Map();

    for (const item of sourceItems) {
      const itemGroupIds = new Set();
      for (const tag of item.tagDetails || []) {
        counter.set(tag.id, (counter.get(tag.id) || 0) + 1);
        // 收集该图片关联的所有分组 ID
        if (tag.parentId) {
          itemGroupIds.add(tag.parentId);
        }
      }
      // 将该图片 ID 添加到每个关联分组的集合中（去重）
      for (const groupId of itemGroupIds) {
        if (!groupImageIds.has(groupId)) {
          groupImageIds.set(groupId, new Set());
        }
        groupImageIds.get(groupId).add(item.id);
      }
    }

    // 计算每个分组的不重复图片数量
    for (const [groupId, imageIds] of groupImageIds) {
      groupCounter.set(groupId, imageIds.size);
    }

    return listTagTree(this.db, counter, groupCounter);
  }

}
