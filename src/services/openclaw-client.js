/**
 * OpenClaw 客户端
 * 负责与本地 OpenClaw 服务通信，获取标签协同进化建议
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('openclaw-client');

const DEFAULT_ENDPOINT = process.env.OPENCLAW_ENDPOINT || 'http://localhost:876';
const DEFAULT_API_KEY = process.env.OPENCLAW_API_KEY || 'inspiradb-openclaw-integration-20260329';
const REQUEST_TIMEOUT = 30000; // 30秒超时

export class OpenClawClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.apiKey = options.apiKey || DEFAULT_API_KEY;
    this.timeout = options.timeout || REQUEST_TIMEOUT;
  }

  /**
   * 获取请求头
   * @private
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-InspiraDB-Version': '1.0',
    };
  }

  /**
   * 检查 OpenClaw 服务是否可用
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 请求标签分析建议
   * @param {Object} params
   * @param {Array} params.tagTree - 当前标签树
   * @param {Object} params.tagUsageStats - 标签使用统计（包含层级、父标签等完整信息）
   * @param {Array} params.imageTagStats - 图片-标签关联统计
   * @param {Object} params.constraints - 约束条件
   * @param {string} params.sessionId - 会话ID
   * @returns {Promise<Object>} - 分析建议
   */
  async analyzeTags({ tagTree, tagUsageStats, imageTagStats, constraints, sessionId }) {
    const requestBody = {
      action: 'analyze-tags',
      sessionId,
      payload: {
        tagTree,
        tagUsageStats,
        imageTagStats,
        constraints,
        context: {
          userId: 'inspiradb-user',
          projectId: 'inspiradb-project',
          timestamp: new Date().toISOString(),
        },
      },
    };

    // 调试日志：打印发送给 OpenClaw 的数据
    const tagUsageStatsEntries = tagUsageStats ? Object.entries(tagUsageStats) : [];
    const uncategorizedInTree = tagTree?.find(p => p.name === '未分组');
    const uncategorizedStats = tagUsageStats ? Object.values(tagUsageStats).filter(t => t.parentName === '未分组' || t.name === '未分组') : [];

    logger.debug('openclaw-analyze-request', {
      endpoint: `${this.endpoint}/analyze/tags`,
      sessionId,
      tagTreeCount: tagTree?.length,
      tagUsageStatsCount: tagUsageStatsEntries.length,
      imageTagStatsCount: imageTagStats?.length,
      tagTreeParents: tagTree?.map(p => ({ id: p.id, name: p.name, childrenCount: p.children?.length })),
      uncategorizedInTree: uncategorizedInTree ? {
        id: uncategorizedInTree.id,
        childrenCount: uncategorizedInTree.children?.length,
        children: uncategorizedInTree.children?.map(c => ({ id: c.id, name: c.name })),
      } : null,
      uncategorizedStatsCount: uncategorizedStats.length,
      uncategorizedStatsSample: uncategorizedStats.slice(0, 5),
      allChildTagNames: tagTree?.flatMap(p => p.children?.map(c => c.name) || []),
      constraints,
    });

    const response = await this.request('/analyze/tags', requestBody);

    // 调试日志：打印 OpenClaw 响应
    logger.debug('openclaw-analyze-response', {
      sessionId: response?.sessionId,
      suggestionsCount: response?.suggestions?.length,
      suggestionsSample: response?.suggestions?.slice(0, 3).map(s => ({
        id: s.id,
        kind: s.kind,
        name: s.name,
        sourceTagName: s.sourceTagName,
        targetTagName: s.targetTagName,
        sourceTagId: s.sourceTagId,
        targetTagId: s.targetTagId,
      })),
    });

    return this.parseAnalyzeResponse(response);
  }

  /**
   * 发送用户反馈
   * @param {Object} params
   * @param {string} params.sessionId - 会话ID
   * @param {Array} params.decisions - 用户决策记录
   * @param {number} params.userRating - 用户评分 (1-5)
   * @param {string} params.comments - 用户评论
   * @returns {Promise<Object>}
   */
  async sendFeedback({ sessionId, decisions, userRating, comments }) {
    return this.request('/feedback', {
      action: 'feedback',
      sessionId,
      payload: {
        decisions,
        userRating,
        comments: comments || '',
      },
    });
  }

  /**
   * 发送 HTTP 请求
   * @private
   */
  async request(path, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`OpenClaw request failed: ${response.status}`);
        error.code = 'OPENCLAW_REQUEST_FAILED';
        error.status = response.status;
        throw error;
      }

      // 读取原始响应文本并记录
      const responseText = await response.text();
      logger.debug('openclaw-raw-response', {
        path,
        status: response.status,
        rawBody: responseText,
        rawBodyLength: responseText.length,
      });

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        logger.error('openclaw-response-parse-error', {
          path,
          rawBody: responseText,
          error: parseError.message,
        });
        throw new Error(`Failed to parse OpenClaw response: ${parseError.message}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error('OpenClaw request timeout');
        timeoutError.code = 'OPENCLAW_TIMEOUT';
        throw timeoutError;
      }

      if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
        const connError = new Error('OpenClaw service unavailable');
        connError.code = 'OPENCLAW_UNAVAILABLE';
        throw connError;
      }

      throw error;
    }
  }

  /**
   * 解析分析响应
   * @private
   */
  parseAnalyzeResponse(response) {
    // 验证响应格式
    if (!response || !Array.isArray(response.suggestions)) {
      throw new Error('Invalid OpenClaw response format');
    }

    return {
      sessionId: response.sessionId || this.generateSessionId(),
      suggestions: response.suggestions.map((s) => this.normalizeSuggestion(s)),
      metadata: response.metadata || {},
    };
  }

  /**
   * 规范化建议格式
   * @private
   */
  normalizeSuggestion(suggestion) {
    // 调试日志：打印原始建议数据
    logger.debug('openclaw-normalize-suggestion-raw', {
      id: suggestion?.id,
      kind: suggestion?.kind,
      name: suggestion?.name,
      sourceTagName: suggestion?.sourceTagName,
      targetTagName: suggestion?.targetTagName,
      sourceTagId: suggestion?.sourceTagId,
      targetTagId: suggestion?.targetTagId,
      currentName: suggestion?.currentName,
    });

    const normalized = {
      id: suggestion.id || `oc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      kind: this.validateKind(suggestion.kind),
      confidence: Math.max(0, Math.min(1, Number(suggestion.confidence) || 0.5)),
      reason: String(suggestion.reason || ''),
    };

    // 根据操作类型添加特定字段
    switch (normalized.kind) {
      case 'create':
        normalized.level = Number(suggestion.level) || 2;
        normalized.name = String(suggestion.name || '');
        normalized.parentName = String(suggestion.parentName || '');
        break;
      case 'rename':
        normalized.tagId = Number(suggestion.tagId) || 0;
        normalized.name = String(suggestion.name || suggestion.currentName || '');
        normalized.nextName = String(suggestion.nextName || '');
        break;
      case 'merge':
        normalized.sourceTagId = Number(suggestion.sourceTagId) || 0;
        normalized.targetTagId = Number(suggestion.targetTagId) || 0;
        normalized.name = String(suggestion.name || suggestion.sourceTagName || '');
        normalized.targetTagName = String(suggestion.targetTagName || '');
        normalized.targetParentName = String(suggestion.targetParentName || '');
        break;
      case 'move':
        normalized.tagId = Number(suggestion.tagId) || 0;
        normalized.name = String(suggestion.name || suggestion.currentName || '');
        normalized.targetParentName = String(suggestion.targetParentName || '');
        break;
      case 'delete':
        normalized.tagId = Number(suggestion.tagId) || 0;
        normalized.name = String(suggestion.name || suggestion.currentName || '');
        normalized.replacementTargets = Array.isArray(suggestion.replacementTargets)
          ? suggestion.replacementTargets
          : [];
        break;
    }

    // 调试日志：打印规范化后的建议
    logger.debug('openclaw-normalize-suggestion-result', {
      id: normalized.id,
      kind: normalized.kind,
      name: normalized.name,
      tagId: normalized.tagId,
      sourceTagId: normalized.sourceTagId,
      targetTagId: normalized.targetTagId,
      targetTagName: normalized.targetTagName,
    });

    return normalized;
  }

  /**
   * 验证操作类型
   * @private
   */
  validateKind(kind) {
    const validKinds = ['create', 'rename', 'merge', 'move', 'delete'];
    const normalized = String(kind || '').toLowerCase();
    return validKinds.includes(normalized) ? normalized : 'create';
  }

  /**
   * 生成会话ID
   * @private
   */
  generateSessionId() {
    return `oc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * 创建默认客户端实例
 */
export function createOpenClawClient(options = {}) {
  return new OpenClawClient(options);
}
