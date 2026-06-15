# Personal News Intelligence System

一个面向个人使用的新闻情报系统：持续采集 RSS/RSSHub，聚合同一事件，
按兴趣排序，并生成中英双语 Markdown/HTML 日报和可搜索的 Web Dashboard。

当前版本：`v0.3.0`

- RSS/RSSHub 采集与 SQLite 存储
- URL 去重、事件聚类、多源加权排序
- 跨批次故事续接、发展状态与事件时间线
- 中英双语摘要、关注理由和后续观察点
- 适合桌面与手机阅读的 HTML 日报
- 本地搜索、来源健康状态、历史简报
- 可选 OpenAI-compatible 模型增强翻译与摘要
- Docker、Hermes/openclaw 调度与可选 Lark 交付

## Quick Start

需要 Node.js 24，无需安装 npm 依赖。

```bash
node --experimental-strip-types src/cli.ts init-db
node --experimental-strip-types src/cli.ts run
node --experimental-strip-types src/cli.ts serve
```

打开 [http://localhost:8787](http://localhost:8787) 查看 Dashboard。

生成文件：

- SQLite：`data/news.db`
- Markdown 日报：`data/briefs/brief-YYYY-MM-DD.md`
- HTML 日报：`data/briefs/brief-YYYY-MM-DD.html`

## Commands

```bash
node --experimental-strip-types src/cli.ts ingest
node --experimental-strip-types src/cli.ts cluster --hours 72
node --experimental-strip-types src/cli.ts brief --hours 72
node --experimental-strip-types src/cli.ts run
node --experimental-strip-types src/cli.ts serve --port 8787
node --experimental-strip-types src/cli.ts sources
node --experimental-strip-types src/cli.ts stats
node --experimental-strip-types src/cli.ts search NVIDIA
node --test --experimental-strip-types tests/*.test.ts
```

`run` 完成采集、聚类和日报生成。普通运行不会主动推送，只有
`run --deliver` 或 `deliver` 会调用已配置的交付通道。

## Bilingual Enrichment

不配置模型时，系统仍会生成规则式中文辅助说明，并保留英文原文，适合直接运行。
要获得更自然的翻译、摘要和观察点，在 `.env` 中配置兼容
`/chat/completions` 的服务：

```text
ENRICHMENT_API_KEY=...
ENRICHMENT_BASE_URL=https://api.openai.com/v1
ENRICHMENT_MODEL=gpt-4.1-mini
```

也可以指向本地兼容服务。模型调用失败时会自动退回规则式生成，不影响日报产出。

## Docker

```bash
cp .env.example .env
docker compose build
docker compose run --rm news-brief run
docker compose up -d dashboard
```

详细说明：

- [产品定义](docs/PRODUCT_BRIEF.md)
- [项目计划](docs/PROJECT_PLAN.md)
- [Phase 3 功能说明](docs/PHASE3.md)
- [Phase 4 故事演进](docs/PHASE4.md)
- [部署手册](docs/DEPLOYMENT.md)
