/**
 * 标签协同进化核心逻辑
 * 协调 InspiraDB 与 OpenClaw 的交互
 */

import { createLogger } from '../utils/logger.js';
import { calculateAllowedNewParentTags, calculateMaxParentTags } from './tag-organization.js';
import { TAG_LEVEL_CHILD, TAG_LEVEL_PARENT, listTagTree } from './tag-store.js';

const logger = createLogger('co-evolution');

/**
 * 协同进化会话状态
 */
export const CoEvolutionStatus = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  PENDING_CONFIRMATION: 'pending_confirmation',
  APPLYING: 'applying',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * 构建协同进化上下文
 * 收集当前标签系统的完整状态
 *
 * @param {Object} db - 数据库实例
 * @returns {Object} - 进化上下文
 */
export function buildCoEvolutionContext(db) {
  const tagTree = listTagTree(db);
  const flatTags = flattenTagTree(tagTree);

  // 统计信息
  const parentCount = flatTags.filter((t) => t.level === TAG_LEVEL_PARENT).length;
  const childCount = flatTags.filter((t) => t.level === TAG_LEVEL_CHILD).length;

  // 标签使用统计
  const tagUsageStats = {};
  for (const tag of flatTags) {
    tagUsageStats[tag.id] = {
      id: tag.id,
      name: tag.name,
      level: tag.level,
      parentId: tag.parentId,
      usageCount: tag.usageCount || 0,
      parentName: tag.parentName || '',
    };
  }

  // 图片-标签关联统计
  const imageTagStats = db.all(`
    SELECT
      t.id as tag_id,
      t.name as tag_name,
      COUNT(it.image_id) as image_count
    FROM tags t
    LEFT JOIN image_tags it ON t.id = it.tag_id
    GROUP BY t.id
  `);

  const context = {
    timestamp: new Date().toISOString(),
    stats: {
      parentCount,
      childCount,
      maxParentTags: calculateMaxParentTags(childCount),
      allowedNewParents: calculateAllowedNewParentTags(parentCount, childCount),
    },
    tagTree,
    tagUsageStats,
    imageTagStats,
  };

  // 调试日志：打印构建的上下文
  const uncategorizedParent = tagTree?.find(p => p.name === '未分组');
  logger.debug('buildCoEvolutionContext', {
    parentCount,
    childCount,
    flatTagsCount: flatTags.length,
    uncategorizedInfo: uncategorizedParent ? {
      parentId: uncategorizedParent.id,
      childrenCount: uncategorizedParent.children?.length,
      childrenSample: uncategorizedParent.children?.slice(0, 5).map(c => ({ id: c.id, name: c.name })),
    } : null,
    tagTreeParents: tagTree?.map(p => ({ id: p.id, name: p.name, childrenCount: p.children?.length })),
  });

  return context;
}

/**
 * 将 OpenClaw 建议转换为内部操作格式
 *
 * @param {Array} suggestions - OpenClaw 建议
 * @param {Array} tagTree - 可选的标签树，用于补充缺失的标签名称
 * @returns {Array} - 规范化操作
 */
export function convertSuggestionsToOperations(suggestions, tagTree = null) {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  // 构建 tagId -> name 的映射表
  const tagNameMap = new Map();
  if (tagTree) {
    for (const parent of tagTree) {
      tagNameMap.set(Number(parent.id), parent.name);
      for (const child of parent.children || []) {
        tagNameMap.set(Number(child.id), child.name);
      }
    }
  }

  // 调试日志：打印标签名称映射
  logger.debug('convertSuggestionsToOperations-tagNameMap', {
    mapSize: tagNameMap.size,
    sampleEntries: Array.from(tagNameMap.entries()).slice(0, 5),
  });

  // 辅助函数：获取标签名称
  const getTagName = (tagId, fallbackName) => {
    if (fallbackName) return fallbackName;
    if (!tagId) return '';
    return tagNameMap.get(Number(tagId)) || '';
  };

  const result = suggestions
    .map((s, index) => {
      const base = {
        id: s.id || `sugg-${index}`,
        kind: s.kind,
        source: 'openclaw',
        confidence: s.confidence,
        reason: s.reason,
      };

      switch (s.kind) {
        case 'create':
          return {
            ...base,
            level: s.level,
            name: s.name,
            parentName: s.parentName,
          };
        case 'rename':
          return {
            ...base,
            tagId: s.tagId,
            name: getTagName(s.tagId, s.name),
            nextName: s.nextName,
          };
        case 'merge':
          return {
            ...base,
            sourceTagId: s.sourceTagId,
            targetTagId: s.targetTagId,
            name: getTagName(s.sourceTagId, s.name),
            targetTagName: s.targetTagName || getTagName(s.targetTagId, ''),
            targetParentName: s.targetParentName,
          };
        case 'move':
          return {
            ...base,
            tagId: s.tagId,
            name: getTagName(s.tagId, s.name),
            targetParentName: s.targetParentName,
          };
        case 'delete':
          return {
            ...base,
            tagId: s.tagId,
            name: getTagName(s.tagId, s.name),
            replacementTargets: s.replacementTargets || [],
          };
        default:
          return null;
      }
    })
    .filter(Boolean);

  // 调试日志：打印转换结果
  logger.debug('convertSuggestionsToOperations-result', {
    inputCount: suggestions.length,
    outputCount: result.length,
    sampleOperations: result.slice(0, 3).map(op => ({
      id: op.id,
      kind: op.kind,
      name: op.name,
      tagId: op.tagId,
      sourceTagId: op.sourceTagId,
      targetTagId: op.targetTagId,
      targetTagName: op.targetTagName,
    })),
  });

  return result;
}

/**
 * 构建用户反馈数据
 *
 * @param {string} sessionId - 会话ID
 * @param {Array} suggestions - 原始建议
 * @param {Array} appliedOperations - 已应用操作
 * @param {Object} options
 * @returns {Object} - 反馈数据
 */
export function buildFeedbackPayload(
  sessionId,
  suggestions,
  appliedOperations,
  { userRating = null, userComments = '' } = {}
) {
  const appliedIds = new Set(appliedOperations.map((op) => op.id));

  const decisions = suggestions.map((s) => ({
    suggestionId: s.id,
    operation: {
      kind: s.kind,
      ...(s.tagId && { tagId: s.tagId }),
      ...(s.name && { name: s.name }),
      ...(s.nextName && { nextName: s.nextName }),
    },
    confidence: s.confidence,
    userApproved: appliedIds.has(s.id),
    reason: s.reason,
  }));

  return {
    sessionId,
    timestamp: new Date().toISOString(),
    decisions,
    userRating,
    userComments: userComments,
    stats: {
      totalSuggestions: suggestions.length,
      acceptedCount: decisions.filter((d) => d.userApproved).length,
      rejectedCount: decisions.filter((d) => !d.userApproved).length,
    },
  };
}

/**
 * 验证建议是否仍然有效
 * 检查标签是否被用户手动修改过
 *
 * @param {Object} suggestion - 建议
 * @param {Object} snapshot - 当前标签快照
 * @returns {Object} - { valid: boolean, reason?: string }
 */
export function validateSuggestion(suggestion, snapshot) {
  const { kind, tagId } = suggestion;

  // 检查涉及的标签是否仍然存在
  if (tagId) {
    const tag = snapshot.tagById.get(Number(tagId));
    if (!tag) {
      return { valid: false, reason: '标签已被删除' };
    }
  }

  // 对于 merge 操作，检查目标标签是否存在
  if (kind === 'merge' && suggestion.targetTagName) {
    const targetTag = snapshot.tagByName.get(suggestion.targetTagName);
    if (!targetTag) {
      return { valid: false, reason: '目标标签不存在' };
    }
  }

  // 对于 move 操作，检查目标父标签是否存在
  if (kind === 'move' && suggestion.targetParentName) {
    const parentTag = snapshot.tagByName.get(suggestion.targetParentName);
    if (!parentTag || parentTag.level !== TAG_LEVEL_PARENT) {
      return { valid: false, reason: '目标父标签不存在' };
    }
  }

  return { valid: true };
}

/**
 * 展平标签树
 * @private
 */
function flattenTagTree(tree) {
  const result = [];
  for (const parent of tree) {
    result.push({
      id: parent.id,
      name: parent.name,
      level: TAG_LEVEL_PARENT,
      parentId: null,
      parentName: '',
      usageCount: parent.children?.reduce((sum, c) => sum + (c.usageCount || 0), 0) || 0,
    });
    for (const child of parent.children || []) {
      result.push({
        id: child.id,
        name: child.name,
        level: TAG_LEVEL_CHILD,
        parentId: parent.id,
        parentName: parent.name,
        usageCount: child.usageCount || 0,
      });
    }
  }
  return result;
}

/**
 * 创建会话存储键
 * @param {string} sessionId
 * @returns {string}
 */
export function getSessionStorageKey(sessionId) {
  return `co-evolution:${sessionId}`;
}

// ==================== 反馈持久化（离线支持）====================

const FEEDBACK_QUEUE_KEY = 'co-evolution:feedback-queue';
const MAX_QUEUE_SIZE = 50;

/**
 * 将反馈加入队列（如果发送失败）
 * @param {Object} feedback - 反馈数据
 * @param {Object} db - 数据库实例（用于 SQLite 存储）
 */
export async function queueFeedbackForRetry(feedback, db) {
  if (!db) return;

  // 使用 SQLite 存储待发送的反馈
  db.run(`
    CREATE TABLE IF NOT EXISTS openclaw_feedback_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT
    )
  `);

  db.run(`
    INSERT INTO openclaw_feedback_queue (session_id, payload, created_at)
    VALUES (:sessionId, :payload, :createdAt)
  `, {
    sessionId: feedback.sessionId,
    payload: JSON.stringify(feedback),
    createdAt: new Date().toISOString(),
  });

  // 清理旧数据，保留最近 50 条
  db.run(`
    DELETE FROM openclaw_feedback_queue
    WHERE id NOT IN (
      SELECT id FROM openclaw_feedback_queue
      ORDER BY created_at DESC
      LIMIT ${MAX_QUEUE_SIZE}
    )
  `);
}

/**
 * 获取待发送的反馈队列
 * @param {Object} db - 数据库实例
 * @returns {Array} - 待发送的反馈列表
 */
export function getPendingFeedbackQueue(db) {
  if (!db) return [];

  const rows = db.all(`
    SELECT id, session_id, payload, retry_count, created_at
    FROM openclaw_feedback_queue
    ORDER BY created_at ASC
    LIMIT 10
  `);

  return rows.map((row) => ({
    queueId: row.id,
    sessionId: row.session_id,
    payload: JSON.parse(row.payload),
    retryCount: row.retry_count,
    createdAt: row.created_at,
  }));
}

/**
 * 从队列中移除已发送的反馈
 * @param {Object} db - 数据库实例
 * @param {number} queueId - 队列ID
 */
export function removeFeedbackFromQueue(db, queueId) {
  if (!db) return;

  db.run(`
    DELETE FROM openclaw_feedback_queue WHERE id = :id
  `, { id: queueId });
}

/**
 * 更新重试计数
 * @param {Object} db - 数据库实例
 * @param {number} queueId - 队列ID
 */
export function incrementFeedbackRetryCount(db, queueId) {
  if (!db) return;

  db.run(`
    UPDATE openclaw_feedback_queue
    SET retry_count = retry_count + 1, last_attempt_at = :now
    WHERE id = :id
  `, {
    id: queueId,
    now: new Date().toISOString(),
  });
}

/**
 * 清理超过 7 天的旧反馈
 * @param {Object} db - 数据库实例
 */
export function cleanupOldFeedback(db) {
  if (!db) return;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  db.run(`
    DELETE FROM openclaw_feedback_queue
    WHERE created_at < :threshold
  `, { threshold: sevenDaysAgo });
}
