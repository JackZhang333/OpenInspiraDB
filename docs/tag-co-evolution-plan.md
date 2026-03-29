# InspiraDB 标签协同进化功能方案可行性评估

## 方案概述

**目标**: 实现 InspiraDB 与 OpenClaw + evoMap.ai 的标签人机协同进化机制

**核心组件**:
1. **OpenClaw** - 本地 AI 代理，负责：
   - 分析标签系统并生成优化建议
   - 打包经验为 Gene 格式
   - 与 evoMap.ai 通信上传 Gene
2. **evoMap.ai** - 云端知识进化平台（OpenClaw 负责对接）
3. **Gene** - JSON 格式的经验包，包含标签调整记录、用户反馈、成功案例

**交互模式**:
- 用户手动触发标签梳理流程
- InspiraDB 向 OpenClaw 提供标签系统数据
- 在 InspiraDB UI 中展示 OpenClaw 生成的优化建议
- 用户确认后正式应用变更
- OpenClaw 负责将 Gene 上传至 evoMap.ai（InspiraDB 不直接参与）

---

## 当前系统状态分析

### InspiraDB 现有能力

**标签系统** (`src/core/tag-store.js`, `src/core/tag-organization.js`):
- 分层标签结构：一级(parent) + 二级(child)标签
- 支持的操作：create, rename, merge, move, delete
- AI 驱动的标签组织预览功能已存在 (`previewTagOrganization`)
- **动态一级标签限制策略** (新增):
  - 基于二级标签数量动态计算一级标签上限
  - 规则：50 个二级 → 一级不超过 5 个；200 个二级 → 一级不超过 10 个
  - 公式：`maxParentTags = Math.ceil(childCount / 20)`，最低 3 个，最高 15 个
- 限制条件：
  - 最多新增 12 个二级标签
  - 仅删除使用次数为 0 的标签

**AI 集成** (`src/services/zhipu-ai.js`):
- 使用智谱 AI (GLM-4V, GLM-4-Flash)
- 已有 `previewTagOrganization()` 方法生成标签整理方案
- 返回格式：`{ operations: [...] }`

**CLI 接口** (`src/cli/demo.js`):
- 基础 CLI 已存在，支持 import/search/update 等操作
- 缺少 tag-organization 相关命令

**通信机制** (`electron/main.js`):
- IPC 通道：`inspiradb:preview-tag-organization`, `inspiradb:apply-tag-organization-plan`
- 前端 Store: `useAppStore.js` 已集成标签组织功能

---

## 方案可行性评估

### 1. 标签协同进化机制 - ✅ 可行

**实现路径**:
```
用户触发 → OpenClaw 分析 → 生成建议 → InspiraDB 展示 → 用户确认 → 应用变更 → 打包 Gene → 上传 evoMap.ai
```

**技术要点**:
- **OpenClaw 集成**: 可通过以下方式与 InspiraDB 通信:
  - HTTP API: OpenClaw 启动本地 HTTP 服务，InspiraDB 通过 fetch 调用
  - IPC/stdio: OpenClaw 作为子进程启动，通过 stdin/stdout 通信
  - 文件/socket: 通过 Unix Socket 或临时文件交换数据

- **数据流设计**:
  ```javascript
  // InspiraDB → OpenClaw 请求格式
  {
    "action": "analyze-tags",
    "payload": {
      "tagTree": [...],           // 当前标签树
      "imageTagStats": {...},     // 标签使用统计
      "constraints": {            // 约束条件
        "maxNewParentTags": 5,
        "maxNewChildTags": 12
      }
    }
  }

  // OpenClaw → InspiraDB 响应格式
  {
    "suggestions": [
      { "kind": "merge", "sourceTagId": 12, "targetTagName": "极简", "confidence": 0.92 }
    ]
  }

  // 用户确认后，InspiraDB → OpenClaw 反馈
  {
    "action": "feedback",
    "payload": {
      "sessionId": "...",
      "decisions": [...],         // 用户采纳/拒绝的建议
      "userRating": 4             // 用户评分
    }
  }
  // OpenClaw 自行负责打包 Gene 并上传 evoMap.ai
  ```

**工作量评估**: 中等 (2-3 周)
- OpenClaw 通信模块: 3-5 天
- UI 展示与确认流程: 5-7 天
- Gene 打包与上传: 2-3 天
- 测试与集成: 3-5 天

### 2. Electron CLI 化 - ⚠️ 需要澄清

**OpenCLI 方案** (参考 https://github.com/jackwener/opencli):
- OpenCLI 使用 CDP + AppleScript 控制桌面应用
- 主要面向外部 AI 代理控制已有应用
- **与当前需求的关系不明确**

**两种可能理解**:

**理解 A**: InspiraDB 自身增加 CLI 能力
- 已有基础 CLI (`src/cli/demo.js`)
- 扩展方向:
  - 增加 `tag-organization` 命令
  - 支持与 OpenClaw 的管道通信
  - 实现 headless 模式运行

**理解 B**: OpenClaw 使用 OpenCLI 控制 InspiraDB
- OpenClaw 通过 OpenCLI 的 CDP 连接到 InspiraDB
- OpenClaw 触发标签组织功能
- 获取结果并生成 Gene

**建议**: 采用理解 A，在现有 CLI 基础上扩展，更简洁可控。

**工作量评估**: 小 (3-5 天)

### 3. 定期梳理与用户确认 - ✅ 可行

**实现方案**:
1. **手动触发**: 在 UI 增加 "启动标签协同进化" 按钮
2. **数据准备**: InspiraDB 导出当前标签系统状态
3. **OpenClaw 分析**: 调用本地 OpenClaw 服务进行分析
4. **结果展示**: 复用现有的 `TagOrganizationPreview` 组件展示建议
5. **用户确认**: 用户选择接受/拒绝/修改每条建议
6. **应用变更**: 调用 `applyTagOrganizationPlan()` 执行

**关键文件修改**:
- `renderer/src/components/TagOrganizationPanel.jsx` - 新增协同进化入口
- `electron/main.js` - 新增 IPC 通道 `inspiradb:co-evolution-start`
- `src/core/inspiradb.js` - 新增 `startCoEvolution()` 方法

### 4. Gene 系统 - ✅ OpenClaw 负责

**职责划分**:
- **InspiraDB**: 向 OpenClaw 提供标签数据和用户反馈
- **OpenClaw**: 负责打包 Gene 并上传至 evoMap.ai

**InspiraDB 提供的反馈数据**:
```json
{
  "sessionId": "uuid",
  "timestamp": "2026-03-29T10:00:00Z",
  "context": {
    "initialTagCount": 45,
    "initialParentCount": 6,
    "finalTagCount": 38,
    "finalParentCount": 5
  },
  "decisions": [
    {
      "suggestionId": "s-001",
      "operation": { "kind": "merge", "from": "简约", "to": "极简" },
      "confidence": 0.95,
      "userApproved": true,
      "imagesAffected": 23
    }
  ],
  "userRating": 4,
  "userComments": "大部分建议合理"
}
```

**注意**: Gene 的具体格式和 evoMap.ai 的 API 由 OpenClaw 定义和实现，InspiraDB 只负责提供原始数据。

---

## 推荐实现计划

### Phase 1: 标签数量策略优化 (Week 1, Day 1-2)
**目标**: 实现动态一级标签数量限制策略

**修改文件**:
- `src/core/tag-organization.js` - 更新 `MAX_ORGANIZATION_NEW_PARENT_COUNT` 为动态计算函数

**实现方案**:
```javascript
// src/core/tag-organization.js

/**
 * 计算一级标签数量上限
 * 策略：50个二级标签时最多5个一级，200个二级时最多10个一级
 * 使用线性插值：maxParent = MIN(15, MAX(3, ceil(childCount / 20)))
 *
 * @param {number} childTagCount - 当前二级标签数量
 * @returns {number} - 允许的最大一级标签数量
 */
export function calculateMaxParentTags(childTagCount) {
  const MIN_PARENT_TAGS = 3;
  const MAX_PARENT_TAGS = 15;
  const RATIO = 20; // 20:1 的比例

  const calculated = Math.ceil(childTagCount / RATIO);
  return Math.min(MAX_PARENT_TAGS, Math.max(MIN_PARENT_TAGS, calculated));
}

/**
 * 计算可新增的一级标签数量
 * @param {number} currentParentCount - 当前一级标签数量
 * @param {number} childTagCount - 当前二级标签数量
 * @returns {number} - 允许新增的一级标签数量
 */
export function calculateAllowedNewParentTags(currentParentCount, childTagCount) {
  const maxAllowed = calculateMaxParentTags(childTagCount);
  return Math.max(0, maxAllowed - currentParentCount);
}

// 导出用于 AI prompt
export function getParentTagLimitDescription(childTagCount) {
  const max = calculateMaxParentTags(childTagCount);
  return `当前有 ${childTagCount} 个二级标签，一级标签上限为 ${max} 个`;
}
```

**AI Prompt 更新** (`src/services/zhipu-ai.js`):
系统提示词中的限制规则需要更新为：
```javascript
`11. 一级标签数量动态限制：${getParentTagLimitDescription(childCount)}，最多可新增 ${allowedNew} 个一级标签`
```

### Phase 2: OpenClaw 通信层 (Week 1, Day 3-5)
**目标**: 建立 InspiraDB 与 OpenClaw 的通信通道

**新增文件**:
- `src/services/openclaw-client.js` - OpenClaw HTTP/stdio 客户端
- `src/core/co-evolution.js` - 协同进化核心逻辑

**修改文件**:
- `src/core/inspiradb.js` - 集成 co-evolution 方法
- `electron/main.js` - 新增 IPC handlers

**关键代码示例**:
```javascript
// src/services/openclaw-client.js
export class OpenClawClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'http://localhost:8765';
  }

  async analyzeTags(tagTree, imageTagStats, constraints) {
    const response = await fetch(`${this.endpoint}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze-tags',
        payload: { tagTree, imageTagStats, constraints }
      })
    });
    return response.json();
  }

  async sendFeedback(sessionId, decisions, userRating, comments) {
    const response = await fetch(`${this.endpoint}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'feedback',
        payload: { sessionId, decisions, userRating, userComments: comments }
      })
    });
    return response.json();
  }
}
// 注意：Gene 打包和 evoMap.ai 上传由 OpenClaw 负责
```

### Phase 3: UI 交互层 (Week 2)
**目标**: 实现用户触发、展示、确认流程

**新增组件**:
- `renderer/src/components/CoEvolutionButton.jsx` - 触发按钮
- `renderer/src/components/CoEvolutionPanel.jsx` - 结果展示

**修改组件**:
- `renderer/src/components/AppSidebar.jsx` - 添加入口
- `renderer/src/store/useAppStore.js` - 新增协同进化状态

### Phase 4: 用户反馈系统 (Week 3) ✅ 已完成
**目标**: 实现用户反馈收集并传递给 OpenClaw

**新增功能** (在 `src/core/co-evolution.js`):
- `buildFeedbackPayload()` - 构建反馈数据结构
- `queueFeedbackForRetry()` - 反馈失败时入队
- `getPendingFeedbackQueue()` - 获取待发送队列
- `removeFeedbackFromQueue()` - 移除已发送反馈
- `cleanupOldFeedback()` - 清理过期数据

**修改文件**:
- `src/core/inspiradb.js`:
  - `sendCoEvolutionFeedback()` - 发送反馈（支持离线队列）
  - `retryPendingFeedback()` - 重试失败反馈
  - 启动时自动重试队列中的反馈
  - 每 5 分钟定时重试

**特性**:
- 离线支持：OpenClaw 不可用时，反馈存入 SQLite 队列
- 自动重试：启动后 30 秒及每 5 分钟尝试重试
- 最大重试：每条反馈最多重试 3 次
- 数据保留：最多保留 50 条最近反馈，7 天后自动清理

**验证方案**:
1. 启动 OpenClaw 模拟服务
2. 在 InspiraDB 点击 "协同进化"
3. 确认建议展示正确
4. 应用部分建议
5. 验证用户反馈数据正确发送给 OpenClaw

---

## 风险与建议

### 技术风险
1. **OpenClaw 未启动**: 需要优雅降级，提示用户启动 OpenClaw
2. **OpenClaw 通信失败**: 实现重试机制和离线队列
3. **大量标签处理**: 可能需要分页或流式处理

### 架构建议
1. **与现有标签组织功能融合**: 复用 `previewTagOrganization` 的 UI 组件
2. **配置化设计**: OpenClaw 端点、evoMap.ai 凭证通过 `.env` 配置
3. **可插拔架构**: 支持未来替换 OpenClaw 为其他 AI 代理

---

## 潜在盲点审查

### 1. 会话管理
**问题**: 用户触发分析后，如果在确认前关闭应用怎么办？
**建议**:
- 将 OpenClaw 的会话 ID 和建议数据暂存到 SQLite
- 应用启动时检查是否有未完成的协同进化会话

### 2. 并发控制
**问题**: 用户能否在已有待确认建议时再次触发分析？
**建议**:
- 限制同时只能有一个进行中的协同进化会话
- 或支持多个会话，但需要明确的会话标识

### 3. 回滚机制
**问题**: 用户应用建议后发现效果不佳，能否撤销？
**建议**:
- 在 `applyTagOrganizationPlan` 前备份当前标签状态
- 提供"撤销上次整理"功能（有时间限制，如24小时内）

### 4. OpenClaw 服务发现
**问题**: OpenClaw 的端口号可能变化，如何发现服务？
**建议**:
- 支持 mDNS 服务发现
- 或允许用户在设置中配置 OpenClaw 端点

### 5. 版本兼容性
**问题**: OpenClaw API 升级后，旧版 InspiraDB 如何处理？
**建议**:
- API 请求中包含 `inspiradb-version` header
- OpenClaw 返回 `min-supported-version` 提示升级

### 6. 数据隐私
**问题**: 标签数据是否包含敏感信息？
**建议**:
- 明确告知用户哪些数据会发送给 OpenClaw
- 支持"本地模式"，仅使用内置 AI 进行标签整理

### 7. 冲突解决
**问题**: 用户手动修改标签时，与 OpenClaw 建议冲突怎么办？
**建议**:
- 建议列表中显示"已过期"标记
- 应用前再次验证建议的有效性

### 8. 性能考虑
**问题**: 大量标签数据传输是否会导致性能问题？
**建议**:
- 标签树超过 1000 个时，只传输概要统计信息
- 支持分页或增量更新

---

## 总结

| 组件 | 可行性 | 工作量 | 优先级 |
|------|--------|--------|--------|
| 动态标签数量策略 | ✅ 高 | 小 | P0 | ✅ 已完成 |
| OpenClaw 通信 | ✅ 高 | 中等 | P0 | ✅ 已完成 |
| CLI 化扩展 | ✅ 高 | 小 | P1 | ✅ 已完成 |
| 标签协同进化 | ✅ 高 | 中等 | P0 | ✅ 已完成 |
| 用户反馈系统 | ✅ 高 | 小 | P1 | ✅ 已完成 |

**推荐路径**:
1. **Week 1**: Phase 1 (动态标签策略) + Phase 2 (OpenClaw 通信) ✅
2. **Week 2**: Phase 3 (UI 交互层)，建立完整的协同进化闭环 ✅
3. **Week 3**: Phase 4 (用户反馈系统)，将反馈传递给 OpenClaw ✅

---

## 实现总结

### 已完成的功能

#### 1. 动态一级标签数量策略
- **文件**: `src/core/tag-organization.js`, `src/core/inspiradb.js`, `src/services/zhipu-ai.js`
- **规则**: 50个二级标签→最多5个一级，200个→最多10个，保底3个，封顶15个
- **公式**: `maxParentTags = MIN(15, MAX(3, ceil(childCount / 20)))`

#### 2. OpenClaw 通信层
- **文件**: `src/services/openclaw-client.js`, `src/core/co-evolution.js`, `src/core/inspiradb.js`
- **功能**:
  - HTTP API 通信 (`/analyze`, `/feedback`, `/health`)
  - 错误处理和超时控制
  - 请求/响应数据验证

#### 3. UI 交互层
- **文件**: `renderer/src/components/CoEvolutionPanel.jsx`, `renderer/src/store/useAppStore.js`, `renderer/src/App.jsx`, `renderer/src/components/AppSidebar.jsx`
- **界面**:
  - 侧边栏「协同进化」入口按钮
  - 启动面板（介绍 + 开始按钮）
  - 分析中加载状态
  - 建议列表（复选框、置信度、操作描述）
  - 用户评分和评论输入

#### 4. 用户反馈系统
- **文件**: `src/core/co-evolution.js`, `src/core/inspiradb.js`
- **特性**:
  - 离线队列（SQLite 存储）
  - 自动重试（启动后30秒 + 每5分钟）
  - 最大重试3次
  - 数据保留策略（50条/7天）

#### 5. CLI 扩展
- **文件**: `src/cli/demo.js`
- **命令**:
  - `openclaw-status` - 检查服务状态
  - `co-evolution-start` - 启动分析
  - `co-evolution-apply` - 交互式应用建议

### 数据流

```
用户点击「协同进化」
  ↓
InspiraDB 检查 OpenClaw 状态
  ↓
构建上下文（标签树、统计、约束）
  ↓
调用 OpenClaw /analyze
  ↓
展示建议列表（置信度可视化）
  ↓
用户选择建议 + 评分/评论
  ↓
应用选中建议
  ↓
发送反馈给 OpenClaw（离线队列支持）
  ↓
OpenClaw 打包 Gene 上传 evoMap.ai
```

### 待 OpenClaw 实现

OpenClaw 需要提供的 API:

```javascript
// POST /health
// Response: { status: 'ok' }

// POST /analyze
// Request: { action: 'analyze-tags', payload: { tagTree, imageTagStats, constraints } }
// Response: { sessionId, suggestions: [{ id, kind, confidence, reason, ... }] }

// POST /feedback
// Request: { action: 'feedback', payload: { sessionId, decisions, userRating, userComments } }
// Response: { success: true }
```

OpenClaw 职责:
1. 接收 InspiraDB 的标签数据
2. 分析并生成优化建议
3. 接收用户反馈
4. 打包 Gene 并上传 evoMap.ai

### 测试建议

1. **OpenClaw 未启动**: 应显示友好提示「OpenClaw 服务不可用，请确保 OpenClaw 已启动」
2. **网络中断**: 反馈应存入队列，恢复后自动重试
3. **大量标签**: 验证动态限制是否正确计算
4. **取消操作**: 应能中断分析或清空选择

**待澄清问题**:
1. OpenClaw 的具体 API 规范（端口、认证、请求/响应格式）
2. 是否需要支持本地模式（不依赖 OpenClaw）
3. CLI 化的具体需求场景
