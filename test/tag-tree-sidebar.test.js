import test from 'node:test';
import assert from 'node:assert/strict';

import { filterSidebarTagTree } from '../renderer/src/lib/tag-tree.js';

test('filterSidebarTagTree hides globally empty tags but keeps selected zero-result tags', () => {
  const tree = [
    {
      id: 1,
      name: '行业 / 用途',
      count: 0,
      usageCount: 2,
      children: [
        { id: 11, name: '海报', count: 0, usageCount: 2 },
        { id: 12, name: '空标签', count: 0, usageCount: 0 },
      ],
    },
    {
      id: 2,
      name: '情绪 / 氛围',
      count: 0,
      usageCount: 0,
      children: [
        { id: 21, name: '治愈', count: 0, usageCount: 0 },
      ],
    },
  ];

  const filtered = filterSidebarTagTree(tree, [21]);

  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered[0].children.map((tag) => tag.id), [11]);
  assert.deepEqual(filtered[1].children.map((tag) => tag.id), [21]);
});
