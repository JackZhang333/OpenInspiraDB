# InspiraDB 项目架构分析文档

> 生成日期：2026-03-19

## 1. 项目概述

**InspiraDB** 是一款面向独立设计师的桌面端灵感素材管理应用，基于 Electron + React 构建，专为 macOS 平台设计。

### 1.1 核心功能
- 📁 本地图片素材库管理（最多 5 万张图片）
- 🤖 AI 自动分析图片内容（标签、描述）
- 🔍 语义搜索 + 标签筛选
- 📤 批量导入/导出

### 1.2 项目基本信息
| 属性 | 值 |
|------|-----|
| 应用名称 | InspiraDB |
| 版本 | 0.2.0 |
| 应用 ID | `com.inspiradb.desktop` |
| 目标平台 | macOS 13.0+ |
| 分发方式 | DMG / Mac App Store |

---

## 2. 技术栈

### 2.1 核心技术

```
┌─────────────────────────────────────────────────────────────┐
│                        运行环境                              │
│  Node.js >= 24 (原生 ES Modules)                             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│  桌面框架     │    │    前端框架       │    │   构建工具    │
│  Electron    │    │  React 18.3.1    │    │  Vite 7.1.7  │
│  v37.5.0     │    │  + Zustand       │    │              │
└──────────────┘    └──────────────────┘    └──────────────┘
```

### 2.2 完整依赖清单

#### 运行时依赖
| 依赖 | 版本 | 用途 |
|------|------|------|
| `electron` | ^37.5.0 | 桌面应用框架 |
| `react` | ^18.3.1 | UI 框架 |
| `react-dom` | ^18.3.1 | DOM 渲染 |
| `zustand` | ^5.0.8 | 状态管理 |
| `lucide-react` | ^0.552.0 | 图标库 |

#### 样式与 UI
| 依赖 | 版本 | 用途 |
|------|------|------|
| `tailwindcss` | ^3.4.18 | CSS 工具类 |
| `class-variance-authority` | ^0.7.1 | 组件变体 |
| `clsx` | ^2.1.1 | 条件类名 |
| `tailwind-merge` | ^3.3.1 | 类名合并 |

#### 系统能力
| 模块 | 来源 | 用途 |
|------|------|------|
| `node:sqlite` | Node.js 内置 | SQLite 数据库 (DatabaseSync) |
| `node:fs` | Node.js 内置 | 文件系统操作 |
| `node:crypto` | Node.js 内置 | UUID 生成 |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                         表现层 (Renderer)                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    React 18 + Vite                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │  │
│  │  │  AppSidebar  │  │   Library    │  │   DetailPanel    │    │  │
│  │  │   (侧边栏)    │  │  Workspace   │  │    (详情面板)     │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘    │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │              useAppStore (Zustand)                      │  │  │
│  │  │         状态管理：搜索、导入、详情、设置                 │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (electron contextBridge)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         桥接层 (Preload)                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      preload.js                                │  │
│  │    安全暴露 API：window.inspira.*                              │  │
│  │    - invoke(channel, payload)                                  │  │
│  │    - onImportProgress(callback)                                │  │
│  │    - search(), importFolder(), exportImage() ...               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (ipcMain.handle)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         主进程 (Main)                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      main.js                                   │  │
│  │  - 窗口管理 (BrowserWindow)                                    │  │
│  │  - IPC 处理器注册                                              │  │
│  │  - 系统对话框 (dialog)                                         │  │
│  │  - 剪贴板操作 (clipboard, nativeImage)                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 直接调用
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        核心业务层 (Core)                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  InspiraDBApp                                  │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐       │  │
│  │  │  InspiraDB    │  │   ZhipuAI    │  │ AnalysisQueue │       │  │
│  │  │  (Database)   │  │   Service    │  │  (任务队列)    │       │  │
│  │  └───────────────┘  └──────────────┘  └───────────────┘       │  │
│  │                                                              │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐       │  │
│  │  │  TagStore     │  │    Files     │  │    Vector     │       │  │
│  │  │  (标签管理)    │  │   Utils      │  │    Utils      │       │  │
│  │  └───────────────┘  └──────────────┘  └───────────────┘       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         数据存储层 (Storage)                          │
│  ┌────────────────────┐  ┌──────────────────┐                        │
│  │   SQLite DB        │  │   File System    │                        │
│  │  (data/*.sqlite)   │  │ (library/,       │                        │
│  │                    │  │  thumbnails/)    │                        │
│  └────────────────────┘  └──────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. 数据库设计

### 4.1 数据库 Schema

```sql
-- 图片主表
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  original_file_name TEXT NOT NULL,
  original_file_ext TEXT,
  original_path TEXT,
  library_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  md5_hash TEXT UNIQUE NOTn NULL,
  width INTEGER,
  height INTEGER,
  analysis_status TEXT,  -- pending/analyzing/queued/ready/failed
  needs_embedding_refresh INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 图片描述
CREATE TABLE captions (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT,
  source TEXT,  -- ai/user
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 标签表（支持二级嵌套）
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  language TEXT DEFAULT 'zh',
  parent_id INTEGER,           -- 父标签ID（一级标签为NULL）
  level INTEGER DEFAULT 2,     -- 1=一级标签(父), 2=二级标签(子)
  sort_order INTEGER DEFAULT 0,
  is_system INTEGER DEFAULT 0, -- 1=系统标签，不可删除
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name, language)
);

-- 图片-标签关联
CREATE TABLE image_tags (
  image_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  source TEXT,  -- ai/user
  created_at TEXT,
  PRIMARY KEY (image_id, tag_id, source)
);

-- 向量嵌入 (用于语义搜索)
CREATE TABLE embeddings (
  image_id TEXT PRIMARY KEY,
  vector TEXT NOT NULL,  -- JSON array
  dimension INTEGER,
  model_provider TEXT,
  updated_at TEXT NOT NULL
);

-- 分析任务队列
CREATE TABLE analysis_jobs (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  job_type TEXT,  -- analyze_image/refresh_embedding
  status TEXT,    -- pending/processing/retrying/succeeded/failed
  retry_count INTEGER DEFAULT 0,
  max_retry_count INTEGER DEFAULT 3,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT
);

-- 应用设置
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY,
  cloud_analysis_enabled INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

---

## 5. 关键函数与模块

### 5.1 主进程 (electron/main.js)

| 函数/处理器 | 职责 | IPC Channel |
|-------------|------|-------------|
| `createMainWindow()` | 创建主窗口 (1520x940) | - |
| `createInspiraApp()` | 初始化核心应用实例 | - |
| `registerIpcHandlers()` | 注册所有 IPC 处理器 | - |
| `fileToDataUrl()` | 图片文件转 Data URL | - |
| Folder Import Handler | 处理文件夹导入 | `inspiradb:import-folder` |
| File Import Handler | 处理单文件导入 | `inspiradb:import-file` |
| Search Handler | 语义+标签搜索 | `inspiradb:search` |
| Export Handler | 导出图片 | `inspiradb:export-image(s)` |
| Copy Handler | 复制到剪贴板 | `inspiradb:copy-image` |
| Detail Handler | 获取图片详情 | `inspiradb:detail` |
| Update Handler | 更新元数据 | `inspiradb:update-caption/tags` |
| Reanalyze Handler | 重新 AI 分析 | `inspiradb:reanalyze` |
| Delete Handler | 删除图片 | `inspiradb:delete` |

### 5.2 核心应用类 (src/core/inspiradb.js)

| 方法 | 功能描述 |
|------|----------|
| `constructor(options)` | 初始化数据库、AI服务、任务队列 |
| `importFile(filePath)` | 导入单个图片文件 |
| `importFolder(folderPath, options)` | 批量导入文件夹 |
| `search(params)` | 语义搜索+标签筛选+分页 |
| `getImageDetail(imageId)` | 获取图片完整详情 |
| `updateImageCaption(imageId, content)` | 更新图片描述 |
| `updateImageTags(imageId, tagNames)` | 更新图片标签 |
| `exportImage(imageId, targetPath)` | 导出图片到指定路径 |
| `copyImageToClipboard(imageId)` | 复制图片到系统剪贴板 |
| `deleteImage(imageId)` | 删除图片及相关数据 |
| `rebuildAnalysis(imageId)` | 重新触发 AI 分析 |
| `getImageCount()` | 获取当前图片总数 |
| `ensureImportCapacity()` | 检查导入容量限制 |
| `waitForImportedImagesSettled()` | 等待导入图片分析完成 |
| `listTagTree()` | 获取标签树形结构（含图片计数） |
| `createTag(payload)` | 创建标签（支持一级/二级） |
| `updateTag(payload)` | 更新标签名称/父级 |
| `deleteTag(tagId)` | 删除标签（检查引用和子标签） |

### 5.3 AI 服务 (src/services/)

#### 模型配置 (src/model-config.js)
集中管理 AI 模型配置，开发者在此配置 API Key 和模型参数，而非 UI 暴露。
```javascript
function createModelConfig(overrides) {
  return {
    zhipu: {
      apiBase,           // API 基础地址
      apiKey,            // 从环境变量或硬编码
      visionModel,       // 视觉模型名称
      embeddingModel,    // 嵌入模型名称
      embeddingDimensions // 向量维度
    }
  };
}
```

#### TagStore (src/core/tag-store.js)
标签管理核心模块，支持二级嵌套标签结构。
```javascript
// 标签层级常量
TAG_LEVEL_PARENT = 1  // 一级标签（分类）
TAG_LEVEL_CHILD = 2   // 二级标签（具体标签）

// 主要函数
listParentTags(db)              // 获取所有一级标签
listTagTree(db, countByTagId)   // 获取标签树（含图片计数）
getTagById(db, tagId)           // 获取单个标签详情
ensureSecondaryTag(db, name, options)  // 确保二级标签存在
listEffectiveTagRecords(db, imageId)   // 获取图片的有效标签
```

#### AI Factory (ai-factory.js)
简化后的 AI 服务入口，直接委托给智谱 AI。
```javascript
class RoutedAiService {
  analyzeImage(id)     // 分析图片，生成标签和描述
  refreshEmbedding(id) // 刷新向量嵌入
  embedText(text)      // 文本向量化
}
```

#### Analysis Queue (analysis-queue.js)
```javascript
class AnalysisQueue {
  start()           // 启动队列处理循环
  stop()            // 停止队列
  recoverJobs()     // 恢复未完成的任务
  drain()           // 消费待处理任务
  processJob(job)   // 执行单个任务
  markJobSucceeded(job)
  markJobFailure(job, error)
}
```

### 5.4 前端组件 (renderer/src/components/)

#### TagManagerPanel (TagManagerPanel.jsx)
标签管理面板，精致打磨的二级嵌套标签管理组件。

**布局结构：**
- 头部："标签管理台"标题 + 英文副标题 + 简洁描述
- 搜索框：支持实时过滤，含清空按钮，placeholder 为"筛选一级分类或二级标签..."
- 新增分类：顶部通栏虚线按钮，简洁引导
- 卡片网格：每个一级分类独立卡片（柔和边框 + 微阴影）
- 底部：信息提示 + 取消/完成按钮

**文案细节：**
- 标题：标签管理台 / PRIMARY CATEGORY
- 副标题：在这里整理一级分类和二级标签，最后统一提交保存。
- 新增按钮：新增分类 → 输入框占位符"输入新的一级分类名称，例如：项目类型"
- 二级标签按钮：新增标签

**视觉细节：**
- 卡片：圆角 16px，边框 1px clay/15，悬停边框加深 + 微阴影
- 图标：40px 圆角方形，柔和背景色
- 编辑状态：moss/[0.06] 背景 + 细边框，非突兀色块
- 空状态：极简文案，图标 + 一句话引导
- 整体留白：px-8 大边距，通透呼吸感

**交互特性：**
- 内联编辑（柔和背景高亮）
- 内联删除确认（无 alert）
- 搜索高亮匹配文本
- Loading 状态反馈
- 字母排序二级标签
- 相对时间显示
- 系统标签保护

### 5.5 前端状态管理 (renderer/src/store/useAppStore.js)

| 方法 | 功能 |
|------|------|
| `init()` | 初始化应用，加载设置和搜索 |
| `runSearch()` / `refreshSearch()` | 执行搜索 |
| `loadMore()` | 加载更多结果（分页） |
| `selectTag(tagName)` / `clearTag()` | 标签筛选 |
| `importFolder()` / `importFile()` | 导入操作 |
| `selectImage(imageId)` | 选择图片查看详情 |
| `saveMetadata()` | 保存元数据修改 |
| `exportImage()` / `exportCurrentResultBatch()` | 导出 |
| `copyImage()` | 复制到剪贴板 |
| `rebuildAnalysis()` | 重新分析 |
| `deleteSelected()` | 删除选中图片 | (renderer/src/store/useAppStore.js)

| 方法 | 功能 |
|------|------|
| `init()` | 初始化应用，加载设置和搜索 |
| `runSearch()` / `refreshSearch()` | 执行搜索 |
| `loadMore()` | 加载更多结果（分页） |
| `selectTag(tagName)` / `clearTag()` | 标签筛选 |
| `importFolder()` / `importFile()` | 导入操作 |
| `selectImage(imageId)` | 选择图片查看详情 |
| `saveMetadata()` | 保存元数据修改 |
| `exportImage()` / `exportCurrentResultBatch()` | 导出 |
| `copyImage()` | 复制到剪贴板 |
| `rebuildAnalysis()` | 重新分析 |
| `deleteSelected()` | 删除选中图片 |

---

## 6. 逻辑流程图

### 6.1 图片导入流程

```mermaid
flowchart TD
    A[用户点击导入按钮] --> B{选择导入方式}
    B -->|文件夹| C[显示文件夹选择对话框]
    B -->|单文件| D[显示文件选择对话框]

    C --> E[遍历文件夹内图片]
    D --> F[读取单文件]

    E --> G[检查文件类型支持]
    F --> G

    G --> H{文件是否支持?}
    H -->|否| I[跳过文件]
    H -->|是| J[计算 MD5 哈希]

    J --> K{MD5 是否已存在?}
    K -->|是| L[标记为重复]
    K -->|否| M[复制文件到库目录]

    M --> N[生成缩略图占位]
    N --> O[写入数据库记录]
    O --> P[创建分析任务]

    P --> Q{批量导入?}
    Q -->|是| E
    Q -->|否| R[返回导入结果]

    I --> Q
    L --> Q

    R --> S[触发进度事件]
    S --> T[前端更新导入进度]
```

### 6.2 语义搜索流程

```mermaid
flowchart TD
    A[用户输入搜索词] --> B[构建搜索画像]
    B --> C[识别搜索意图]

    C --> D{是否纯标签搜索?}
    D -->|是| E[执行标签匹配]
    D -->|否| F[文本向量化]

    F --> G[查询向量数据库]
    G --> H[计算余弦相似度]

    E --> I[标签筛选]
    H --> J[语义排序]

    I --> K{有标签筛选?}
    J --> K

    K -->|是| L[应用标签过滤]
    K -->|否| M[综合排序]

    L --> M
    M --> N[应用权重评分]
    N --> O[分页返回结果]
    O --> P[前端渲染图片列表]
```

### 6.3 AI 分析流程

```mermaid
flowchart TD
    A[图片导入完成] --> B[创建 analysis_job 记录]
    B --> C[任务队列定时扫描]

    C --> D{有空闲槽位?}
    D -->|否| C
    D -->|是| E[获取待处理任务]

    E --> F[更新任务状态为 processing]
    F --> G[调用智谱 AI API]

    G --> H[发送图片分析请求]
    H --> I[接收标签和描述]
    J[发送文本嵌入请求]
    K[接收向量嵌入]

    I --> L[写入 captions 表]
    I --> M[写入 tags 表]
    I --> N[写入 image_tags 关联]
    K --> O[写入 embeddings 表]

    L --> P[更新图片状态为 ready]
    M --> P
    N --> P
    O --> P

    P --> Q[标记任务为 succeeded]

    H -->|失败| R[捕获错误]
    J -->|失败| R
    R --> S{重试次数 < 最大?}
    S -->|是| T[延迟后重新排队]
    S -->|否| U[标记任务为 failed]
```

---

## 7. 时序图

### 7.1 应用启动时序

```mermaid
sequenceDiagram
    participant User
    participant Main as Electron Main
    participant Renderer as React App
    participant Preload as Preload Script
    participant Core as InspiraDBApp
    participant DB as SQLite
    participant Queue as AnalysisQueue

    User->>Main: 启动应用
    Main->>Main: createMainWindow()
    Main->>Renderer: 加载窗口
    Renderer->>Preload: 加载预加载脚本
    Preload->>Renderer: 暴露 window.inspira API

    Main->>Core: createInspiraApp()
    Core->>DB: 初始化数据库连接
    DB-->>Core: 返回 Database 实例
    Core->>Core: 初始化 AI Service
    Core->>Queue: new AnalysisQueue()
    Core->>Queue: queue.start()
    Queue->>Queue: recoverJobs()
    Queue->>Queue: 启动定时扫描

    Renderer->>Renderer: useEffect(init)

    Renderer->>Preload: inspira.search()
    Preload->>Main: IPC: search
    Main->>Core: search()
    Core->>DB: 执行搜索查询
    DB-->>Core: 返回结果
    Core-->>Main: 返回结果
    Main-->>Preload: 返回结果
    Preload-->>Renderer: 返回结果
    Renderer->>Renderer: 渲染图片列表
```

### 7.2 图片导入时序

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Store as useAppStore
    participant Preload as Preload Script
    participant Main as Electron Main
    participant Core as InspiraDBApp
    participant DB as SQLite
    participant Queue as AnalysisQueue
    participant AI as AI Service

    User->>UI: 点击导入文件夹
    UI->>Store: importFolder()
    Store->>Preload: inspira.importFolder()
    Preload->>Main: IPC: import-folder
    Main->>Main: dialog.showOpenDialog()
    Main-->>Main: 返回文件夹路径

    Main->>Core: importFolder(path, onProgress)
    Core->>Core: walkFilesRecursive()
    Core->>Core: 过滤支持的图片类型

    loop 每个图片文件
        Core->>Core: md5File()
        Core->>DB: 检查 MD5 是否已存在
        DB-->>Core: 返回检查结果

        alt 文件不重复
            Core->>Core: copyFile() 到库目录
            Core->>Core: createThumbnailPlaceholder()
            Core->>DB: INSERT INTO images
            DB-->>Core: 返回 image_id
            Core->>DB: INSERT INTO analysis_jobs
            DB-->>Core: 返回 job_id
            Core->>Main: onProgress({imported})
            Main->>Preload: inspiradb:import-progress
            Preload->>Store: 触发进度回调
            Store->>UI: 更新导入进度条
        else 文件重复
            Core->>Core: 标记为重复
            Core->>Main: onProgress({duplicate})
        end
    end

    Core-->>Main: 返回导入统计
    Main-->>Preload: 返回结果
    Preload-->>Store: 返回结果
    Store->>Store: refreshSearch()

    Queue->>DB: 定时扫描待处理任务
    DB-->>Queue: 返回待处理任务
    Queue->>Queue: processJob()
    Queue->>Core: aiService.analyzeImage()
    Core->>AI: 调用 AI API
    AI-->>Core: 返回标签和描述
    Core->>DB: 写入 captions/tags/embeddings
    Queue->>DB: 更新任务状态为 succeeded
    Queue->>Queue: 更新图片状态为 ready
```

### 7.3 搜索与查看详情时序

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Store as useAppStore
    participant Preload as Preload Script
    participant Main as Electron Main
    participant Core as InspiraDBApp
    participant DB as SQLite

    User->>UI: 输入搜索词 "婴儿"
    UI->>Store: setQuery("婴儿")
    UI->>Store: runSearch()

    Store->>Preload: inspira.search({query, tags, page})
    Preload->>Main: IPC: search
    Main->>Core: search(params)

    Core->>Core: buildSearchProfile(query)
    Core->>Core: collectWeightedSearchTerms()

    alt 需要语义搜索
        Core->>Core: embedText(query)
        Core->>AI: 调用文本向量化
        AI-->>Core: 返回向量
        Core->>DB: 查询 embeddings 表
        DB-->>Core: 返回向量列表
        Core->>Core: cosineDistance() 计算相似度
    end

    Core->>DB: 执行综合搜索 SQL
    DB-->>Core: 返回搜索结果
    Core->>Core: 应用权重评分排序
    Core-->>Main: 返回 {items, total}
    Main->>Main: decorateSearchItems() 添加 Data URL
    Main-->>Preload: 返回结果
    Preload-->>Store: 返回结果
    Store->>UI: 渲染搜索结果列表

    User->>UI: 点击图片
    UI->>Store: selectImage(imageId)
    Store->>Preload: inspira.getImageDetail(imageId)
    Preload->>Main: IPC: detail
    Main->>Core: getImageDetail(imageId)
    Core->>DB: 查询图片元数据
    Core->>DB: 查询 captions
    Core->>DB: 查询 tags
    DB-->>Core: 返回完整详情
    Core-->>Main: 返回详情
    Main->>Main: decorateImageDetail() 添加 Data URL
    Main-->>Preload: 返回详情
    Preload-->>Store: 返回详情
    Store->>UI: 打开详情面板显示
```

---

## 8. 项目结构

```
littlePin_Mac/
├── build/                    # 构建资源
│   ├── entitlements.mas.plist
│   ├── icon.icns
│   └── icon-1024.png
├── data/                     # 数据文件
├── docs/                     # 文档
│   ├── mac-app-store.md
│   ├── DEPLOY-GUIDE.md
│   ├── privacy-policy.md
│   └── terms-of-use.md
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口
│   └── preload.js           # 预加载脚本
├── renderer/                 # 渲染进程 (前端)
│   ├── index.html
│   └── src/
│       ├── main.jsx         # React 入口
│       ├── App.jsx          # 主应用组件
│       ├── index.css        # 全局样式
│       ├── lib/
│       │   └── utils.js     # 工具函数
│       ├── store/
│       │   └── useAppStore.js  # Zustand 状态
│       └── components/      # UI 组件
│           ├── AppSidebar.jsx
│           ├── LibraryWorkspace.jsx
│           ├── DetailPanel.jsx
│           ├── GalleryCard.jsx
│           ├── TagManagerPanel.jsx  # 标签管理面板
│           └── ui/          # 基础 UI 组件
├── scripts/                  # 构建脚本
│   ├── build-mac-icon.mjs
│   ├── build-mas.mjs
│   ├── build-version.cjs
│   └── prepare-mas-upload.mjs
├── src/                      # 核心源代码
│   ├── index.js             # 导出入口
│   ├── cli/
│   │   └── demo.js          # CLI 调试入口
│   ├── core/                # 核心业务逻辑
│   │   ├── config.js        # 配置文件
│   │   ├── database.js      # 数据库操作
│   │   └── inspiradb.js     # 主应用类
│   ├── services/            # 服务层
│   │   ├── ai-factory.js    # AI 服务工厂
│   │   ├── ai-persistence.js # AI 持久化层
│   │   ├── analysis-queue.js # 分析队列
│   │   └── zhipu-ai.js      # 智谱 AI
│   ├── model-config.js      # AI 模型配置
│   └── utils/               # 工具函数
│       ├── embedding.js     # 向量嵌入
│       ├── files.js         # 文件操作
│       ├── hash.js          # 哈希计算
│       ├── logger.js        # 日志
│       ├── text.js          # 文本处理
│       ├── vector.js        # 向量计算
│       └── xmp.js           # XMP 元数据
├── test/                     # 测试文件
├── package.json              # 项目配置
├── vite.config.js            # Vite 配置
├── tailwind.config.js        # Tailwind 配置
└── electron-builder.mas*.cjs # MAS 构建配置
```

---

## 9. 关键技术决策

### 9.1 为什么选择 SQLite (Node.js 内置)?
- 零配置，无需额外安装
- 本地单用户场景性能足够
- 支持事务，数据一致性有保障
- Node.js 24+ 原生支持 `node:sqlite`

### 9.2 为什么使用 Zustand 而非 Redux?
- 轻量级，学习成本低
- 无需 Provider 包裹
- 支持异步操作简化
- TypeScript 支持友好

### 9.3 为什么采用 AI Factory 模式?
- 统一接口，业务层无感知
- 便于未来扩展多 AI 提供商

### 9.4 为什么采用集中式模型配置?
- 避免在 UI 暴露敏感配置
- 开发者统一配置，用户无感知
- 简化应用架构，减少设置面板

### 9.4 为什么需要 Analysis Queue?
- AI API 调用有速率限制
- 需要失败重试机制
- 应用重启后可恢复任务
- 支持并发控制

---

## 10. 安全考虑

| 方面 | 措施 |
|------|------|
| 数据库 | 本地 SQLite，不对外暴露 |
| IPC 通信 | 通过 preload 脚本严格控制暴露 API |
| 文件系统 | 仅在用户选择目录后操作 |
| 网络请求 | 仅用于 AI 分析，无数据上传 |

---

*文档结束*
