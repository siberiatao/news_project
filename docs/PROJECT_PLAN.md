# Personal News Intelligence System Project Plan

## 1. Project Positioning

Build a personal news intelligence system that helps one reader follow important
developments across sources, topics, companies, people, and time. The first-class
product is the morning briefing, not a generic feed.

Primary goals:

- Continuously collect selected high-quality sources.
- Normalize article metadata and short summaries.
- Deduplicate repeated reports across sources.
- Cluster related reports into events and story threads.
- Score items against personal domains of interest.
- Generate a concise daily Markdown briefing.
- Preserve source attribution and original links.
- Keep the system maintainable enough to evolve from MVP to production.

Non-goals for the first version:

- Becoming a generic RSS reader.
- Becoming a full social network or public news portal.
- Replacing original publishers or bypassing paywalls.
- Supporting every possible source format from day one.
- Building complex personalization before basic aggregation quality is proven.

## 2. Product Assumptions To Validate

These assumptions should be checked against the original conversation notes and early user feedback:

- A generated daily brief is more valuable than a raw information stream.
- Source quality, dedupe, ranking, and personal relevance matter more than broad crawling.
- Chinese and English sources both matter, so language handling should not be hard-coded to one locale.
- The first release can start with a curated source list and RSS/RSSHub before X and paid sources.

Validated input from product discussion:

- Target user: personal briefing for a technically and financially oriented reader.
- Core domains: global headlines, IT/AI/internet, finance/macro/markets, semiconductors/supply chain/geopolitical technology, X/key people.
- MVP source types: RSS, official feeds, RSSHub.
- Deferred source types: X API, paid or semi-open publisher feeds, delivery integrations.
- Compliance posture: store and display title, summary, metadata, and links; do not bypass paywalls.

## 3. MVP Scope

The MVP should prove the daily briefing loop:

1. Ingest articles from a curated set of sources.
2. Extract normalized metadata: title, url, source, author when available, publish time, language, topic tags, and content excerpt.
3. Deduplicate by canonical URL and title hash.
4. Tag domains and key entities.
5. Rank items by personal importance.
6. Generate a Markdown daily brief.
7. Store ingestion status and failures for debugging.

Recommended MVP interfaces:

- CLI commands for ingestion and brief generation.
- Markdown brief archive.
- Later web dashboard for sources, latest articles, and generated briefs.

## 4. Suggested Architecture

Use a local modular monolith first. The project can split services later after
ingestion, ranking, and brief quality stabilize.

Suggested components:

- `sources`: one adapter per source type, such as RSS, RSSHub, X API, web scrape, or manual import.
- `ingest`: scheduled pulling and raw item persistence.
- `normalize`: title cleanup, canonical URLs, time normalization, entities, tickers, companies, countries, keywords.
- `cluster`: URL/title dedupe first, embedding/event clustering later.
- `rank`: personal domain scoring and source reliability.
- `brief`: Markdown generation now, LLM generation later.
- `delivery`: email, Telegram, WeCom, Feishu, Slack, Notion, or web dashboard later.

Initial technology direction:

- Runtime: Node.js / TypeScript.
- Database: SQLite first, PostgreSQL later if needed.
- Scheduler: cron or node-cron later; manual CLI commands first.
- Feed parsing: RSS/Atom adapter with no external dependency in the first prototype.
- X: adapter placeholder until API keys are available.
- UI: defer full dashboard until daily brief generation is useful.
- AI features: keep provider boundaries abstract so summaries/clustering can be swapped.

## 5. Data Model Draft

Core entities:

- `Source`: name, type, homepage, feed URL/API config, language, region, category, reliability, enabled status.
- `FetchJob`: source, status, started/finished timestamps, error, item count.
- `Article`: source, canonical URL, title, author, published time, fetched time, language, summary, hash, tags, score, score reasons, metadata.
- `Story`: title, summary, topic tags, first/last seen timestamps, status.
- `StoryArticle`: story/article relationship, relevance score, chronology position.
- `Brief`: time window, generated path/content, generated timestamp.

Important indexes:

- Unique canonical URL.
- Article content hash or similarity hash.
- Published time and source.
- Story last updated time.
- Full-text title/body/summary search.

## 6. Ingestion And Processing Flow

Baseline flow:

1. Scheduler or CLI selects enabled sources.
2. Fetcher retrieves feed/API/page data.
3. Parser extracts article candidates.
4. Normalizer canonicalizes URLs and metadata.
5. Deduplicator skips existing or near-duplicate content.
6. Article storage writes normalized records.
7. Processor assigns topic tags, key entities, and score.
8. Brief generator selects and groups high-signal items.
9. Later story updater creates or updates event clusters.

Failure handling:

- Store fetch and parse errors with source/job context.
- Retry transient failures with backoff.
- Keep partial success when one source item fails.
- Expose source health in admin views.

## 7. AI Feature Boundaries

AI can be useful, but should not be the only thing making the platform work.

Candidate AI features:

- Article summary.
- Story-level multi-source summary.
- Topic tagging.
- Related story clustering via embeddings.
- Bias/source perspective comparison.
- Timeline extraction.

Guardrails:

- Always link to original articles.
- Mark generated summaries clearly in UI.
- Store model/provider/version for generated outputs.
- Avoid copying full publisher content into user-facing views unless rights allow it.
- Cache outputs and support regeneration.

## 8. Delivery Milestones

Phase 0: Project foundation

- Confirm product brief.
- Initialize repository and MVP structure.
- Create SQLite schema.
- Add source and interest config.

Phase 1: Ingestion and brief prototype

- Add source config.
- Fetch RSS/API sources.
- Normalize and store articles.
- Add ingestion logs.
- Generate Markdown daily brief.

Phase 2: Reader and delivery MVP

- Add simple dashboard.
- Add source/article/brief views.
- Add Telegram or email delivery.
- Add scheduled morning run.

Phase 3: Story intelligence and X

- Completed in Phase 2 foundation: X recent search, transparent event
  clustering, multi-source scoring, and event-level briefs.
- Next: tune clustering against real data.
- Next: add story evolution and timeline state.
- Later: optional embedding clustering and LLM synthesis.

Phase 4: Hardening

- Improve source reliability.
- Add observability.
- Add admin controls.
- Add tests around ingestion, parsing, and clustering.

## 9. Risks And Decisions

Key risks:

- Copyright and redistribution boundaries for article content.
- RSSHub and non-RSS source fragility.
- Duplicate and near-duplicate clustering quality.
- Summary hallucination or poor attribution.
- Cost and latency if AI processing runs on every article.

Early decisions to make:

- Whether RSSHub is self-hosted from day one or configured later.
- Which delivery channel comes first.
- Whether LLM summaries are needed before the rule-based brief is useful.
- How aggressively to store article content versus metadata and excerpts.

## 10. Immediate Next Actions

1. Implement RSS/RSSHub ingestion.
2. Store articles in SQLite.
3. Add URL/title dedupe.
4. Generate daily Markdown brief.
5. Add X API and delivery after the first useful brief exists.
