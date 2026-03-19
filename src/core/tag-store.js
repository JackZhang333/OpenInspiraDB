import { nowIso } from './database.js';
import { normalizeTagName, uniqueNonEmptyTags } from '../utils/text.js';

export const TAG_LEVEL_PARENT = 1;
export const TAG_LEVEL_CHILD = 2;
export const DEFAULT_TAG_FILTER_MODE = 'and';
export const UNCATEGORIZED_TAG_NAME = '未分组';

export function normalizeTagFilterMode(value) {
  return String(value || '').trim().toLowerCase() === 'or' ? 'or' : 'and';
}

export function normalizeTagIds(tagIds) {
  const seen = new Set();
  const output = [];

  for (const rawId of Array.isArray(tagIds) ? tagIds : []) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      continue;
    }

    seen.add(id);
    output.push(id);
  }

  return output;
}

function mapTagRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: String(row.name || ''),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    parentName: row.parent_name ? String(row.parent_name) : '',
    level: Number(row.level || TAG_LEVEL_CHILD),
    sortOrder: Number(row.sort_order || 0),
    isSystem: Boolean(row.is_system),
  };
}

export function getTagById(db, tagId) {
  return mapTagRow(db.get(
    `SELECT t.id,
            t.name,
            t.parent_id,
            p.name AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM tags t
     LEFT JOIN tags p ON p.id = t.parent_id
     WHERE t.id = :tagId
     LIMIT 1`,
    { tagId: Number(tagId) || 0 },
  ));
}

export function getAppSetting(db, key, fallback = '') {
  const row = db.get(
    `SELECT value
     FROM app_settings
     WHERE key = :key
     LIMIT 1`,
    { key },
  );

  if (!row) {
    return fallback;
  }

  return String(row.value || fallback);
}

export function setAppSetting(db, key, value, updatedAt = nowIso()) {
  db.run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (:key, :value, :updatedAt)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    {
      key,
      value: String(value ?? ''),
      updatedAt,
    },
  );
}

export function getTagFilterMode(db) {
  return normalizeTagFilterMode(getAppSetting(db, 'tag_filter_mode', DEFAULT_TAG_FILTER_MODE));
}

export function getUncategorizedParentTag(db, createdAt = nowIso()) {
  const existing = db.get(
    `SELECT id,
            name,
            parent_id,
            NULL AS parent_name,
            level,
            sort_order,
            is_system
     FROM tags
     WHERE name = :name
       AND level = :level
     LIMIT 1`,
    {
      name: UNCATEGORIZED_TAG_NAME,
      level: TAG_LEVEL_PARENT,
    },
  );

  if (existing) {
    return mapTagRow(existing);
  }

  const insert = db.run(
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
      0,
      1,
      :createdAt,
      :updatedAt
    )`,
    {
      name: UNCATEGORIZED_TAG_NAME,
      level: TAG_LEVEL_PARENT,
      createdAt,
      updatedAt: createdAt,
    },
  );

  return getTagById(db, Number(insert.lastInsertRowid));
}

export function listParentTags(db) {
  return db.all(
    `SELECT t.id,
            t.name,
            t.parent_id,
            NULL AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM tags t
     WHERE t.level = :level
     ORDER BY t.sort_order ASC, t.name ASC`,
    { level: TAG_LEVEL_PARENT },
  ).map(mapTagRow);
}

export function ensureSecondaryTag(db, rawName, options = {}) {
  const name = normalizeTagName(String(rawName || ''));
  if (!name) {
    return null;
  }

  const createdAt = options.createdAt || nowIso();
  const parent = options.parentId
    ? getTagById(db, options.parentId)
    : getUncategorizedParentTag(db, createdAt);

  if (!parent || parent.level !== TAG_LEVEL_PARENT) {
    const error = new Error('PARENT_TAG_NOT_FOUND');
    error.code = 'PARENT_TAG_NOT_FOUND';
    throw error;
  }

  const existing = db.get(
    `SELECT t.id,
            t.name,
            t.parent_id,
            p.name AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM tags t
     LEFT JOIN tags p ON p.id = t.parent_id
     WHERE t.name = :name
       AND t.language = 'zh'
     LIMIT 1`,
    { name },
  );

  if (existing) {
    if (Number(existing.level) !== TAG_LEVEL_CHILD) {
      const error = new Error('TAG_NAME_CONFLICT');
      error.code = 'TAG_NAME_CONFLICT';
      throw error;
    }
    return mapTagRow(existing);
  }

  const sortRow = db.get(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
     FROM tags
     WHERE parent_id = :parentId
       AND level = :level`,
    {
      parentId: parent.id,
      level: TAG_LEVEL_CHILD,
    },
  );

  const insert = db.run(
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
      :parentId,
      :level,
      :sortOrder,
      0,
      :createdAt,
      :updatedAt
    )`,
    {
      name,
      parentId: parent.id,
      level: TAG_LEVEL_CHILD,
      sortOrder: Number(sortRow?.next_sort_order || 0),
      createdAt,
      updatedAt: createdAt,
    },
  );

  return getTagById(db, Number(insert.lastInsertRowid));
}

export function resolveSecondaryTagIdsByNames(db, tagNames, options = {}) {
  const normalizedTagNames = uniqueNonEmptyTags(tagNames || []);
  const ids = [];

  for (const tagName of normalizedTagNames) {
    const tag = ensureSecondaryTag(db, tagName, options);
    if (tag) {
      ids.push(tag.id);
    }
  }

  return normalizeTagIds(ids);
}

export function validateSecondaryTagIds(db, tagIds) {
  const normalizedIds = normalizeTagIds(tagIds);
  if (!normalizedIds.length) {
    return [];
  }

  const placeholders = normalizedIds.map((_, index) => `:tag${index}`).join(', ');
  const params = normalizedIds.reduce((accumulator, id, index) => {
    accumulator[`tag${index}`] = id;
    return accumulator;
  }, {});

  const rows = db.all(
    `SELECT t.id,
            t.name,
            t.parent_id,
            p.name AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM tags t
     LEFT JOIN tags p ON p.id = t.parent_id
     WHERE t.id IN (${placeholders})`,
    params,
  ).map(mapTagRow);

  if (rows.length !== normalizedIds.length) {
    const error = new Error('TAG_NOT_FOUND');
    error.code = 'TAG_NOT_FOUND';
    throw error;
  }

  if (rows.some((row) => row.level !== TAG_LEVEL_CHILD)) {
    const error = new Error('TAG_LEVEL_INVALID');
    error.code = 'TAG_LEVEL_INVALID';
    throw error;
  }

  return normalizedIds.map((id) => rows.find((row) => row.id === id));
}

export function listImageTagsBySource(db, imageId, source) {
  return db.all(
    `SELECT t.id,
            t.name,
            t.parent_id,
            p.name AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM image_tags it
     JOIN tags t ON t.id = it.tag_id
     LEFT JOIN tags p ON p.id = t.parent_id
     WHERE it.image_id = :imageId
       AND it.source = :source
       AND t.level = :level
     ORDER BY COALESCE(p.sort_order, 0) ASC,
              COALESCE(p.name, '') ASC,
              t.sort_order ASC,
              t.name ASC`,
    {
      imageId,
      source,
      level: TAG_LEVEL_CHILD,
    },
  ).map(mapTagRow);
}

export function listEffectiveTagRecords(db, imageId) {
  const image = db.get(
    `SELECT id, active_tag_source
     FROM images
     WHERE id = :imageId
     LIMIT 1`,
    { imageId },
  );

  if (!image) {
    return [];
  }

  return listImageTagsBySource(db, imageId, image.active_tag_source === 'user' ? 'user' : 'ai');
}

export function listEffectiveTagNames(db, imageId) {
  return listEffectiveTagRecords(db, imageId).map((tag) => tag.name);
}

export function listTagTree(db, countByTagId = new Map()) {
  const rows = db.all(
    `SELECT t.id,
            t.name,
            t.parent_id,
            p.name AS parent_name,
            t.level,
            t.sort_order,
            t.is_system
     FROM tags t
     LEFT JOIN tags p ON p.id = t.parent_id
     ORDER BY CASE WHEN t.level = :parentLevel THEN 0 ELSE 1 END ASC,
              COALESCE(p.sort_order, t.sort_order, 0) ASC,
              COALESCE(p.name, t.name, '') ASC,
              t.sort_order ASC,
              t.name ASC`,
    { parentLevel: TAG_LEVEL_PARENT },
  );

  const parents = new Map();

  for (const rawRow of rows) {
    const row = mapTagRow(rawRow);
    if (!row) {
      continue;
    }

    if (row.level === TAG_LEVEL_PARENT) {
      parents.set(row.id, {
        ...row,
        count: 0,
        children: [],
      });
      continue;
    }

    const parent = parents.get(row.parentId) || {
      id: row.parentId,
      name: row.parentName || UNCATEGORIZED_TAG_NAME,
      parentId: null,
      parentName: '',
      level: TAG_LEVEL_PARENT,
      sortOrder: 0,
      isSystem: row.parentName === UNCATEGORIZED_TAG_NAME,
      count: 0,
      children: [],
    };

    const count = Number(countByTagId.get(row.id) || 0);
    parent.children.push({
      ...row,
      count,
    });
    parent.count += count;
    parents.set(parent.id, parent);
  }

  return Array.from(parents.values())
    .map((parent) => ({
      ...parent,
      children: parent.children.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
}
