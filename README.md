# 中科曙光 2026 届应届生集训素材 Demo

一个本机可运行的前后端一体 Demo：访客免登录上传一份不超过 10MB 的照片或视频，上传后自动生成代码，并可凭代码回查、修改；管理员可统一查看、编辑、删除和按连队导出 ZIP。连队支持一连至十六连，并提供自动轮播的独立连队相册，真实上传会自动进入对应相册。

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
