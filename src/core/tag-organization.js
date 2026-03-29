import { normalizeTagName } from '../utils/text.js';

export const TAG_ORGANIZATION_LOW_USAGE_THRESHOLD = 5;
export const TAG_ORGANIZATION_RECOMMENDED_INTERVAL_DAYS = 183;
export const MAX_ORGANIZATION_NEW_CHILD_COUNT = 12;

// 动态一级标签数量限制策略
const MIN_PARENT_TAGS = 3;
const MAX_PARENT_TAGS = 15;
const PARENT_CHILD_RATIO = 20; // 20:1 的比例

/**
 * 计算一级标签数量上限
 * 策略：50个二级标签时最多5个一级，200个二级时最多10个一级
 * 使用线性插值：maxParent = MIN(15, MAX(3, ceil(childCount / 20)))
 *
 * @param {number} childTagCount - 当前二级标签数量
 * @returns {number} - 允许的最大一级标签数量
 */
export function calculateMaxParentTags(childTagCount) {
  const count = Math.max(0, Number(childTagCount) || 0);
  const calculated = Math.ceil(count / PARENT_CHILD_RATIO);
  return Math.min(MAX_PARENT_TAGS, Math.max(MIN_PARENT_TAGS, calculated));
}

/**
 * 计算可新增的一级标签数量
 * @param {number} currentParentCount - 当前一级标签数量
 * @param {number} childTagCount - 当前二级标签数量
 * @returns {number} - 允许新增的一级标签数量
 */
export function calculateAllowedNewParentTags(currentParentCount, childTagCount) {
  const maxAllowed = calculateMaxParentTags(childTagCount);
  return Math.max(0, maxAllowed - Math.max(0, Number(currentParentCount) || 0));
}

/**
 * 获取一级标签限制描述（用于 AI prompt）
 * @param {number} childTagCount - 当前二级标签数量
 * @returns {string} - 描述文本
 */
export function getParentTagLimitDescription(childTagCount) {
  const max = calculateMaxParentTags(childTagCount);
  return `当前有 ${childTagCount} 个二级标签，一级标签上限为 ${max} 个`;
}

// 向后兼容：保留常量导出，但值会根据实际情况动态计算
export const MAX_ORGANIZATION_NEW_PARENT_COUNT = 3;

const INVALID_GENERATED_TAG_NAMES = new Set([
  '',
  '标签',
  '一级标签',
  '二级标签',
  '分类',
  '一级分类',
  '二级分类',
  '默认',
  '默认分类',
  '通用',
  '其他',
  '其它',
]);

function normalizeOperationKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  if (['create', 'rename', 'merge', 'move', 'delete'].includes(kind)) {
    return kind;
  }
  return '';
}

function normalizeOperationLevel(value) {
  if (Number(value) === 1 || String(value).trim().toLowerCase() === 'parent') {
    return 1;
  }
  if (Number(value) === 2 || String(value).trim().toLowerCase() === 'child') {
    return 2;
  }
  return 0;
}

export function normalizeOrganizationSource(value) {
  const source = String(value || '').trim().toLowerCase();
  if (source === 'preset' || source === 'generated') {
    return source;
  }
  return 'existing';
}

function normalizeOrganizationTarget(rawItem) {
  const targetTagName = normalizeTagName(String(rawItem?.targetTagName || rawItem?.name || ''));
  if (!targetTagName) {
    return null;
  }

  return {
    targetTagName,
    targetParentName: normalizeTagName(String(rawItem?.targetParentName || rawItem?.parentName || '')),
    source: normalizeOrganizationSource(rawItem?.source),
  };
}

export function isValidGeneratedTagName(rawName) {
  const name = normalizeTagName(String(rawName || ''));
  if (!name) {
    return false;
  }

  if (INVALID_GENERATED_TAG_NAMES.has(name)) {
    return false;
  }

  if (name.length > 16) {
    return false;
  }

  if (!/^[\p{Script=Han}A-Za-z0-9\s/+&-]+$/u.test(name)) {
    return false;
  }

  return true;
}

export function normalizeOrganizationOperations(items) {
  const output = [];

  for (const [index, rawItem] of (Array.isArray(items) ? items : []).entries()) {
    const kind = normalizeOperationKind(
      rawItem?.kind || rawItem?.type || rawItem?.action,
    );
    if (!kind) {
      continue;
    }

    const source = normalizeOrganizationSource(rawItem?.source);
    const reason = String(rawItem?.reason || '').trim();

    if (kind === 'create') {
      const level = normalizeOperationLevel(rawItem?.level);
      const name = normalizeTagName(String(rawItem?.name || ''));
      const parentName = normalizeTagName(String(rawItem?.parentName || ''));
      const sourceTagId = Number(rawItem?.sourceTagId || rawItem?.fromTagId || 0);
      if (!level || !name) {
        continue;
      }

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        level,
        name,
        parentName: level === 2 ? parentName : '',
        sourceTagId: level === 2 && sourceTagId > 0 ? sourceTagId : 0,
        reason,
      });
      continue;
    }

    if (kind === 'rename') {
      const tagId = Number(rawItem?.tagId || rawItem?.id || 0);
      const nextName = normalizeTagName(String(rawItem?.nextName || rawItem?.name || ''));
      if (!tagId || !nextName) {
        continue;
      }

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        tagId,
        nextName,
        reason,
      });
      continue;
    }

    if (kind === 'merge') {
      const sourceTagId = Number(rawItem?.sourceTagId || rawItem?.tagId || 0);
      const targetTagName = normalizeTagName(String(rawItem?.targetTagName || rawItem?.name || ''));
      const targetParentName = normalizeTagName(String(rawItem?.targetParentName || rawItem?.parentName || ''));
      if (!sourceTagId || !targetTagName) {
        continue;
      }

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        sourceTagId,
        targetTagName,
        targetParentName,
        reason,
      });
      continue;
    }

    if (kind === 'move') {
      const tagId = Number(rawItem?.tagId || rawItem?.id || 0);
      const targetParentName = normalizeTagName(String(rawItem?.targetParentName || rawItem?.parentName || ''));
      if (!tagId || !targetParentName) {
        continue;
      }

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        tagId,
        targetParentName,
        reason,
      });
      continue;
    }

    if (kind === 'delete') {
      const tagId = Number(rawItem?.tagId || rawItem?.id || 0);
      if (!tagId) {
        continue;
      }

      const replacementTargets = [];
      const seenTargets = new Set();
      for (const rawTarget of Array.isArray(rawItem?.replacementTargets) ? rawItem.replacementTargets : []) {
        const normalizedTarget = normalizeOrganizationTarget(rawTarget);
        if (!normalizedTarget) {
          continue;
        }

        const fingerprint = [
          normalizedTarget.targetTagName,
          normalizedTarget.targetParentName,
          normalizedTarget.source,
        ].join(':');
        if (seenTargets.has(fingerprint)) {
          continue;
        }

        seenTargets.add(fingerprint);
        replacementTargets.push(normalizedTarget);
      }

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        tagId,
        replacementTargets,
        reason,
      });
    }
  }

  return output;
}

export function summarizeOrganizationOperations(operations = []) {
  const summary = {
    createCount: 0,
    renameCount: 0,
    mergeCount: 0,
    moveCount: 0,
    deleteCount: 0,
  };

  for (const operation of operations) {
    if (operation?.kind === 'create') {
      summary.createCount += 1;
    } else if (operation?.kind === 'rename') {
      summary.renameCount += 1;
    } else if (operation?.kind === 'merge') {
      summary.mergeCount += 1;
    } else if (operation?.kind === 'move') {
      summary.moveCount += 1;
    } else if (operation?.kind === 'delete') {
      summary.deleteCount += 1;
    }
  }

  return summary;
}
