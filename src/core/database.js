import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const LATEST_SCHEMA_VERSION = 1;
const UNCATEGORIZED_TAG_NAME = '未分组';

const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_file_name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  library_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  md5_hash TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  import_status TEXT NOT NULL DEFAULT 'imported',
  analysis_status TEXT NOT NULL DEFAULT 'imported',
  active_caption_id INTEGER,
  active_tag_source TEXT NOT NULL DEFAULT 'ai',
  needs_embedding_refresh INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (active_caption_id) REFERENCES captions(id)
);

CREATE TABLE IF NOT EXISTS captions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('ai', 'user')),
  is_active INTEGER NOT NULL DEFAULT 0,
  model_provider TEXT,
  model_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_captions_active_per_image
ON captions(image_id)
WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'zh',
  parent_id INTEGER,
  level INTEGER NOT NULL DEFAULT 2 CHECK(level IN (1, 2)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  UNIQUE(name, language),
  FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS image_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('ai', 'user')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(image_id, tag_id, source)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL UNIQUE,
  vector TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  model_provider TEXT,
  model_name TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'analyze_image',
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retry_count INTEGER NOT NULL DEFAULT 2,
  last_error_code TEXT,
  last_error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_image_id ON analysis_jobs(image_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_source_image_id ON image_tags(source, image_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_source_tag_id ON image_tags(source, tag_id);
`;

export function nowIso() {
  return new Date().toISOString();
}

function quoteIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function tableExists(db, tableName) {
  return Boolean(db.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name = :tableName
     LIMIT 1`,
  ).get({
    tableName,
  }));
}

function getTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
}

function hasColumn(db, tableName, columnName) {
  return getTableColumns(db, tableName).some((column) => column.name === columnName);
}

function ensureColumn(db, tableName, columnName, definition) {
  if (hasColumn(db, tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${columnName} ${definition}`);
}

function createKeyValueAppSettingsTable(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
}

function ensureKeyValueAppSettingsTable(db) {
  if (!tableExists(db, 'app_settings')) {
    createKeyValueAppSettingsTable(db);
    return;
  }

  const columns = getTableColumns(db, 'app_settings').map((column) => column.name);
  if (columns.includes('key') && columns.includes('value') && columns.includes('updated_at')) {
    return;
  }

  let backupTableName = 'app_settings_legacy_v0';
  let backupIndex = 1;
  while (tableExists(db, backupTableName)) {
    backupTableName = `app_settings_legacy_v${backupIndex}`;
    backupIndex += 1;
  }

  db.exec(`ALTER TABLE ${quoteIdentifier('app_settings')} RENAME TO ${quoteIdentifier(backupTableName)}`);
  createKeyValueAppSettingsTable(db);
}

function ensureAppSetting(db, key, value, updatedAt) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (:key, :value, :updatedAt)
     ON CONFLICT(key) DO NOTHING`,
  ).run({
    key,
    value,
    updatedAt,
  });
}

function resolveMigrationConflictForUncategorized(db, updatedAt) {
  const conflictingTag = db.prepare(
    `SELECT id, name
     FROM tags
     WHERE name = :name
       AND level != 1
     LIMIT 1`,
  ).get({
    name: UNCATEGORIZED_TAG_NAME,
  });

  if (!conflictingTag) {
    return;
  }

  let nextName = '未分组（迁移）';
  let suffix = 2;
  while (db.prepare('SELECT id FROM tags WHERE name = :name LIMIT 1').get({ name: nextName })) {
    nextName = `未分组（迁移${suffix}）`;
    suffix += 1;
  }

  db.prepare(
    `UPDATE tags
     SET name = :nextName,
         updated_at = :updatedAt
     WHERE id = :tagId`,
  ).run({
    tagId: conflictingTag.id,
    nextName,
    updatedAt,
  });
}

function ensureUncategorizedParentTag(db, updatedAt) {
  resolveMigrationConflictForUncategorized(db, updatedAt);

  const existing = db.prepare(
    `SELECT *
     FROM tags
     WHERE name = :name
       AND level = 1
     LIMIT 1`,
  ).get({
    name: UNCATEGORIZED_TAG_NAME,
  });

  if (existing) {
    db.prepare(
      `UPDATE tags
       SET parent_id = NULL,
           level = 1,
           sort_order = 0,
           is_system = 1,
           updated_at = :updatedAt
       WHERE id = :tagId`,
    ).run({
      tagId: existing.id,
      updatedAt,
    });
    return existing.id;
  }

  const insert = db.prepare(
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
      1,
      0,
      1,
      :createdAt,
      :updatedAt
    )`,
  ).run({
    name: UNCATEGORIZED_TAG_NAME,
    createdAt: updatedAt,
    updatedAt,
  });

  return Number(insert.lastInsertRowid);
}

function migrateToSchemaVersion1(db) {
  const updatedAt = nowIso();

  db.exec('PRAGMA foreign_keys = OFF');

  ensureColumn(db, 'tags', 'parent_id', 'INTEGER REFERENCES tags(id) ON DELETE SET NULL');
  ensureColumn(db, 'tags', 'level', 'INTEGER NOT NULL DEFAULT 2');
  ensureColumn(db, 'tags', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'tags', 'is_system', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'tags', 'updated_at', "TEXT NOT NULL DEFAULT ''");

  ensureKeyValueAppSettingsTable(db);

  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_parent_sort_name ON tags(parent_id, sort_order, name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_level_name ON tags(level, name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_image_tags_source_image_id ON image_tags(source, image_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_image_tags_source_tag_id ON image_tags(source, tag_id)');

  db.prepare(
    `UPDATE tags
     SET updated_at = CASE
       WHEN TRIM(COALESCE(updated_at, '')) = '' THEN created_at
       ELSE updated_at
     END`,
  ).run();

  const uncategorizedTagId = ensureUncategorizedParentTag(db, updatedAt);

  db.prepare(
    `UPDATE tags
     SET level = CASE
           WHEN id = :uncategorizedTagId THEN 1
           ELSE 2
         END,
         parent_id = CASE
           WHEN id = :uncategorizedTagId THEN NULL
           WHEN level = 1 AND parent_id IS NULL THEN parent_id
           WHEN parent_id IS NULL THEN :uncategorizedTagId
           ELSE parent_id
         END,
         updated_at = CASE
           WHEN TRIM(COALESCE(updated_at, '')) = '' THEN :updatedAt
           ELSE updated_at
         END
     WHERE id != :uncategorizedTagId
        OR level != 1`,
  ).run({
    uncategorizedTagId,
    updatedAt,
  });

  db.prepare(
    `UPDATE tags
     SET parent_id = NULL,
         level = 1,
         sort_order = 0,
         is_system = 1,
         updated_at = :updatedAt
     WHERE id = :uncategorizedTagId`,
  ).run({
    uncategorizedTagId,
    updatedAt,
  });

  ensureAppSetting(db, 'tag_filter_mode', 'and', updatedAt);

  db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`);
  db.exec('PRAGMA foreign_keys = ON');
}

function runMigrations(db) {
  const versionRow = db.prepare('PRAGMA user_version').get();
  const currentVersion = Number(versionRow?.user_version || 0);

  if (currentVersion < 1) {
    migrateToSchemaVersion1(db);
  }
}

function ensurePostMigrationIndexes(db) {
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_parent_sort_name ON tags(parent_id, sort_order, name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_level_name ON tags(level, name)');
}

export class InspiraDatabase {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(PRAGMA_SQL);
    this.db.exec(SCHEMA_SQL);
    runMigrations(this.db);
    ensurePostMigrationIndexes(this.db);
    this.db.exec(PRAGMA_SQL);
  }

  close() {
    this.db.close();
  }

  exec(sql) {
    this.db.exec(sql);
  }

  run(sql, params = {}) {
    return this.db.prepare(sql).run(params);
  }

  get(sql, params = {}) {
    return this.db.prepare(sql).get(params);
  }

  all(sql, params = {}) {
    return this.db.prepare(sql).all(params);
  }

  transaction(fn) {
    this.exec('BEGIN');
    try {
      const result = fn();
      this.exec('COMMIT');
      return result;
    } catch (error) {
      this.exec('ROLLBACK');
      throw error;
    }
  }
}
