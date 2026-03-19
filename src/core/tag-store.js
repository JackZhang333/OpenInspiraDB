import { nowIso } from './database.js';
import { normalizeTagName, uniqueNonEmptyTags } from '../utils/text.js';

export const TAG_LEVEL_PARENT = 1;
export const TAG_LEVEL_CHILD = 2;
export const DEFAULT_TAG_FILTER_MODE = 'and';
export const UNCATEGORIZED_TAG_NAME = '未分组';

export const PRESET_TAXONOMY = [
  {
    name: '行业 / 用途',
    children: [
      '电商', '品牌', 'UI', '海报', '包装', 'LOGO', '画册', 'PPT', '网页', '公众号',
      '短视频', '直播', 'Banner', '主图', '详情页', '易拉宝', '展架', '名片', '折页', '菜单',
      '贺卡', '邀请函', '文创', 'IP', '插画', '摄影', '人像', '产品', '美食', '建筑',
      '室内', '服装', '美妆', '汽车', '医疗', '教育', '金融', '游戏', '动漫', '节日',
    ],
  },
  {
    name: '风格',
    children: [
      '极简', '轻奢', '国潮', '新中式', '日系', '韩系', '欧美', '复古', '赛博朋克', '蒸汽波',
      '酸性', '孟菲斯', '扁平', '渐变', '肌理', '手绘', '涂鸦', '剪纸', '水墨', '油画',
      '科技', '未来', '商务', '文艺', '清新', '暗黑', '冷淡', '温暖', '明亮', '梦幻',
      '童趣', '复古胶片', '港风', 'ins 风', 'c4d', '3D', '写实', '抽象', '几何', '线条',
      '块面', '拼贴', '故障风', '弥散', '玻璃拟态', '新丑风', '古典', '宫廷', '极简风', '工业风',
      '自然风', '运动风', '街头', '潮酷', '优雅', '大气',
    ],
  },
  {
    name: '色彩',
    children: [
      '红色', '粉色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '黑色', '白色',
      '灰色', '金色', '银色', '彩色', '单色', '撞色', '同色系', '低饱和', '高饱和', '马卡龙',
      '莫兰迪', '克莱因蓝', '中国红', '黑金', '红白', '蓝白', '黄绿', '粉蓝', '橙蓝', '紫粉',
      '暖色调', '冷色调', '中性色', '大地色', '荧光色', '金属色', '透明', '渐变色', '霓虹', '复古色',
    ],
  },
  {
    name: '构图 / 形式',
    children: [
      '居中', '左右分屏', '上下分屏', '满版', '留白', '对称', '不对称', '网格', '放射', '环绕',
      '叠加', '穿插', '俯视', '平视', '仰视', '特写', '全景', '横版', '竖版', '方版',
      '长图', '多图', '单图', '文字为主', '图片为主', '图标为主', '极简构图', '复杂构图', '动态', '静态',
    ],
  },
  {
    name: '情绪 / 氛围',
    children: [
      '高级', '简约', '热闹', '喜庆', '严肃', '活泼', '轻松', '治愈', '神秘', '科技感',
      '未来感', '复古感', '文艺感', '商务感', '轻奢感', '国潮感', '可爱', '大气感', '精致', '粗糙',
    ],
  },
];

export const PRESET_PARENT_TAGS = PRESET_TAXONOMY.map((entry) => entry.name);
const PRESET_CHILD_PARENT_MAP = new Map(
  PRESET_TAXONOMY.flatMap((group) => group.children.map((child) => [child, group.name])),
);

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

export function getTagByName(db, rawName) {
  const name = normalizeTagName(String(rawName || ''));
  if (!name) {
    return null;
  }

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
     WHERE t.name = :name
       AND t.language = 'zh'
     LIMIT 1`,
    { name },
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

export function findPresetTaxonomyMatch(rawParentName, rawChildName) {
  const childName = normalizeTagName(String(rawChildName || ''));
  if (!childName) {
    return null;
  }

  const parentName = normalizeTagName(String(rawParentName || ''));
  if (parentName) {
    const parent = PRESET_TAXONOMY.find((group) => group.name === parentName);
    if (parent?.children.includes(childName)) {
      return {
        parentName,
        childName,
      };
    }
  }

  const matchedParentName = PRESET_CHILD_PARENT_MAP.get(childName);
  if (!matchedParentName) {
    return null;
  }

  return {
    parentName: matchedParentName,
    childName,
  };
}

export function ensureParentTag(db, rawName, options = {}) {
  const name = normalizeTagName(String(rawName || ''));
  if (!name) {
    return null;
  }

  const createdAt = options.createdAt || nowIso();
  const existing = getTagByName(db, name);
  if (existing) {
    if (existing.level !== TAG_LEVEL_PARENT) {
      const error = new Error('TAG_NAME_CONFLICT');
      error.code = 'TAG_NAME_CONFLICT';
      throw error;
    }

    return existing;
  }

  const sortOrder = Number.isInteger(options.sortOrder)
    ? options.sortOrder
    : Number(db.get(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
       FROM tags
       WHERE level = :level`,
      { level: TAG_LEVEL_PARENT },
    )?.next_sort_order || 0);

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
      :sortOrder,
      :isSystem,
      :createdAt,
      :updatedAt
    )`,
    {
      name,
      level: TAG_LEVEL_PARENT,
      sortOrder,
      isSystem: options.isSystem ? 1 : 0,
      createdAt,
      updatedAt: createdAt,
    },
  );

  return getTagById(db, Number(insert.lastInsertRowid));
}

export function cleanupUnusedPresetTags(db, options = {}) {
  const updatedAt = options.updatedAt || nowIso();

  for (const childName of PRESET_CHILD_PARENT_MAP.keys()) {
    const childTag = getTagByName(db, childName);
    if (!childTag || childTag.level !== TAG_LEVEL_CHILD) {
      continue;
    }

    const usageRow = db.get(
      `SELECT COUNT(*) AS total
       FROM image_tags
       WHERE tag_id = :tagId`,
      { tagId: childTag.id },
    );

    if (Number(usageRow?.total || 0) > 0) {
      continue;
    }

    db.run('DELETE FROM tags WHERE id = :tagId', { tagId: childTag.id });
  }

  for (const parentName of PRESET_PARENT_TAGS) {
    const parentTag = getTagByName(db, parentName);
    if (!parentTag || parentTag.level !== TAG_LEVEL_PARENT) {
      continue;
    }

    const childRow = db.get(
      `SELECT id
       FROM tags
       WHERE parent_id = :parentId
       LIMIT 1`,
      { parentId: parentTag.id },
    );

    if (childRow) {
      continue;
    }

    db.run(
      `UPDATE tags
       SET updated_at = :updatedAt
       WHERE id = :tagId`,
      {
        tagId: parentTag.id,
        updatedAt,
      },
    );
    db.run('DELETE FROM tags WHERE id = :tagId', { tagId: parentTag.id });
  }

  return listParentTags(db);
}

export function ensureSecondaryTag(db, rawName, options = {}) {
  const name = normalizeTagName(String(rawName || ''));
  if (!name) {
    return null;
  }

  const createdAt = options.createdAt || nowIso();
  const parent = options.parentId
    ? getTagById(db, options.parentId)
    : options.parentName
      ? ensureParentTag(db, options.parentName, { createdAt })
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
      sortOrder: Number.isInteger(options.sortOrder)
        ? options.sortOrder
        : Number(sortRow?.next_sort_order || 0),
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
  const usageCountRows = db.all(
    `SELECT it.tag_id, COUNT(*) AS total
     FROM image_tags it
     JOIN images i ON i.id = it.image_id
     JOIN tags t ON t.id = it.tag_id
     WHERE t.level = :level
       AND (
         (i.active_tag_source = 'user' AND it.source = 'user')
         OR (i.active_tag_source = 'ai' AND it.source = 'ai')
       )
     GROUP BY it.tag_id`,
    { level: TAG_LEVEL_CHILD },
  );
  const usageCountByTagId = new Map(
    usageCountRows.map((row) => [Number(row.tag_id), Number(row.total || 0)]),
  );

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
              t.is_system ASC,
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
        usageCount: 0,
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
      usageCount: 0,
      children: [],
    };

    const count = Number(countByTagId.get(row.id) || 0);
    const usageCount = Number(usageCountByTagId.get(row.id) || 0);
    parent.children.push({
      ...row,
      count,
      usageCount,
    });
    parent.count += count;
    parent.usageCount += usageCount;
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
