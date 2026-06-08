# Personal News Intelligence System

This repository is the working home for a personal news intelligence system.

The first MVP focuses on RSS/RSSHub ingestion, SQLite storage, simple dedupe,
domain-aware ranking, and daily Markdown brief generation.

- [Product Brief](docs/PRODUCT_BRIEF.md)
- [Project Plan](docs/PROJECT_PLAN.md)
- [Deployment](docs/DEPLOYMENT.md)

## Quick Start

This prototype uses Node.js 24 built-ins only: TypeScript type stripping,
`fetch`, and `node:sqlite`.

```bash
node --experimental-strip-types src/cli.ts init-db
node --experimental-strip-types src/cli.ts ingest
node --experimental-strip-types src/cli.ts brief
node --experimental-strip-types src/cli.ts run
```

Generated files:

- SQLite database: `data/news.db`
- Markdown briefs: `data/briefs/`

## Commands

```bash
node --experimental-strip-types src/cli.ts init-db
node --experimental-strip-types src/cli.ts ingest
node --experimental-strip-types src/cli.ts brief
node --experimental-strip-types src/cli.ts run
node --experimental-strip-types src/cli.ts deliver
node --test --experimental-strip-types tests/*.test.ts
```

## Delivery

Copy `.env.example` to `.env` and set `LARK_WEBHOOK_URL`. Optional signing uses
`LARK_WEBHOOK_SECRET`. `run` sends to Lark when configured; without a webhook it
only generates the local Markdown brief.
