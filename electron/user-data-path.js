import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const LEGACY_USER_DATA_DIR_NAMES = ['InspiraDB', '意图集'];
const REQUIRED_TABLES = ['images', 'tags', 'app_settings'];

function hasRequiredTables(db) {
  const rows = db.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'`,
  ).all();
  const tableNames = new Set(rows.map((row) => String(row?.name || '')));
  return REQUIRED_TABLES.every((tableName) => tableNames.has(tableName));
}

export function isValidDataRoot(rootPath) {
  const resolvedRootPath = path.resolve(String(rootPath || ''));
  const dbPath = path.join(resolvedRootPath, 'inspiradb.sqlite');
  if (!fs.existsSync(dbPath)) {
    return false;
  }

  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    return hasRequiredTables(db);
  } catch {
    return false;
  } finally {
    db?.close?.();
  }
}

export function isDirectoryEmpty(dirPath) {
  const resolvedDirPath = path.resolve(String(dirPath || ''));
  if (!fs.existsSync(resolvedDirPath)) {
    return true;
  }

  try {
    const stat = fs.statSync(resolvedDirPath);
    if (!stat.isDirectory()) {
      return false;
    }

    return fs.readdirSync(resolvedDirPath).length === 0;
  } catch {
    return false;
  }
}

export function listCompatibleUserDataCandidates(userDataPath) {
  const resolvedUserDataPath = path.resolve(String(userDataPath || ''));
  const parentDir = path.dirname(resolvedUserDataPath);
  const names = new Set([path.basename(resolvedUserDataPath), ...LEGACY_USER_DATA_DIR_NAMES]);
  return Array.from(names).map((name) => path.join(parentDir, name));
}

export function resolveCompatibleUserDataPath({
  userDataPath,
  logger,
} = {}) {
  const resolvedUserDataPath = path.resolve(String(userDataPath || ''));
  if (!resolvedUserDataPath) {
    throw new Error('USER_DATA_PATH_REQUIRED');
  }

  if (isValidDataRoot(resolvedUserDataPath)) {
    logger?.info?.('user-data-path-selected', {
      source: 'current-valid',
      userDataPath: resolvedUserDataPath,
    });
    return resolvedUserDataPath;
  }

  if (!isDirectoryEmpty(resolvedUserDataPath)) {
    logger?.info?.('user-data-path-kept-current', {
      source: 'current-non-empty-invalid',
      userDataPath: resolvedUserDataPath,
    });
    return resolvedUserDataPath;
  }

  const candidates = listCompatibleUserDataCandidates(resolvedUserDataPath);
  for (const candidatePath of candidates) {
    if (candidatePath === resolvedUserDataPath) {
      continue;
    }

    if (isValidDataRoot(candidatePath)) {
      logger?.info?.('user-data-path-selected', {
        source: 'legacy-compatible',
        userDataPath: candidatePath,
        previousUserDataPath: resolvedUserDataPath,
      });
      return candidatePath;
    }
  }

  logger?.info?.('user-data-path-selected', {
    source: 'current-empty-no-compatible-legacy',
    userDataPath: resolvedUserDataPath,
  });
  return resolvedUserDataPath;
}
