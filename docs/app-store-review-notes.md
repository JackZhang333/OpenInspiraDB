# Mac App Store 审核备注

> 用于 App Store Connect "审核信息" 字段

---

## 测试账号

**无需登录**，所有功能开箱即用。

---

## 审核备注（中文）

```
【应用简介】
意图集是一款面向设计师和创意工作者的本地图片管理工具，结合 AI 技术自动分析图片内容并支持语义搜索。

【AI 功能说明】
- AI 分析功能由第三方服务（智谱 AI）提供
- 图片仅在分析时上传至智谱 API，分析结果和原始图片均存储在用户本地设备
- 我们不在任何服务器上存储用户图片或数据

【功能测试指南】
1. 导入图片：点击侧边栏"导入文件夹"或"导入图片"按钮
2. 查看 AI 分析：导入后等待几秒，点击图片打开详情面板查看 AI 生成的描述和标签
3. 语义搜索：在顶部搜索框输入描述性文字（如"海滩日落"、"科技产品"）
4. 标签筛选：点击侧边栏任意标签进行筛选
5. 导出图片：在详情面板点击"导出"按钮

【数据存储说明】
- 所有图片数据存储在本地：~/Library/Application Support/InspiraDB/
- 支持离线使用，无需持续网络连接
- AI 分析需要网络连接调用第三方 API

【性能限制】
- 当前版本支持最多 5 万张图片
- 超出限制时会提示用户联系开发者扩容

【联系信息】
如有任何问题，请联系：hey@yituji.cn
```

---

## 审核备注（英文）

```
【App Description】
InspiraDB is a local image management tool for designers and creative professionals, featuring AI-powered content analysis and semantic search.

【AI Feature Notice】
- AI analysis is powered by third-party service (Zhipu AI)
- Images are only uploaded during analysis; both original images and analysis results are stored locally on user's device
- We do not store user images or data on any server

【Testing Guide】
1. Import: Click "Import Folder" or "Import Image" in sidebar
2. AI Analysis: Wait a few seconds after import, then click any image to view AI-generated description and tags in detail panel
3. Semantic Search: Enter descriptive text in search box (e.g., "beach sunset", "tech product")
4. Tag Filter: Click any tag in sidebar to filter
5. Export: Click "Export" button in detail panel

【Data Storage】
- All data stored locally at: ~/Library/Application Support/InspiraDB/
- Works offline without continuous internet connection
- AI analysis requires network to call third-party API

【Limitations】
- Current version supports up to 50,000 images
- Users will be prompted to contact developer for expansion when limit is reached

【Contact】
For any questions: hey@yituji.cn
```

---

## 简版审核备注（App Store Connect 字段限制用）

```
测试账号：无需登录

AI 功能说明：
- 使用第三方 AI 服务（智谱 AI）分析图片
- 仅分析时上传图片，数据均存储本地
- 不上传到开发者服务器

测试步骤：
1. 点击"导入文件夹"导入图片
2. 等待 AI 分析完成（几秒）
3. 在搜索框输入文字进行语义搜索
4. 点击侧边栏标签筛选
5. 导出图片测试

联系邮箱：hey@yituji.cn
```

---

## Short Version (English) - For App Store Connect Field Limits

```
Test Account: No login required

AI Feature Notice:
- Uses third-party AI service (Zhipu AI) for image analysis
- Images uploaded only during analysis, all data stored locally
- No data uploaded to developer servers

Testing Steps:
1. Click "Import Folder" to import images
2. Wait for AI analysis to complete (a few seconds)
3. Enter text in search box for semantic search
4. Click sidebar tags to filter
5. Test export functionality

Contact: hey@yituji.cn
```

---

## 常见问题预设回复

### 关于 AI 数据来源

**问题**: 请说明 AI 模型的数据来源和训练数据。

**回复模板**:
```
我们使用的 AI 服务由智谱 AI（https://open.bigmodel.cn）提供，具体模型为 GLM-4V-Plus 和 embedding-3。

根据智谱 AI 的隐私政策：
- 上传的图片仅用于实时分析，不会被保留
- 分析结果（文本描述和标签）返回后存储在用户本地设备
- 智谱 AI 不会将用户数据用于模型训练

我们的应用本身：
- 不训练任何 AI 模型
- 不在服务器存储用户数据
- 所有数据存储在用户本地
```

### 关于数据隐私

**问题**: 应用如何处理用户数据？

**回复模板**:
```
我们的应用采用"本地优先"架构：

1. 图片数据：
   - 存储在用户设备的 ~/Library/Application Support/InspiraDB/ 目录
   - 不会上传到任何服务器

2. AI 分析：
   - 仅在分析时临时上传图片到第三方 AI 服务
   - 分析结果（文字）返回后本地存储

3. 用户偏好：
   - 存储在本地 SQLite 数据库
   - 不包含任何个人身份信息

详细隐私政策请参见：[隐私政策 URL]
```

### 关于应用功能

**问题**: 应用的核心价值是什么？

**回复模板**:
```
意图集不仅是一个图片浏览器，它的核心价值在于：

1. AI 智能分析：
   - 自动识别图片内容
   - 生成描述性文字和相关标签
   - 无需用户手动整理

2. 语义搜索：
   - 支持自然语言搜索（如"阳光明媚的海滩"）
   - 基于 AI 理解而非简单标签匹配
   - 大大提高找图效率

3. 本地化管理：
   - 保护用户隐私
   - 无需订阅，一次购买永久使用
   - 离线可用

目标用户：设计师、摄影师、创意工作者
```

---

## 联系信息

| 项目 | 内容 |
|------|------|
| **联系邮箱** | hey@yituji.cn |
| **支持网站** | https://yituji.cn |
| **隐私政策** | https://yituji.cn/privacy |

---

## Common Questions (English)

### About AI Data Sources

**Question**: Please explain the AI model's data source and training data.

**Response Template**:
```
We use AI services provided by Zhipu AI (https://open.bigmodel.cn), specifically the GLM-4V-Plus and embedding-3 models.

According to Zhipu AI's privacy policy:
- Uploaded images are only used for real-time analysis and are not retained
- Analysis results (text descriptions and tags) are stored locally on the user's device after being returned
- Zhipu AI does not use user data for model training

Our application itself:
- Does not train any AI models
- Does not store user data on servers
- All data is stored locally on the user's device
```

### About Data Privacy

**Question**: How does the app handle user data?

**Response Template**:
```
Our app adopts a "local-first" architecture:

1. Image Data:
   - Stored in ~/Library/Application Support/InspiraDB/ on the user's device
   - Not uploaded to any servers

2. AI Analysis:
   - Images are temporarily uploaded to third-party AI services only during analysis
   - Analysis results (text) are stored locally after being returned

3. User Preferences:
   - Stored in local SQLite database
   - No personally identifiable information is collected

Detailed privacy policy: [Privacy Policy URL]
```

### About App Functionality

**Question**: What is the core value of this app?

**Response Template**:
```
InspiraDB is more than just an image browser. Its core values are:

1. AI-Powered Analysis:
   - Automatically recognizes image content
   - Generates descriptive text and relevant tags
   - No manual organization required from users

2. Semantic Search:
   - Supports natural language search (e.g., "sunny beach")
   - Based on AI understanding rather than simple tag matching
   - Greatly improves image discovery efficiency

3. Local Management:
   - Protects user privacy
   - No subscription required; one-time purchase for lifetime use
   - Works offline

Target users: Designers, photographers, creative professionals
```

---

*最后更新：2026-03-19*
