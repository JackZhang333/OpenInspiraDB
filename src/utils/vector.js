import { DEFAULT_VECTOR_DIMENSION } from '../core/config.js';
import { stableHash } from './hash.js';

function bytesToUnitFloat(byte) {
  return byte / 255;
}

export function embedTextMock(text, dimension = DEFAULT_VECTOR_DIMENSION) {
  const bytes = stableHash(text || '');
  const vector = new Array(dimension).fill(0).map((_, index) => {
    const b = bytes[index % bytes.length];
    return Number((bytesToUnitFloat(b) * 2 - 1).toFixed(6));
  });

  return normalizeVector(vector);
}

export function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((acc, n) => acc + n * n, 0));
  if (!norm) {
    return vector;
  }
  return vector.map((n) => n / norm);
}

export function cosineSimilarity(a, b) {
  if (!a.length || a.length !== b.length) {
    return -1;
  }

  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}
