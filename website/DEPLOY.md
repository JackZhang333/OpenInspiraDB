# InspiraDB Website - Cloudflare Pages 部署指南

## 构建输出

网站已构建到 `dist/` 目录，包含以下内容：
- 英文版本: `/en/` 目录
- 中文版本: `/zh/` 目录
- 根目录: 自动重定向到英文版本
- SEO文件: `sitemap.xml`, `robots.txt`

## Cloudflare Pages 部署步骤

### 方法一：通过 Cloudflare Dashboard (推荐)

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 登录你的账户

2. **创建 Pages 项目**
   - 点击左侧菜单 "Pages"
   - 点击 "Create a project"
   - 选择 "Upload assets" (直接上传)

3. **上传网站文件**
   - 项目名: `inspiradb`
   - 上传 `dist/` 目录下的所有文件
   - 构建命令: (留空，因为已经预构建)
   - 输出目录: `/`

4. **配置自定义域名**
   - 在项目中点击 "Custom domains"
   - 添加域名: `www.inspiradb.com`
   - 按照提示配置 DNS 记录

5. **配置重定向规则** (可选)
   在 Pages 项目中添加 `_redirects` 文件：
   ```
   / /en/ 302
   ```

### 方法二：通过 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **部署网站**
   ```bash
   cd dist
   wrangler pages deploy . --project-name=inspiradb
   ```

4. **配置自定义域名**
   ```bash
   wrangler pages domain add inspiradb www.inspiradb.com
   ```

## DNS 配置

在你的域名注册商或 Cloudflare DNS 中添加以下记录：

```
Type: CNAME
Name: www
Target: inspiradb.pages.dev
Proxy status: Proxied (橙色云朵)
```

## 部署后验证

1. 访问 https://www.inspiradb.com 检查英文版本
2. 访问 https://www.inspiradb.com/zh/ 检查中文版本
3. 验证语言切换功能
4. 检查所有页面链接
5. 验证 SEO 标签 (使用 Google Rich Results Test)

## 后续更新

更新网站时：
1. 运行 `npm run build` 重新构建
2. 重新上传 `dist/` 目录的文件
3. 或使用 Git 集成自动部署

## 技术栈

- Next.js 16 + React + TypeScript
- Tailwind CSS + shadcn/ui
- 静态导出 (Static Export)
- 自定义 i18n 实现 (支持 EN/ZH)
