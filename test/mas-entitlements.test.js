import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('MAS entitlements include read-write access for user-selected files', () => {
  const plistPath = path.resolve(process.cwd(), 'build', 'entitlements.mas.plist');
  const plist = fs.readFileSync(plistPath, 'utf8');

  assert.match(plist, /com\.apple\.security\.files\.user-selected\.read-write/);
});
