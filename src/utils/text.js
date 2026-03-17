export function normalizeTagName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

export function uniqueNonEmptyTags(tags) {
  const seen = new Set();
  const output = [];

  for (const rawTag of tags) {
    const tag = normalizeTagName(rawTag);
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    output.push(tag);
  }

  return output;
}
