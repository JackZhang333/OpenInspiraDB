import { normalizeTagName } from '../utils/text.js';

export const TAG_ORGANIZATION_LOW_USAGE_THRESHOLD = 5;
export const TAG_ORGANIZATION_RECOMMENDED_INTERVAL_DAYS = 183;
export const MAX_ORGANIZATION_NEW_PARENT_COUNT = 3;
export const MAX_ORGANIZATION_NEW_CHILD_COUNT = 12;

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

      output.push({
        id: String(rawItem?.id || `op-${index + 1}`),
        kind,
        source,
        tagId,
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
