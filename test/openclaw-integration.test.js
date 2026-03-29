/**
 * OpenClaw 服务集成测试
 * 验证 InspiraDB 与 OpenClaw 的 API 兼容性
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

const OPENCLAW_ENDPOINT = process.env.OPENCLAW_ENDPOINT || 'http://localhost:8765';
const API_KEY = process.env.OPENCLAW_API_KEY || 'inspiradb-openclaw-integration-20260329';

// 测试数据
const mockTagTree = [
  {
    id: 1,
    name: '风格',
    children: [
      { id: 11, name: '极简', usageCount: 45 },
      { id: 12, name: '简约', usageCount: 12 },
      { id: 13, name: '复古', usageCount: 8 },
    ],
  },
  {
    id: 2,
    name: '色彩',
    children: [
      { id: 21, name: '黑白', usageCount: 23 },
      { id: 22, name: '暖色调', usageCount: 15 },
    ],
  },
];

const mockImageTagStats = [
  { tag_id: 11, tag_name: '极简', image_count: 45 },
  { tag_id: 12, tag_name: '简约', image_count: 12 },
  { tag_id: 13, tag_name: '复古', image_count: 8 },
  { tag_id: 21, tag_name: '黑白', image_count: 23 },
  { tag_id: 22, tag_name: '暖色调', image_count: 15 },
];

describe('OpenClaw Service Integration', () => {
  let testSessionId = null;

  describe('1. Health Check', () => {
    it('should return 200 OK', async () => {
      const response = await fetch(`${OPENCLAW_ENDPOINT}/health`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });

      console.log('  Health check status:', response.status);
      assert.strictEqual(response.status, 200, 'Health check should return 200');

      const data = await response.json();
      console.log('  Health check response:', JSON.stringify(data, null, 2));
    });

    it('should return version info', async () => {
      const response = await fetch(`${OPENCLAW_ENDPOINT}/version`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });

      console.log('  Version check status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('  Version:', JSON.stringify(data, null, 2));
      }
    });
  });

  describe('2. Tag Analysis', () => {
    it('should analyze tags successfully', async () => {
      const requestBody = {
        action: 'analyze-tags',
        sessionId: `test-${Date.now()}`,
        payload: {
          tagTree: mockTagTree,
          imageTagStats: mockImageTagStats,
          constraints: {
            maxNewParentTags: 5,
            maxNewChildTags: 12,
          },
          context: {
            userId: 'inspiradb-user',
            projectId: 'inspiradb-project',
            timestamp: new Date().toISOString(),
          },
        },
      };

      console.log('  Analysis request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${OPENCLAW_ENDPOINT}/analyze/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('  Analysis status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('  Analysis error:', errorText);
      }

      assert.strictEqual(response.status, 200, 'Analysis should return 200');

      const data = await response.json();
      console.log('  Analysis response:', JSON.stringify(data, null, 2));

      // 验证响应格式
      assert.ok(data.sessionId, 'Response should have sessionId');
      assert.ok(Array.isArray(data.suggestions), 'Response should have suggestions array');

      if (data.suggestions.length > 0) {
        const suggestion = data.suggestions[0];
        assert.ok(suggestion.id, 'Suggestion should have id');
        assert.ok(suggestion.kind, 'Suggestion should have kind');
        assert.ok(typeof suggestion.confidence === 'number', 'Suggestion should have confidence');
        assert.ok(suggestion.reason, 'Suggestion should have reason');
      }

      testSessionId = data.sessionId;
    });

    it('should handle async analysis', async () => {
      const requestBody = {
        action: 'analyze-tags',
        sessionId: `async-test-${Date.now()}`,
        payload: {
          tagTree: mockTagTree,
          imageTagStats: mockImageTagStats,
          constraints: {
            maxNewParentTags: 5,
            maxNewChildTags: 12,
          },
          context: {
            userId: 'inspiradb-user',
            projectId: 'inspiradb-project',
          },
        },
      };

      const response = await fetch(`${OPENCLAW_ENDPOINT}/analyze/tags/async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('  Async analysis status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('  Async analysis response:', JSON.stringify(data, null, 2));

        assert.ok(data.sessionId, 'Async response should have sessionId');
        assert.ok(data.status, 'Async response should have status');
      }
    });
  });

  describe('3. User Feedback', () => {
    it('should accept feedback', async () => {
      if (!testSessionId) {
        console.log('  Skipping: no sessionId from analysis');
        return;
      }

      const requestBody = {
        action: 'feedback',
        sessionId: testSessionId,
        payload: {
          decisions: [
            {
              suggestionId: 'sugg-1',
              operation: { kind: 'merge', from: '简约', to: '极简' },
              confidence: 0.95,
              userApproved: true,
            },
          ],
          userRating: 4.5,
          comments: '建议很有帮助，但部分合并建议需要谨慎考虑',
        },
      };

      console.log('  Feedback request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${OPENCLAW_ENDPOINT}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('  Feedback status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('  Feedback error:', errorText);
      }

      assert.strictEqual(response.status, 200, 'Feedback should return 200');

      const data = await response.json();
      console.log('  Feedback response:', JSON.stringify(data, null, 2));
    });

    it('should handle batch feedback', async () => {
      const requestBody = {
        action: 'feedback',
        sessionId: `batch-test-${Date.now()}`,
        payload: {
          decisions: [
            { suggestionId: 'sugg-1', userApproved: true },
            { suggestionId: 'sugg-2', userApproved: false },
          ],
          userRating: 3.5,
        },
      };

      const response = await fetch(`${OPENCLAW_ENDPOINT}/feedback/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('  Batch feedback status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('  Batch feedback response:', JSON.stringify(data, null, 2));
      }
    });
  });

  describe('4. Error Handling', () => {
    it('should reject invalid API key', async () => {
      const response = await fetch(`${OPENCLAW_ENDPOINT}/health`, {
        headers: { 'Authorization': 'Bearer invalid-key' },
      });

      console.log('  Invalid key status:', response.status);
      // 应该返回 401 或 403
      assert.ok(response.status === 401 || response.status === 403, 'Should reject invalid API key');
    });

    it('should reject malformed requests', async () => {
      const response = await fetch(`${OPENCLAW_ENDPOINT}/analyze/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ invalid: 'data' }),
      });

      console.log('  Malformed request status:', response.status);
      // 应该返回 400
      assert.strictEqual(response.status, 400, 'Should reject malformed requests');
    });
  });
});

// 运行测试
console.log('OpenClaw Integration Test Suite');
console.log('================================');
console.log('Endpoint:', OPENCLAW_ENDPOINT);
console.log('API Key:', API_KEY.slice(0, 10) + '...');
console.log('');
