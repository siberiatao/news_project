# Personal News Intelligence System

This repository is the working home for a personal news intelligence system.

The current Phase 2 build focuses on RSS/RSSHub and optional X ingestion,
SQLite storage, event clustering, multi-source ranking, local search, and
event-level Markdown brief generation.

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
node --experimental-strip-types src/cli.ts cluster
node --experimental-strip-types src/cli.ts sources
node --experimental-strip-types src/cli.ts stats
node --experimental-strip-types src/cli.ts search NVIDIA
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
node --experimental-strip-types src/cli.ts brief --hours 72
node --experimental-strip-types src/cli.ts run --deliver
node --test --experimental-strip-types tests/*.test.ts
```

## Delivery

Copy `.env.example` to `.env`. Delivery is explicit: normal `run` only ingests,
clusters, and generates the brief; use `run --deliver` or `deliver` when a
delivery adapter should run.

## X API

Set `X_BEARER_TOKEN` in `.env`, then enable one or both `type: "x"` entries in
`config/sources.json`. Check readiness with:

```bash
node --experimental-strip-types src/cli.ts sources
```

The adapter uses the official X API v2 recent search endpoint and stores public
engagement metrics for ranking.
