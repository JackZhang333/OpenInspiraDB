# InspiraDB V1-A

本仓库已落地为可运行的桌面应用骨架：

- Electron 主进程 + Preload IPC
- React + Vite 渲染层
- SQLite 本地存储
- 设计图导入、检索、详情编辑
- 智谱 AI 分析
- DMG / Mac App Store 打包基础配置

## 环境配置

在使用前需要配置智谱 AI API Key：

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
# 从 https://open.bigmodel.cn/usercenter/apikeys 获取
```

### 可配置的环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|-------|-----|-------|-----|
| `ZHIPU_API_KEY` | 是 | - | 智谱 AI API Key |
| `ZHIPU_API_BASE` | 否 | `https://open.bigmodel.cn/api/paas/v4` | API 基础地址 |
| `ZHIPU_VISION_MODEL` | 否 | `GLM-4V-Plus-0111` | 视觉模型 |
| `ZHIPU_REASONING_MODEL` | 否 | `GLM-4-Flash` | 推理模型 |
| `ZHIPU_EMBEDDING_MODEL` | 否 | `embedding-3` | 嵌入模型 |
| `ZHIPU_EMBEDDING_DIMENSIONS` | 否 | `256` | 嵌入维度 |

## 开发运行

```bash
npm install
npm run build
npm run electron:dev
```

说明：
- `npm run electron:dev` 会先构建渲染层，再启动 Electron
- 智谱 AI 配置通过环境变量或 `.env` 文件提供

## CLI 调试入口

```bash
npm start -- import-file /path/to/a.jpg
npm start -- search 海报 --tags=品牌,极简
```

## DMG 打包

```bash
npm run icon:mac
npm run dist:dmg
```

如果只是先验证打包链路，或者当前机器没有可用签名证书，可以使用：

```bash
npm run dist:dmg:unsigned
```

## Mac App Store 打包准备

```bash
npm run icon:mac
npm run dist:mas-dev
```

说明：
- 先放入 `build/icon-1024.png`，再执行 `npm run icon:mac` 生成 `build/icon.icns`
- `dist:mas-dev` 用于本机带开发签名验证

## 测试

```bash
npm test
```
## 清空测试数据
```
ls -la ~/Library/Application\ Support/inspiradb 2>/dev/null && rm -rf ~/Library/Application\ Support/inspiradb && echo "数据已清空" || echo "目录不存在"
pkill -f "electron" 2>/dev/null; rm -rf ~/Library/Application\ Support/inspiradb; echo "已停止应用并清空数据"
```