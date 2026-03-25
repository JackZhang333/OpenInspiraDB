import { nowIso } from '../core/database.js';
import {
  UNCATEGORIZED_TAG_NAME,
  ensureParentTag,
  ensureSecondaryTag,
  findPresetTaxonomyMatch,
  getTagByName,
  getUncategorizedParentTag,
} from '../core/tag-store.js';
import { normalizeTagName, uniqueNonEmptyTags } from '../utils/text.js';

const MAX_AI_NEW_PARENT_COUNT = 1;
const MAX_AI_NEW_CHILD_COUNT = 4;
const INVALID_PARENT_NAMES = new Set([
  '',
  '一级分类',
  '二级分类',
  '分类',
  '标签',
  '默认',
  '默认分类',
  '其他',
  '其它',
  '通用',
]);

function mapLegacyTagsToTaxonomyTags(tagNames) {
  return uniqueNonEmptyTags(tagNames || []).map((tagName) => ({
    parentName: UNCATEGORIZED_TAG_NAME,
    childName: tagName,
    isNewParent: false,
    isNewChild: false,
  }));
}

function normalizeTaxonomyTags(input) {
  if (Array.isArray(input)) {
    if (input.every((item) => typeof item === 'string')) {
      return mapLegacyTagsToTaxonomyTags(input);
    }

    const seenChildNames = new Set();
    const items = [];

    for (const rawItem of input) {
      const childName = normalizeTagName(String(rawItem?.childName || rawItem?.name || ''));
      if (!childName || seenChildNames.has(childName)) {
        continue;
      }

      seenChildNames.add(childName);
      items.push({
        parentName: normalizeTagName(String(rawItem?.parentName || '')),
        childName,
        isNewParent: Boolean(rawItem?.isNewParent),
        isNewChild: Boolean(rawItem?.isNewChild),
      });
    }

    return items;
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  if (Array.isArray(input.taxonomyTags)) {
    const seenChildNames = new Set();
    const items = [];

    for (const rawItem of input.taxonomyTags) {
      const childName = normalizeTagName(String(rawItem?.childName || ''));
      if (!childName || seenChildNames.has(childName)) {
        continue;
      }

      seenChildNames.add(childName);
      items.push({
        parentName: normalizeTagName(String(rawItem?.parentName || '')),
        childName,
        isNewParent: Boolean(rawItem?.isNewParent),
        isNewChild: Boolean(rawItem?.isNewChild),
      });
    }

    return items;
  }

  if (Array.isArray(input.tags)) {
    return mapLegacyTagsToTaxonomyTags(input.tags);
  }

  return [];
}

function isInvalidParentName(name) {
  return INVALID_PARENT_NAMES.has(normalizeTagName(String(name || '')));
}

function resolveParentTag(db, item, state, createdAt) {
  const normalizedParentName = normalizeTagName(String(item.parentName || ''));
  const normalizedChildName = normalizeTagName(String(item.childName || ''));

  if (!normalizedParentName || normalizedParentName === normalizedChildName || isInvalidParentName(normalizedParentName)) {
    return getUncategorizedParentTag(db, createdAt);
  }

  // Handle English "Uncategorized" equivalent
  if (normalizedParentName.toLowerCase() === 'uncategorized') {
    return getUncategorizedParentTag(db, createdAt);
  }

  const existingParent = getTagByName(db, normalizedParentName);
  if (existingParent) {
    return existingParent.level === 1
      ? existingParent
      : getUncategorizedParentTag(db, createdAt);
  }

  if (normalizedParentName === UNCATEGORIZED_TAG_NAME) {
    return getUncategorizedParentTag(db, createdAt);
  }

  if (state.newParentCount >= MAX_AI_NEW_PARENT_COUNT) {
    return getUncategorizedParentTag(db, createdAt);
  }

  const createdParent = ensureParentTag(db, normalizedParentName, { createdAt });
  state.newParentCount += 1;
  return createdParent || getUncategorizedParentTag(db, createdAt);
}

function resolveAiTagRows(db, input, createdAt) {
  const normalizedItems = normalizeTaxonomyTags(input);
  const state = {
    newParentCount: 0,
    newChildCount: 0,
  };
  const tagRows = [];

  for (const item of normalizedItems) {
    const childName = normalizeTagName(String(item.childName || ''));
    if (!childName) {
      continue;
    }

    const presetMatch = findPresetTaxonomyMatch(item.parentName, childName);

    const existingChild = getTagByName(db, childName);
    if (existingChild) {
      if (existingChild.level === 2) {
        tagRows.push(existingChild);
      }
      continue;
    }

    let childTag = null;
    if (presetMatch) {
      const parentTag = ensureParentTag(db, presetMatch.parentName, { createdAt });
      childTag = ensureSecondaryTag(db, presetMatch.childName, {
        parentId: parentTag?.id,
        createdAt,
      });
    } else {
      if (state.newChildCount >= MAX_AI_NEW_CHILD_COUNT) {
        continue;
      }

      const parent = resolveParentTag(db, item, state, createdAt);
      childTag = ensureSecondaryTag(db, childName, {
        parentId: parent?.id,
        createdAt,
      });

      if (childTag) {
        state.newChildCount += 1;
      }
    }

    if (!childTag) {
      continue;
    }

    tagRows.push(childTag);
  }

  return uniqueTagRows(tagRows);
}

function uniqueTagRows(rows) {
  const seen = new Set();
  const output = [];

  for (const row of rows) {
    if (!row || seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    output.push(row);
  }

  return output;
}

export function upsertEmbedding(db, imageId, vector, provider, modelName) {
  const now = nowIso();
  const serialized = JSON.stringify(vector);
  const existing = db.get('SELECT id FROM embeddings WHERE image_id = :imageId', { imageId });

  if (existing) {
    db.run(
      `UPDATE embeddings
       SET vector = :vector,
           dimension = :dimension,
           model_provider = :provider,
           model_name = :modelName,
           created_at = :now
       WHERE image_id = :imageId`,
      {
        imageId,
        vector: serialized,
        dimension: vector.length,
        provider,
        modelName,
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
      :provider,
      :modelName,
      :now
    )`,
    {
      imageId,
      vector: serialized,
      dimension: vector.length,
      provider,
      modelName,
      now,
    },
  );
}

export function saveAiTags(db, imageId, input) {
  const now = nowIso();
  const tagRows = resolveAiTagRows(db, input, now);

  db.run("DELETE FROM image_tags WHERE image_id = :imageId AND source = 'ai'", { imageId });

  for (const tag of tagRows) {
    db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'ai', :createdAt)
       ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
      { imageId, tagId: tag.id, createdAt: now },
    );
  }

  return tagRows;
}
