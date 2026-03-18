import { DEFAULT_VECTOR_DIMENSION } from '../core/config.js';
import { stableHash } from './hash.js';

function bytesToUnitFloat(byte) {
  return byte / 255;
}

function extractTextFeatures(text) {
  const features = new Set();
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  features.add(normalized);

  const normalizedWords = normalized
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const word of normalizedWords) {
    features.add(word);
    if (/[儿兒]$/u.test(word) && word.length > 1) {
      features.add(word.replace(/[儿兒]$/u, ''));
    }
  }

  const hanText = normalized.replace(/[^\p{Script=Han}]+/gu, '');
  for (const char of hanText) {
    features.add(char);
  }

  for (let index = 0; index < hanText.length - 1; index += 1) {
    features.add(hanText.slice(index, index + 2));
  }

  return Array.from(features);
}

export function embedTextMock(text, dimension = DEFAULT_VECTOR_DIMENSION) {
  const normalized = String(text || '').toLowerCase().trim();
  const features = extractTextFeatures(normalized);
  const vector = new Array(dimension).fill(0);

  for (const feature of features) {
    const bytes = stableHash(feature);
    const weight = Math.max(1, Math.min(feature.length, 4));

    for (let offset = 0; offset < 8; offset += 2) {
      const index = ((bytes[offset] << 8) | bytes[offset + 1]) % dimension;
      const sign = bytes[(offset + 8) % bytes.length] % 2 === 0 ? 1 : -1;
      vector[index] += sign * weight;
    }
  }

  if (!features.length) {
    const bytes = stableHash('__empty__');
    for (let index = 0; index < dimension; index += 1) {
      const b = bytes[index % bytes.length];
      vector[index] = Number((bytesToUnitFloat(b) * 2 - 1).toFixed(6));
    }
  }

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

export function cosineDistance(a, b) {
  const similarity = cosineSimilarity(a, b);
  if (similarity < -1) {
    return Infinity;
  }

  return 1 - similarity;
}
