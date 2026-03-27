# InspiraDB Website 实施文档

## 项目概述
- **产品**: InspiraDB - AI驱动的本地图片素材管理Mac应用
- **官网域名**: www.inspiradb.com
- **部署**: Cloudflare Pages
- **语言**: 英文为主，中文为辅

## 核心卖点 (Key Selling Points)
1. **AI智能打标** - 自动识别图片内容生成标签
2. **语义搜索** - 理解意图而非关键词匹配
3. **离线可用** - 无需网络，本地运行
4. **数据私有** - 图片永不上传，保护隐私
5. **大小脑协同** - 云端大模型学习进化 + 本地小模型极速响应

## 技术栈
- **框架**: Next.js 14 (Static Export)
- **部署**: Cloudflare Pages
- **样式**: Tailwind CSS + shadcn/ui
- **国际化**: next-intl
- **SEO**: next-sitemap, Schema.org

## 实施步骤

### Phase 1: 项目初始化
1. 初始化Next.js项目
2. 配置Tailwind CSS
3. 安装shadcn/ui
4. 配置next-intl国际化
5. 配置静态导出

### Phase 2: 基础架构
1. 创建布局组件 (Layout + Navigation)
2. 配置SEO组件 (Meta, OG, Schema)
3. 配置i18n路由
4. 创建全局样式

### Phase 3: 页面开发
1. 首页 (Hero + 4大卖点 + CTA)
2. Features页面 (AI打标/语义搜索/离线/私有/大小脑)
3. Use Cases页面 (设计师/摄影师/内容创作者)
4. Pricing页面
5. Download页面
6. Blog页面

### Phase 4: SEO优化
1. 生成Sitemap
2. 配置Robots.txt
3. 添加结构化数据
4. 优化Core Web Vitals

### Phase 5: 部署
1. 构建静态站点
2. 配置Cloudflare Pages
3. 绑定自定义域名
4. 配置Analytics

## 文件结构
```
website/
├── app/
│   ├── [locale]/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── features/
│   │   ├── use-cases/
│   │   ├── pricing/
│   │   ├── download/
│   │   └── blog/
│   └── globals.css
├── components/
│   ├── ui/
│   ├── sections/
│   └── seo/
├── lib/
├── content/
│   └── i18n/
├── public/
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## 关键词策略
- Primary: "AI image tagging mac", "semantic image search", "offline photo organizer"
- Long-tail: "local AI image analysis", "private photo management", "brain-inspired image organization"

## Cloudflare部署配置
```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
}
```

## 构建命令
```bash
npm run build
# 输出到 dist/ 目录
```
