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

## HTTP Proxy

Node.js 24 can route built-in `fetch()` through an HTTP proxy when environment
proxy support is enabled. The RSS adapter's `curl` fallback also reads the same
proxy variables.

If the proxy is reachable at a normal network address:

```text
NODE_USE_ENV_PROXY=1
HTTP_PROXY=http://proxy.example.com:7890
HTTPS_PROXY=http://proxy.example.com:7890
NO_PROXY=localhost,127.0.0.1,::1
```

If Clash or another proxy runs on the same Linux server as Docker, do not use
`127.0.0.1` in the container. Use the host alias configured in
`docker-compose.yml`:

```text
NODE_USE_ENV_PROXY=1
HTTP_PROXY=http://host.docker.internal:7890
HTTPS_PROXY=http://host.docker.internal:7890
NO_PROXY=localhost,127.0.0.1,::1
```

Use Clash's HTTP or mixed port. A `socks5://` URL is not handled directly by
Node's built-in environment proxy support.

Test connectivity from the container:

```bash
docker compose run --rm news-brief ingest
```

To inspect the proxy variables seen inside the container:

```bash
docker compose run --rm --entrypoint env news-brief | grep -i proxy
```

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
