# 开发记录 - 2025年3月20日

## 本次会话关键操作汇总

---

## 1. 修复离线模式标签筛选问题

### 问题描述
离线模式下进行标签筛选时，如果搜索框有文本内容，报错：
```
Error invoking remote method 'inspiradb:search': TypeError: fetch failed
```

### 根本原因
`src/core/inspiradb.js` 的 `searchImages` 方法在 `query` 不为空时，会调用 `embedText()` 进行语义搜索，离线状态下网络请求失败。

### 修复方案
- **文件**: `src/core/inspiradb.js` (第 974-1031 行)
- **修改**: 添加 try-catch 捕获网络错误，降级为纯文本匹配搜索
- **行为**:
  - 在线: 语义搜索 + 文本匹配
  - 离线: 仅文本匹配（不报错）

---

## 2. 添加离线提示弹窗

### 问题描述
离线状态切换时未触发提醒弹窗。

### 修复内容
- **文件**: `renderer/src/App.jsx`
- **修改**:
  - 添加网络状态检测逻辑
  - 添加黄色离线提示条（琥珀色样式）
  - 显示内容："当前处于离线状态，普通搜索和标签筛选可正常使用，语义搜索和智能解析图片功能暂不可用"

### 触发逻辑
| 场景 | 行为 |
|------|------|
| 应用启动时已离线 | 立即显示提示 |
| 在线 → 离线 | 显示提示 |
| 离线 → 在线 | 隐藏提示 |

---

## 3. 修复分组图片数量计算逻辑（去重）

### 问题描述
同一图片关联多个标签时，分组（如"未分组"）的图片数量会重复计算。

**示例**:
- 标签A: 1张
- 标签B: 1张
- 标签C: 1张
- 未分组: **3张**（错误，应为1张）

### 修复方案
- **文件1**: `src/core/inspiradb.js` - `getFilterTags` 函数
  - 增加 `groupCounter` 计算
  - 使用 `groupImageIds` Map 对每个分组的图片 ID 进行去重

- **文件2**: `src/core/tag-store.js` - `listTagTree` 函数
  - 修改函数签名，增加 `groupCounter` 参数
  - 应用分组级别的不重复图片数量

### 修复效果
分组数量现在显示实际不重复图片数，而非简单累加子标签数量。

---

## 4. 合并 feature/nested-tags 分支

### 操作
```bash
# 合并分支到 main
git merge feature/nested-tags

# 删除本地分支
git branch -d feature/nested-tags
```

### 合并内容
- 嵌套标签（树形结构）
- AI 标签整理功能
- 国际化（i18n）支持
- 标签管理面板重构

### 相关提交
```
6fb214c 合并 feature/nested-tags 分支并保留离线提示功能
e0d921b 修复分组图片数量计算逻辑（去重处理）
```

---

## 5. GitHub Pages 迁移

### 迁移原因
原仓库（LittlePin）已设为私有，GitHub Pages 需要公开仓库才能访问。

### 新仓库
- **地址**: https://github.com/JackZhang333/inspiraDB
- **类型**: 公开仓库

### 网站地址
| 页面 | URL |
|------|-----|
| 主页 | https://jackzhang333.github.io/inspiraDB/ |
| 隐私政策 | https://jackzhang333.github.io/inspiraDB/privacy-policy.html |
| 使用条款 | https://jackzhang333.github.io/inspiraDB/terms-of-use.html |

### 迁移文件
- `index.html` - 官网首页
- `privacy-policy.html` - 隐私政策
- `terms-of-use.html` - 使用条款
- `.github/workflows/deploy-pages.yml` - 自动部署配置

### 原仓库清理
删除的文件：
- `.github/workflows/deploy-pages.yml`
- `docs/index.html`
- `docs/privacy-policy.html`
- `docs/terms-of-use.html`

---

## 6. 代码库清理

### 清理内容
- `release/` 目录 (1.8 GB) - 打包产物
- `dist/` 目录 (324 KB) - 构建输出
- `.DS_Store` 文件
- `.vite/` 缓存

### 结果
项目大小: 2.5 GB → 713 MB

### 添加的脚本
```json
"clean": "rm -rf release dist .vite renderer/.vite .DS_Store"
```

---

## 7. 意图集数据初始化

### 数据位置（MAS版本）
```
~/Library/Containers/com.inspiradb.desktop/Data/Library/Application Support/inspiradb/
```

### 初始化步骤
```bash
rm -rf "~/Library/Containers/com.inspiradb.desktop/Data/Library/Application Support/inspiradb"
```

---

## 修改的文件汇总

| 文件 | 修改内容 |
|------|----------|
| `src/core/inspiradb.js` | 离线搜索降级、分组计数去重 |
| `src/core/tag-store.js` | listTagTree 支持 groupCounter |
| `renderer/src/App.jsx` | 离线提示弹窗 |
| `electron/preload.js` | 网络状态检测方法 |
| `docs/DEPLOY-GUIDE.md` | 更新GitHub Pages地址 |
| `package.json` | 添加 clean 脚本 |

---

## 待办事项

- [ ] 在 App Store Connect 中更新隐私政策 URL
  - 新地址: https://jackzhang333.github.io/inspiraDB/privacy-policy.html
  - 支持 URL: https://jackzhang333.github.io/inspiraDB/

- [ ] 启用新仓库的 GitHub Pages
  - 设置 Source 为 "GitHub Actions"

- [ ] 重新构建并测试应用
  - 测试离线模式提示
  - 测试分组数量计算

---

## 相关链接

- 主仓库（私有）: https://github.com/JackZhang333/LittlePin
- Pages仓库（公开）: https://github.com/JackZhang333/inspiraDB
- 网站: https://jackzhang333.github.io/inspiraDB/

---

记录时间: 2025年3月20日
