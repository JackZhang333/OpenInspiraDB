import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  created_at TEXT NOT NULL,
  UNIQUE(name, language)
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

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_image_id ON analysis_jobs(image_id);
`;

export function nowIso() {
  return new Date().toISOString();
}

export class InspiraDatabase {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA_SQL);
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
