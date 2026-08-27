# 中科曙光 2026 届应届生集训素材 Demo

一个本机可运行的前后端一体 Demo：访客免登录一次上传 1–9 张图片或 1 个视频，原始文件总大小不超过 25MB；上传后自动生成一个代码，并可凭代码整组回查、修改。管理员可统一查看、编辑、删除和按连队导出 ZIP。连队支持一连至十六连，最新真实投稿会优先成为相册封面，点击后可浏览该连队全部内容。

图片支持 JPEG、PNG、WebP、GIF、AVIF 和 BMP；视频支持 MP4、MOV 和 WebM。

图片上传时由浏览器额外生成不超过 2MB 的 WebP 展示图和最长边 720px 的 WebP 缩略图，三者同时保存到 R2。相册放大浏览使用展示图，列表使用缩略图，管理员导出仍使用原图；GIF 保留原始动画，仅生成首帧缩略图。历史投稿没有派生图片时会自动回退原图。视频不做浏览器转码，限制为 25MB。

在线演示：[sugon-training-2026.pages.dev](https://sugon-training-2026.pages.dev)

## 本机运行

```bash
npm install
npm run dev:pages
```

- 上传页面：http://localhost:3000/
- 管理后台：http://localhost:3000/admin
- 本机演示管理员：`admin` / `demo2026`

`npm run dev` 仅启动静态前端热更新；`npm run dev:pages` 会同时启动 Pages Functions、D1 和 R2。本机数据保存在项目的 `.wrangler/` 目录。管理员配置位于已忽略版本控制的 `.dev.vars`；配置样例见 `.dev.vars.example`。

## 验证

```bash
npm test
npm run build
```

## Cloudflare 发布

项目使用 Cloudflare Pages 承载静态 React 前端，Pages Functions 提供同域 API，并直接绑定现有 D1 数据库和 R2 素材存储：

```bash
npm run deploy:cf
```

静态资源由 Pages CDN 分发；上传、查询、相册和管理员接口位于 `functions/api/[[path]].ts`。线上管理员账号、密码和会话密钥使用 Cloudflare Pages Secret 配置，不写入仓库。
