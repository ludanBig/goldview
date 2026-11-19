# 金价视界 · GitHub Pages 版本

保留国际黄金、国内黄金、金店黄金三类走势图。国际黄金嵌入 TradingView；其余数据由 GitHub Actions 在服务器侧定时下载，生成静态 JSON，再通过 GitHub Pages 发布。

## 首次部署

1. 在 GitHub 创建公开仓库（建议名称 `goldview`），把本目录的所有文件上传至默认分支 `main`。
2. 进入仓库 `Settings → Pages → Build and deployment`，选择 `GitHub Actions`。
3. 进入 `Actions → Update gold prices and deploy Pages → Run workflow`，手动运行一次，之后自动按计划更新。
4. 页面地址通常是 `https://<账号>.github.io/<仓库名>/`。

## 数据更新

`.github/workflows/pages.yml` 每 4 小时尝试刷新一次。历史行情来自上海黄金交易所 Au99.99，金店参考报价来自黄金价格网的品牌历史页。脚本仅在下载、解析和校验成功后覆盖本地 JSON；失败时保留最近一次成功的数据。刷新频率取决于 GitHub Actions 实际执行时间及上游更新节奏，不属于实时行情服务。

`npm run build` 生成 `public/index.html`；`npm run update-data` 抓取行情。可通过 `node --test` 运行数据解析测试。全部使用 Node.js 内置功能，无额外 npm 依赖。

提示：金店挂牌价可能因城市、门店、工费而不同。此网站用于行情信息展示，不作为成交价格依据。
