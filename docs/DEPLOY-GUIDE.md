# 部署指南 - GitHub Pages

本文档指导你如何将隐私政策和使用条款部署到 GitHub Pages。

---

## 📋 部署前准备

确保你已完成：
- [ ] 代码已推送到 GitHub 仓库
- [ ] 拥有仓库的管理员权限

---

## 🚀 自动部署方式（推荐）

我们已配置 GitHub Actions 自动部署。只需启用 GitHub Pages 即可。

### 步骤 1：启用 GitHub Pages

1. 打开你的 GitHub 仓库页面
   ```
   https://github.com/JackZhang333/LittlePin
   ```

2. 点击 **Settings**（设置）标签

3. 在左侧菜单中点击 **Pages**

4. 在 "Build and deployment" 部分：
   - **Source**：选择 "GitHub Actions"

5. 保存设置

### 步骤 2：触发部署

1. 提交任意更改到 `docs/` 目录，或
2. 手动触发部署：
   - 进入仓库的 **Actions** 标签
   - 选择 "Deploy to GitHub Pages" 工作流
   - 点击 "Run workflow"

### 步骤 3：验证部署

1. 等待部署完成（约 1-2 分钟）

2. 访问你的网站：
   ```
   https://jackzhang333.github.io/LittlePin
   ```

3. 确认以下页面可以访问：
   - 主页：https://jackzhang333.github.io/LittlePin
   - 隐私政策：https://jackzhang333.github.io/LittlePin/privacy-policy.html
   - 使用条款：https://jackzhang333.github.io/LittlePin/terms-of-use.html

---

## 🔧 配置自定义域名（可选）

如果你有自己的域名，可以配置自定义域名。

### 步骤 1：创建 CNAME 文件

在 `docs/` 目录下创建 `CNAME` 文件：

```bash
echo "yourdomain.com" > docs/CNAME
```

### 步骤 2：配置 DNS

在你的域名 DNS 管理后台添加记录：

| 类型 | 主机记录 | 记录值 |
|------|---------|--------|
| CNAME | www | jackzhang333.github.io |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

### 步骤 3：启用 HTTPS

1. 在 GitHub Pages 设置中
2. 勾选 "Enforce HTTPS"
3. 等待 SSL 证书颁发（约 1 小时）

---

## 📝 更新内容

### 更新隐私政策或使用条款

1. 编辑 `docs/privacy-policy.html` 或 `docs/terms-of-use.html`

2. 提交更改：
   ```bash
   git add docs/
   git commit -m "更新隐私政策"
   git push origin main
   ```

3. GitHub Actions 会自动部署更新

---

## 🔍 故障排除

### 问题：页面显示 404

**解决方案：**
1. 确认 GitHub Pages 已启用
2. 检查仓库是否为公开（Public）
3. 等待几分钟让部署完成
4. 检查 Actions 是否有错误

### 问题：样式没有加载

**解决方案：**
1. 检查 HTML 文件中的 CSS 路径
2. 清除浏览器缓存（Cmd + Shift + R）
3. 检查控制台是否有错误信息

### 问题：Actions 部署失败

**解决方案：**
1. 进入 Actions 标签查看错误日志
2. 确认 `.github/workflows/deploy-pages.yml` 文件存在
3. 检查仓库权限设置

---

## 📁 文件结构

```
docs/
├── index.html              # 主页（自动部署）
├── privacy-policy.html     # 隐私政策（自动部署）
├── terms-of-use.html       # 使用条款（自动部署）
└── DEPLOY-GUIDE.md        # 本文档

.github/
└── workflows/
    └── deploy-pages.yml   # GitHub Actions 配置
```

---

## 🌐 部署后的 URL

部署成功后，你的文档可以通过以下 URL 访问：

| 页面 | URL |
|------|-----|
| 主页 | `https://jackzhang333.github.io/LittlePin` |
| 隐私政策 | `https://jackzhang333.github.io/LittlePin/privacy-policy.html` |
| 使用条款 | `https://jackzhang333.github.io/LittlePin/terms-of-use.html` |

---

## ⚠️ 重要提醒

### 在 App Store Connect 中填写 URL

部署完成后，在 App Store Connect 中填写以下信息：

**隐私政策 URL：**
```
https://jackzhang333.github.io/LittlePin/privacy-policy.html
```

**支持 URL：**
```
https://jackzhang333.github.io/LittlePin
```

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 GitHub Pages 官方文档：https://pages.github.com/
2. 查看 GitHub Actions 日志
3. 确认仓库设置正确

---

## ✅ 部署检查清单

- [ ] GitHub Pages 已启用
- [ ] 选择了 "GitHub Actions" 作为 Source
- [ ] 网站可以正常访问
- [ ] 隐私政策页面显示正常
- [ ] 使用条款页面显示正常
- [ ] 已将 URL 填入 App Store Connect

---

**完成后，你的隐私政策和使用条款就可以公开访问了！** 🎉
