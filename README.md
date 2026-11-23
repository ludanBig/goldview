# 金价视界

网站：https://ludanbig.github.io/goldview/

提供国际黄金 XAU/USD、上海黄金 Au99.99、品牌金店金价的参考行情和图表。静态数据保存在 `public/data/`，GitHub Pages 负责公开访问。

## 自动更新与部署

- `.github/workflows/refresh-data.yml`：独立负责抓取行情、校验并提交 JSON。GitHub UTC 每小时第 17、47 分尝试触发；50 分钟内已成功完整同步则跳过。手动运行时可选 `force` 强制刷新。
- `.github/workflows/pages.yml`：独立负责构建、测试、发布 GitHub Pages；代码推送或数据更新工作流显式触发时运行。数据同步不会因为 Pages 部署失败而回滚。
- 抓取生成新的数据提交后，刷新工作流通过 GitHub 的 `workflow_dispatch` 触发 Pages 工作流。GitHub Actions 内置令牌所产生的普通 push 不会自动触发另一个工作流。
- 首页显示最近一次抓取时间；图表显示各自市场的报价时间或交易日期。浏览器每五分钟检查一次同步状态并自动刷新当前视图。

GitHub 原生定时任务可能延迟或漏触发。可选用以下独立调度器提供第二条触发路径。

## 启用 Cloudflare Cron 外部调度器

`scheduler/cloudflare/` 只负责服务端发送 GitHub API 请求，不代理网站流量，不影响国内访客通过 GitHub Pages 访问。

1. 在 GitHub 创建 **Fine-grained personal access token**，仅选择 `ludanBig/goldview` 仓库，授予 **Actions: Read and write** 权限。不要将令牌写入 Git、网页代码或截图。
2. 在已登录 Cloudflare 的终端依次执行：

   ```bash
   cd scheduler/cloudflare
   npx wrangler login
   npx wrangler secret put GITHUB_DISPATCH_TOKEN
   npx wrangler deploy
   ```

   运行 `secret put` 时输入 GitHub Token，密钥由 Cloudflare 保存。
3. 检查 Cloudflare Workers 的 Cron Triggers 记录和 GitHub Actions 中 `Refresh gold price snapshots` 的 `workflow_dispatch` 运行。

Cloudflare 按 UTC 每小时第 07 分触发，GitHub 原生计划任务作为备用。首次部署 Cron Trigger 的传播可能需要数分钟，最多约 15 分钟。必须在自己的 Cloudflare 账号部署 Worker 并设置 Secret，此独立调度才会启动。

## 管理与排查

- GitHub Actions → **Refresh gold price snapshots** → Run workflow：手动采集，`force` 可跳过去重时间窗口。
- GitHub Actions → **Deploy goldview to Pages** → Run workflow：手动构建发布。
- `public/data/sync-status.json`：记录每次抓取运行时间、完整同步时间及各数据源成功状态。抓取成功不代表交易所产生了新报价。
- 本地执行 `node --test`、`npm run build`、`npm run update-data`；均使用 Node.js 内置功能。

参考报价不是成交价格；国际金价、上金所与品牌金店的更新时间各不相同。
