# 金价视界 · GitHub Pages 版本

提供国际现货黄金、上海黄金 Au99.99 和品牌金店黄金走势图。国际黄金默认使用站点缓存的简洁图表，也可切换 TradingView 专业图表。行情由 GitHub Actions 采集成静态 JSON，并通过 GitHub Pages 发布。

## 首次部署

1. 在 GitHub 创建公开仓库（建议名称 `goldview`），把本目录的所有文件上传至默认分支 `main`。
2. 进入仓库 `Settings → Pages → Build and deployment`，选择 `GitHub Actions`。
3. 进入 `Actions → Update gold prices and deploy Pages → Run workflow`，手动运行一次，之后自动按计划更新。
4. 页面地址通常是 `https://<账号>.github.io/<仓库名>/`。

## 数据更新

`.github/workflows/pages.yml` 在 UTC 每小时第 17 分安排行情更新，第 47 分安排备用检查。若最近 50 分钟内已完整更新，备用检查会跳过抓取。GitHub Actions 的定时事件可能延迟或漏触发，因此更新时刻不是严格保证。

国际黄金参考行情来自 Gold API、XAUS 等数据源，上海黄金 Au99.99 来自上海黄金交易所，品牌金店参考报价来自公开品牌历史页。脚本仅在下载、解析和校验成功后覆盖对应的 JSON；失败时保留最近一次成功的数据。

`public/data/sync-status.json` 记录最近一次执行时间、完整同步时间、数据源成功数量及各数据源最后成功抓取的时间。首页会显示国际黄金缓存的最近抓取时间；超过两小时或部分数据源抓取失败时提示更新异常。页面打开期间每五分钟检查一次同步状态，有新数据时刷新当前图表和价格卡片。

`npm run build` 生成 `public/index.html`；`npm run update-data` 抓取行情。可通过 `node --test` 运行数据解析测试。全部使用 Node.js 内置功能，无额外 npm 依赖。

提示：金店挂牌价可能因城市、门店、工费而不同。此网站用于行情信息展示，不作为成交价格依据。
