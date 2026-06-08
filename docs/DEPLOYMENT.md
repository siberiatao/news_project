# Phase 1 Deployment

Phase 1 packages the personal news intelligence MVP as a Dockerized command
that can be triggered by a scheduler such as openclaw/hermes and pushed to Lark.

## Local Run

```bash
node --experimental-strip-types src/cli.ts run
```

`run` performs:

1. RSS/RSSHub ingestion.
2. SQLite upsert and dedupe.
3. Daily Markdown brief generation.
4. Lark delivery when `LARK_WEBHOOK_URL` is configured.

## Lark Setup

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

```text
LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/...
LARK_WEBHOOK_SECRET=optional-signing-secret
LARK_DRY_RUN=0
```

Use `LARK_DRY_RUN=1` to print the payload without sending it.

## Docker

Build:

```bash
docker compose build
```

Run once:

```bash
docker compose run --rm news-brief run
```

Generate without delivery:

```bash
docker compose run --rm news-brief brief
```

Generate and force delivery:

```bash
docker compose run --rm news-brief deliver
```

Persistent data is mounted at:

```text
./data:/app/data
```

## GitHub To Server

If the deployment server is not this Mac, publish the repository to GitHub first,
then pull it on the server.

On this Mac:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git branch -M main
git push -u origin main
```

On the deployment server:

```bash
git clone git@github.com:<owner>/<repo>.git
cd <repo>
cp .env.example .env
```

Edit `.env` on the server and set the real Lark webhook values. Do not commit
`.env`.

Then build and test:

```bash
docker compose build
docker compose run --rm news-brief run
```

## Hermes

For a scheduler such as openclaw/hermes, use a daily 08:00 job that runs one of:

```bash
docker compose -f /path/to/news_project/docker-compose.yml run --rm news-brief run
```

or, if Hermes runs inside an environment with the image already built:

```bash
docker run --rm --env-file /path/to/news_project/.env -v /path/to/news_project/data:/app/data personal-news-intelligence:phase1 run
```

The job should alert on non-zero exit codes. Lark webhook failures set a non-zero
exit code; missing `LARK_WEBHOOK_URL` skips delivery without failing so local
development remains convenient.
