# 金价视界 · GitHub Pages

网站：https://ludanbig.github.io/goldview/

提供国际现货黄金 XAU/USD、上海黄金 Au99.99 及品牌金店黄金的参考行情与走势。国际黄金简洁图表基于网站保存的历史数据，专业图表使用 TradingView。

## 自动更新与发布

`.github/workflows/pages.yml` 使用 **GitHub Actions** 定时运行，一次工作流依次完成：

1. 构建静态站点并执行数据解析测试。
2. 抓取国际黄金、上海黄金和品牌金店参考行情，校验后写入 `public/data/*.json`。
3. 将有效的新快照提交到仓库 `main` 分支。
4. 构建并部署 GitHub Pages。

计划任务使用 UTC 每小时第 17 分和 47 分两个触发时间。距离上次完整同步不足 50 分钟时跳过重复抓取；在 GitHub Actions → **Update gold prices and deploy Pages** → **Run workflow** 可手动运行一次（手动运行不受该时间间隔限制）。

GitHub 定时任务可能延迟或漏触发，无法保证严格按小时执行。页面展示最近一次抓取时间，图表展示行情报价时间；交易所休市时，即便抓取成功，行情价格也可能不变。

## 日常维护

- 配置入口：`.github/workflows/pages.yml`
- 更新脚本：`scripts/update-data.mjs`
- 同步状态：`public/data/sync-status.json`
- 本地构建：`npm run build`
- 本地数据同步：`npm run update-data`
- 测试：`node --test`

所有行情仅供参考。品牌金店挂牌价可能因门店及加工费而不同，实际交易以供应方报价为准。
