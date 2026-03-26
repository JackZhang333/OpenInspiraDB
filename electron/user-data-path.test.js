import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  isDirectoryEmpty,
  isValidDataRoot,
  resolveCompatibleUserDataPath,
} from './user-data-path.js';

function createValidDataRoot(rootPath) {
  fs.mkdirSync(rootPath, { recursive: true });
  const db = new DatabaseSync(path.join(rootPath, 'inspiradb.sqlite'));
  db.exec(`
    CREATE TABLE images (id INTEGER PRIMARY KEY);
    CREATE TABLE tags (id INTEGER PRIMARY KEY);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  db.close();
}

test('isDirectoryEmpty treats a missing directory as empty', () => {
  assert.equal(isDirectoryEmpty('/tmp/path-that-should-not-exist-codex-check'), true);
});

test('resolveCompatibleUserDataPath prefers the current valid userData directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-user-data-current-test-'));

  try {
    const currentPath = path.join(root, 'CurrentAppData');
    const legacyPath = path.join(root, 'InspiraDB');
    createValidDataRoot(currentPath);
    createValidDataRoot(legacyPath);

    const resolvedPath = resolveCompatibleUserDataPath({
      userDataPath: currentPath,
      logger: null,
    });

    assert.equal(resolvedPath, currentPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveCompatibleUserDataPath adopts the InspiraDB legacy directory when the current directory is empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-user-data-legacy-en-test-'));

  try {
    const currentPath = path.join(root, 'CurrentAppData');
    const legacyPath = path.join(root, 'InspiraDB');
    fs.mkdirSync(currentPath, { recursive: true });
    createValidDataRoot(legacyPath);

    const resolvedPath = resolveCompatibleUserDataPath({
      userDataPath: currentPath,
      logger: null,
    });

    assert.equal(resolvedPath, legacyPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveCompatibleUserDataPath adopts the 意图集 legacy directory when the current directory is empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-user-data-legacy-zh-test-'));

  try {
    const currentPath = path.join(root, 'CurrentAppData');
    const legacyPath = path.join(root, '意图集');
    fs.mkdirSync(currentPath, { recursive: true });
    createValidDataRoot(legacyPath);

    const resolvedPath = resolveCompatibleUserDataPath({
      userDataPath: currentPath,
      logger: null,
    });

    assert.equal(resolvedPath, legacyPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveCompatibleUserDataPath ignores invalid legacy candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-user-data-invalid-legacy-test-'));

  try {
    const currentPath = path.join(root, 'CurrentAppData');
    const legacyPath = path.join(root, 'InspiraDB');
    fs.mkdirSync(currentPath, { recursive: true });
    fs.mkdirSync(legacyPath, { recursive: true });
    fs.writeFileSync(path.join(legacyPath, 'inspiradb.sqlite'), 'not-a-database');

    const resolvedPath = resolveCompatibleUserDataPath({
      userDataPath: currentPath,
      logger: null,
    });

    assert.equal(resolvedPath, currentPath);
    assert.equal(isValidDataRoot(legacyPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveCompatibleUserDataPath keeps a non-empty current directory even when it has no valid database', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiradb-user-data-current-non-empty-test-'));

  try {
    const currentPath = path.join(root, 'CurrentAppData');
    const legacyPath = path.join(root, 'InspiraDB');
    fs.mkdirSync(currentPath, { recursive: true });
    fs.writeFileSync(path.join(currentPath, 'leftover.log'), 'partial-install');
    createValidDataRoot(legacyPath);

    const resolvedPath = resolveCompatibleUserDataPath({
      userDataPath: currentPath,
      logger: null,
    });

    assert.equal(resolvedPath, currentPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
