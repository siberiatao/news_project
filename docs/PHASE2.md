# Phase 2: Event Intelligence

Phase 2 moves the system from an article feed toward an event intelligence
pipeline.

## Features

- X API v2 recent-search adapter with pagination.
- Configurable X queries and key-account monitoring.
- X author, language, link, and public engagement metadata.
- Rule-based event clustering across RSS, RSSHub, and X.
- Multi-source confirmation bonus.
- X/news corroboration bonus.
- Event-level Markdown brief with multiple original links.
- Local source status, database statistics, search, and backfill windows.

## Event Clustering

The first clustering implementation is transparent and dependency-free. It
combines:

- Normalized title token overlap.
- Key-entity overlap.
- Topic-tag overlap.
- Maximum time distance.

Configuration lives in `config/interests.json`:

```json
{
  "clustering": {
    "similarityThreshold": 0.42,
    "maxHoursApart": 48,
    "minSharedTokens": 2
  }
}
```

This is intentionally conservative. It is easier to lower the threshold after
reviewing real false negatives than to recover trust after unrelated events are
merged.

## X Sources

X sources are disabled by default because they require an API Bearer Token and
may incur API usage costs.

Each X source supports:

- `query`
- `maxResults` from 10 to 100
- `maxPages`
- Normal source category, region, language, and reliability settings

Use:

```bash
node --experimental-strip-types src/cli.ts sources
```

to see whether X sources are enabled and whether credentials are available.

## Operations

Generate a normal 24-hour brief:

```bash
node --experimental-strip-types src/cli.ts run
```

Backfill or inspect a larger window:

```bash
node --experimental-strip-types src/cli.ts cluster --hours 72
node --experimental-strip-types src/cli.ts brief --hours 72
```

Search locally:

```bash
node --experimental-strip-types src/cli.ts search NVIDIA
```

The `--hours` value can be between 1 and 168.
