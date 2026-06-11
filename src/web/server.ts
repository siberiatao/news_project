import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { basename, resolve } from "node:path";
import { clusterArticles } from "../cluster/index.ts";
import { paths } from "../config.ts";
import type { NewsDatabase } from "../db/index.ts";
import { fallbackEnrichment, sectionZh } from "../enrich/index.ts";
import type { InterestsConfig, NewsSource, StoryCluster } from "../types.ts";

type DashboardOptions = {
  db: NewsDatabase;
  interests: InterestsConfig;
  sources: NewsSource[];
  port: number;
};

export async function startDashboard(options: DashboardOptions): Promise<void> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname === "/health") {
        return json(response, 200, { ok: true, stats: options.db.getStats() });
      }
      if (url.pathname.startsWith("/reports/")) {
        return serveReport(response, url.pathname.slice("/reports/".length));
      }
      if (url.pathname === "/api/search") {
        const query = url.searchParams.get("q")?.trim() ?? "";
        return json(response, 200, query ? options.db.searchArticles(query, 50) : []);
      }
      if (url.pathname !== "/") return text(response, 404, "Not found");

      const query = url.searchParams.get("q")?.trim() ?? "";
      const section = url.searchParams.get("section")?.trim() ?? "";
      const hours = clamp(Number.parseInt(url.searchParams.get("hours") ?? "72", 10), 1, 168);
      const windowEnd = new Date();
      const windowStart = new Date(windowEnd.getTime() - hours * 3600000);
      const articles = query
        ? options.db.searchArticles(query, 100)
        : options.db.listArticles(windowStart.toISOString(), windowEnd.toISOString(), options.interests.minScoreForBrief);
      let stories = clusterArticles(articles, options.interests);
      if (section) stories = stories.filter((story) => story.section === section);
      const page = renderDashboard({
        stories,
        sourceHealth: options.db.listSourceHealth(),
        briefs: options.db.listBriefs(),
        stats: options.db.getStats(),
        query,
        section,
        hours,
        interests: options.interests
      });
      return html(response, 200, page);
    } catch (error) {
      return text(response, 500, error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    const onError = (error: Error) => rejectReady(error);
    server.once("error", onError);
    server.listen(options.port, "0.0.0.0", () => {
      server.off("error", onError);
      resolveReady();
    });
  });
  console.log(`Dashboard: http://localhost:${options.port}`);
  await new Promise<void>((resolveClosed, reject) => {
    server.once("close", resolveClosed);
    server.once("error", reject);
  });
}

type DashboardView = {
  stories: StoryCluster[];
  sourceHealth: ReturnType<NewsDatabase["listSourceHealth"]>;
  briefs: ReturnType<NewsDatabase["listBriefs"]>;
  stats: ReturnType<NewsDatabase["getStats"]>;
  query: string;
  section: string;
  hours: number;
  interests: InterestsConfig;
};

export function renderDashboard(view: DashboardView): string {
  const enabled = view.sourceHealth.filter((source) => source.enabled);
  const healthy = enabled.filter((source) => source.status === "healthy").length;
  const cards = view.stories.slice(0, 50).map((story) => {
    const enrichment = fallbackEnrichment(story);
    const links = story.articles.slice(0, 4).map((article) =>
      `<a href="${escapeHtml(article.canonicalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(article.sourceName)}</a>`
    ).join("");
    return `<article class="event-row">
      <div class="event-score"><strong>${story.score}</strong><span>SCORE</span></div>
      <div class="event-body">
        <div class="event-meta"><span class="category">${escapeHtml(sectionZh(story.section))}</span><time>${escapeHtml(formatRelative(story.lastSeenAt))}</time></div>
        <h2>${escapeHtml(enrichment.titleZh)}</h2>
        <p class="event-en">${escapeHtml(story.title)}</p>
        <p>${escapeHtml(enrichment.summaryZh)}</p>
        <div class="event-bottom"><span>${story.sources.length} sources · ${story.articles.length} items</span><div>${links}</div></div>
      </div>
    </article>`;
  }).join("");

  const healthRows = view.sourceHealth.map((source) => `<tr>
    <td><span class="status ${source.status}"></span>${escapeHtml(source.name)}</td>
    <td>${escapeHtml(source.type.toUpperCase())}</td>
    <td>${source.lastItemCount ?? "-"}</td>
    <td>${source.lastFetchedAt ? escapeHtml(formatDate(source.lastFetchedAt)) : "Never"}</td>
  </tr>`).join("");
  const briefRows = view.briefs.map((brief) => {
    const name = basename(brief.path, ".md");
    return `<a class="brief-link" href="/reports/${escapeHtml(name)}.html" target="_blank">
      <strong>${escapeHtml(formatDate(brief.generatedAt))}</strong><span>${brief.itemCount} events</span>
    </a>`;
  }).join("");
  const filters = view.interests.sectionOrder.map((section) =>
    `<a class="${view.section === section ? "active" : ""}" href="/?section=${section}&hours=${view.hours}">${escapeHtml(sectionZh(section))}</a>`
  ).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>News Intelligence Dashboard</title><style>${dashboardCss}</style></head><body>
  <header class="topbar"><div class="logo">NI</div><div><b>News Intelligence</b><span>个人新闻情报系统</span></div><div class="sync">LOCAL · SQLITE</div></header>
  <main>
    <section class="page-title"><div><p>INTELLIGENCE OVERVIEW</p><h1>今日情报台</h1></div>
      <form><input name="q" value="${escapeHtml(view.query)}" placeholder="搜索公司、人物、主题..."><input type="hidden" name="hours" value="${view.hours}"><button>搜索</button></form>
    </section>
    <section class="metrics">
      <div><strong>${view.stories.length}</strong><span>当前事件</span></div><div><strong>${view.stats.articles}</strong><span>累计文章</span></div>
      <div><strong>${healthy}/${enabled.length}</strong><span>健康来源</span></div><div><strong>${view.hours}h</strong><span>观察窗口</span></div>
    </section>
    <nav class="filters"><a href="/?hours=${view.hours}" class="${view.section ? "" : "active"}">全部</a>${filters}</nav>
    <div class="workspace">
      <section class="feed"><header><h2>事件流</h2><span>${view.query ? `搜索：${escapeHtml(view.query)}` : "按重要性排序"}</span></header>
        ${cards || '<p class="empty">当前条件下没有事件。</p>'}
      </section>
      <aside>
        <section class="side-panel"><header><h3>来源健康</h3><span>${healthy} healthy</span></header><table><tbody>${healthRows}</tbody></table></section>
        <section class="side-panel"><header><h3>历史简报</h3><span>HTML</span></header><div class="briefs">${briefRows || '<p class="empty">尚未生成简报。</p>'}</div></section>
      </aside>
    </div>
  </main></body></html>`;
}

async function serveReport(response: ServerResponse, filename: string): Promise<void> {
  const safeName = basename(filename);
  if (!safeName.endsWith(".html")) return text(response, 400, "Only HTML reports are available");
  const path = resolve(paths.briefsDir, safeName);
  if (!path.startsWith(paths.briefsDir)) return text(response, 403, "Forbidden");
  await stat(path);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  createReadStream(path).pipe(response);
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function text(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatRelative(value: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  return hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char] ?? char);
}

const dashboardCss = `
:root{--ink:#172025;--muted:#6c777d;--line:#d9dfe1;--paper:#f3f5f3;--panel:#fff;--red:#cf4339;--green:#16786e;--yellow:#d9a72e}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,"Noto Sans SC","PingFang SC",Arial,sans-serif;letter-spacing:0}.topbar{height:62px;display:flex;align-items:center;gap:12px;padding:0 28px;background:#172025;color:#fff}.logo{width:34px;height:34px;display:grid;place-items:center;background:var(--red);font-weight:900}.topbar b{display:block;font-size:14px}.topbar span{font-size:10px;color:#aab3b6}.sync{margin-left:auto;font-size:10px;color:#96a3a7}
main{max-width:1440px;margin:auto;padding:30px 28px}.page-title{display:flex;justify-content:space-between;align-items:end;padding-bottom:24px}.page-title p{font-size:10px;font-weight:800;color:var(--red)}h1{font-family:Georgia,"Songti SC",serif;font-size:40px;margin:5px 0}.page-title form{display:flex;width:min(480px,45vw)}input{width:100%;border:1px solid var(--line);border-right:0;padding:12px 14px;background:#fff;font-size:13px}button{border:0;background:var(--ink);color:#fff;padding:0 22px;font-weight:700}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);background:var(--panel);border:1px solid var(--line)}.metrics div{padding:20px 24px;border-right:1px solid var(--line)}.metrics div:last-child{border:0}.metrics strong{display:block;font-family:Georgia,serif;font-size:29px}.metrics span{font-size:11px;color:var(--muted)}
.filters{display:flex;gap:8px;overflow:auto;padding:18px 0}.filters a{text-decoration:none;color:var(--ink);font-size:11px;font-weight:700;padding:8px 11px;border:1px solid var(--line);background:#fff;white-space:nowrap}.filters a.active{color:#fff;background:var(--red);border-color:var(--red)}
.workspace{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:22px}.feed,.side-panel{background:var(--panel);border:1px solid var(--line)}.feed>header,.side-panel>header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}.feed h2,.side-panel h3{font-size:13px;margin:0}.feed header span,.side-panel header span{font-size:10px;color:var(--muted)}
.event-row{display:grid;grid-template-columns:64px 1fr;border-bottom:1px solid var(--line)}.event-row:last-child{border-bottom:0}.event-score{padding:22px 10px;text-align:center;border-right:1px solid var(--line)}.event-score strong{display:block;font-family:Georgia,serif;font-size:22px}.event-score span{font-size:8px;color:var(--muted)}.event-body{padding:20px}.event-meta{display:flex;justify-content:space-between;font-size:10px}.category{color:var(--red);font-weight:800}.event-meta time{color:var(--muted)}.event-body h2{font-family:Georgia,"Songti SC",serif;font-size:21px;margin:10px 0 3px}.event-en{font-family:Georgia,serif;color:#526067;font-size:13px}.event-body>p:not(.event-en){font-size:13px;line-height:1.65}.event-bottom{display:flex;justify-content:space-between;gap:14px;font-size:10px;color:var(--muted)}.event-bottom div{display:flex;gap:9px}.event-bottom a{color:var(--green);font-weight:700}
aside{display:flex;flex-direction:column;gap:22px}.side-panel table{width:100%;border-collapse:collapse;font-size:11px}.side-panel td{padding:11px 14px;border-bottom:1px solid var(--line)}.side-panel td:first-child{font-weight:700}.status{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:8px;background:#9aa3a7}.status.healthy{background:var(--green)}.status.degraded{background:var(--red)}.brief-link{display:flex;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink);font-size:11px}.brief-link span{color:var(--muted)}.empty{padding:28px;color:var(--muted);font-size:12px}
@media(max-width:980px){.workspace{grid-template-columns:1fr}.page-title{align-items:stretch;flex-direction:column;gap:12px}.page-title form{width:100%}}@media(max-width:640px){main{padding:20px 14px}.metrics{grid-template-columns:1fr 1fr}.metrics div:nth-child(2){border-right:0}.workspace{gap:14px}.event-row{grid-template-columns:48px 1fr}.event-bottom{flex-direction:column}.topbar{padding:0 14px}}
`;
