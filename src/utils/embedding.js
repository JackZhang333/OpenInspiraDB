import { uniqueNonEmptyTags } from './text.js';

export function buildEmbeddingText(caption, tags = []) {
  const cleanCaption = String(caption || '').trim();
  const normalizedTags = uniqueNonEmptyTags(tags || []);

  if (cleanCaption && normalizedTags.length > 0) {
    return `${cleanCaption}\n${normalizedTags.join(' ')}`;
  }

  if (cleanCaption) {
    return cleanCaption;
  }

  return normalizedTags.join(' ');
}

export function getEffectiveTagNames(db, imageId) {
  const rows = db.all(
    `SELECT t.name
     FROM image_tags it
     JOIN tags t ON t.id = it.tag_id
     JOIN images i ON i.id = it.image_id
     WHERE it.image_id = :imageId
       AND it.source = CASE
         WHEN i.active_tag_source = 'user' THEN 'user'
         ELSE 'ai'
       END
     ORDER BY t.name ASC`,
    { imageId },
  );

  return rows.map((row) => row.name);
}

export function getExistingTagCandidates(db, limit = 200) {
  if (!db?.all) {
    return [];
  }

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 200;
  const rows = db.all(
    `SELECT t.name,
            COUNT(DISTINCT it.image_id) AS usage_count,
            MAX(it.created_at) AS last_used_at
     FROM tags t
     LEFT JOIN image_tags it ON it.tag_id = t.id
     WHERE t.language = 'zh'
     GROUP BY t.id, t.name
     ORDER BY usage_count DESC, last_used_at DESC, t.name ASC
     LIMIT :limit`,
    { limit: safeLimit },
  );

  return rows.map((row) => row.name);
}
