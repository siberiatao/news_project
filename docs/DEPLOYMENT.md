# Deployment

本项目采用两个互不耦合的运行角色：

- `news-brief`：由 cron、Hermes 或 openclaw 定时触发的一次性采集任务。
- `dashboard`：常驻 Web 服务，读取同一个 SQLite 数据库和 HTML 日报目录。

## Server Setup

```bash
git clone git@github.com:siberiatao/news_project.git
cd news_project
cp .env.example .env
docker compose build
```

先运行一次完整任务：

```bash
docker compose run --rm news-brief run
```

启动 Dashboard：

```bash
docker compose up -d dashboard
```

默认地址为 `http://SERVER_IP:8787`。检查服务：

```bash
curl http://127.0.0.1:8787/health
docker compose logs --tail=100 dashboard
```

## Daily Scheduling

Hermes/openclaw 或 cron 每天执行：

```bash
docker compose -f /path/to/news_project/docker-compose.yml run --rm news-brief run
```

需要启用交付通道时改为：

```bash
docker compose -f /path/to/news_project/docker-compose.yml run --rm news-brief run --deliver
```

任务应关注非零退出码。采集和生成的数据持久化在宿主机 `./data`。

## Bilingual Model

模型增强是可选项。编辑 `.env`：

```text
ENRICHMENT_API_KEY=...
ENRICHMENT_BASE_URL=https://api.openai.com/v1
ENRICHMENT_MODEL=gpt-4.1-mini
ENRICHMENT_TIMEOUT_MS=30000
```

支持兼容 OpenAI `/chat/completions` 的云端或本地服务。未配置、超时或返回异常时，
系统自动使用规则式中英双语内容，采集任务不会因此失败。

## HTTP Proxy

Node.js 24 的内置 `fetch()` 需要 `NODE_USE_ENV_PROXY=1` 才会读取代理变量。
RSS adapter 的 `curl` fallback 也使用相同变量。

代理在普通网络地址：

```text
NODE_USE_ENV_PROXY=1
HTTP_PROXY=http://proxy.example.com:7890
HTTPS_PROXY=http://proxy.example.com:7890
NO_PROXY=localhost,127.0.0.1,::1
```

代理运行在 Docker 宿主机：

```text
NODE_USE_ENV_PROXY=1
HTTP_PROXY=http://host.docker.internal:7890
HTTPS_PROXY=http://host.docker.internal:7890
NO_PROXY=localhost,127.0.0.1,::1
```

使用 Clash HTTP 或 mixed 端口。Node 环境代理不直接处理 `socks5://`。

## Optional Lark Delivery

```text
LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/...
LARK_WEBHOOK_SECRET=
LARK_DRY_RUN=0
```

`LARK_DRY_RUN=1` 只打印 payload，不发送。

## Update

```bash
git pull
docker compose build
docker compose run --rm news-brief run
docker compose up -d dashboard
```

## Useful Commands

```bash
docker compose run --rm news-brief sources
docker compose run --rm news-brief stats
docker compose run --rm news-brief search NVIDIA
docker compose run --rm news-brief cluster --hours 72
docker compose run --rm news-brief brief --hours 72
docker compose ps
```
