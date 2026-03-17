import { createHash } from 'node:crypto';
import fs from 'node:fs';

export function md5File(filePath) {
  const hash = createHash('md5');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

export function stableHash(text) {
  const hash = createHash('sha256');
  hash.update(text);
  return hash.digest();
}
