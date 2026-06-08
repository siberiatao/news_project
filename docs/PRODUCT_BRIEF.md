# Product Brief

## Product Definition

This project is a personal news intelligence system, not a generic RSS reader.
Its core job is to continuously collect trusted sources, merge duplicate reports,
cluster events, score them against personal interests, and generate a concise
morning briefing.

The product should answer: "What changed since my last briefing, why does it
matter to me, and what should I keep watching next?"

## Daily Briefing Format

The primary output is a daily briefing generated at a fixed morning time.

Default time window:

- From the previous briefing generation time to the current briefing time.
- Example: `yesterday 08:00 - today 08:00`.

Sections:

- Global headlines
- IT / AI / internet
- Finance / macro / markets
- Semiconductors / supply chain / geopolitical technology
- X hotspots and key person updates
- Happening now: breaking news, developing stories, market moves, policy changes

Each item should contain:

- One-sentence summary
- Importance score
- Source list
- Original links
- Why it matters
- Follow-up watch points

## Source Strategy

MVP priority:

1. RSS and official feeds: stable, low cost, best first step.
2. RSSHub: useful for Chinese tech sites such as IT Home; prefer self-hosted
   RSSHub later to avoid relying on public instances.
3. X API: reserved for key accounts, keywords, company names, tickers, and
   breaking events once API access is available.
4. Paid or semi-open sources: use titles, summaries, and links only; do not
   bypass paywalls.

MVP source list:

- BBC
- IT Home via RSSHub
- TechCrunch
- The Verge
- Ars Technica
- Reuters
- CNBC
- Nikkei Asia
- EE Times

Second-stage sources:

- Bloomberg
- Financial Times
- Wall Street Journal
- The Economist
- MIT Technology Review
- IEEE Spectrum
- Semiconductor Engineering
- SemiAnalysis
- DIGITIMES
- SEMI / SIA

## Personal Interest Model

The first ranking model is rule-based and transparent.

Higher weights:

- IT / AI / internet
- Finance / macro / markets
- Semiconductors / supply chain / geopolitical technology

Important entities:

- NVIDIA
- AMD
- TSMC
- ASML
- Apple
- Microsoft
- OpenAI
- Tesla
- Meta
- Broadcom
- Intel

Ranking signals:

- Domain match
- Source reliability
- Multiple-source coverage
- Breaking or developing language
- Key company, ticker, person, or country mentions
- X velocity once X support is enabled

## MVP

First version:

- Node.js / TypeScript CLI
- SQLite local database
- RSS/RSSHub adapters
- Configurable source list
- URL and title-hash dedupe
- Rule-based normalization and tagging
- Rule-based importance scoring
- Markdown daily brief generation

Deferred:

- X API ingestion
- Telegram/email/Slack/Feishu delivery
- Web dashboard
- Embedding-based event clustering
- LLM-generated multi-source story summaries

## Principles

- Do not start with broad crawling.
- Keep source quality high before expanding coverage.
- Preserve original links and attribution.
- Make ranking explainable before making it clever.
- Generate a daily briefing worth reading before optimizing UI polish.
