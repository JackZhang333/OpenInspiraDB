import { nowIso } from '../core/database.js';

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

export function saveAiTags(db, imageId, tagNames) {
  const now = nowIso();
  db.run("DELETE FROM image_tags WHERE image_id = :imageId AND source = 'ai'", { imageId });

  for (const tagName of tagNames) {
    db.run(
      `INSERT INTO tags (name, language, created_at)
       VALUES (:name, 'zh', :createdAt)
       ON CONFLICT(name, language) DO NOTHING`,
      { name: tagName, createdAt: now },
    );

    const tag = db.get("SELECT id FROM tags WHERE name = :name AND language = 'zh'", { name: tagName });
    if (!tag) {
      continue;
    }

    db.run(
      `INSERT INTO image_tags (image_id, tag_id, source, created_at)
       VALUES (:imageId, :tagId, 'ai', :createdAt)
       ON CONFLICT(image_id, tag_id, source) DO NOTHING`,
      { imageId, tagId: tag.id, createdAt: now },
    );
  }
}
