import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { paths } from "../config.ts";
import { sectionZh } from "../enrich/index.ts";
import type { EnrichedStory, InterestsConfig } from "../types.ts";

export type BriefResult = {
  path: string;
  htmlPath: string;
  markdown: string;
  html: string;
  itemCount: number;
  articleCount: number;
  windowStart: string;
  windowEnd: string;
};

export function selectReportStories<T extends StoryLike>(
  stories: T[],
  interests: InterestsConfig
): T[] {
  return interests.sectionOrder.flatMap((section) =>
    stories
      .filter((story) => story.section === section)
      .slice(0, interests.report.maxStoriesPerSection)
  );
}

export async function generateBrief(
  stories: EnrichedStory[],
  interests: InterestsConfig,
  windowStart: string,
  windowEnd: string
): Promise<BriefResult> {
  await mkdir(paths.briefsDir, { recursive: true });
  const markdown = renderMarkdown(stories, interests, windowStart, windowEnd);
  const html = renderHtml(stories, interests, windowStart, windowEnd);
  const date = windowEnd.slice(0, 10);
  const outputPath = resolve(paths.briefsDir, `brief-${date}.md`);
  const htmlPath = resolve(paths.briefsDir, `brief-${date}.html`);
  await Promise.all([
    writeFile(outputPath, markdown, "utf8"),
    writeFile(htmlPath, html, "utf8")
  ]);

  return {
    path: outputPath,
    htmlPath,
    markdown,
    html,
    itemCount: stories.length,
    articleCount: stories.reduce((count, story) => count + story.articles.length, 0),
    windowStart,
    windowEnd
  };
}

export function resolveBriefWindow(hours: number, end = new Date()): { windowStart: string; windowEnd: string } {
  return {
    windowEnd: end.toISOString(),
    windowStart: new Date(end.getTime() - hours * 60 * 60 * 1000).toISOString()
  };
}

export function renderMarkdown(
  stories: EnrichedStory[],
  interests: InterestsConfig,
  windowStart: string,
  windowEnd: string
): string {
  const grouped = groupBySection(stories);
  const articleCount = stories.reduce((count, story) => count + story.articles.length, 0);
  const lines = [
    "# Personal Intelligence Brief / 个人新闻情报简报",
    "",
    `> Window / 时间范围：${formatDate(windowStart, "zh-CN")} - ${formatDate(windowEnd, "zh-CN")}`,
    `> Stories / 事件：${stories.length} · Source items / 原始报道：${articleCount}`,
    ""
  ];

  if (stories.length === 0) {
    lines.push("No stories matched the current threshold. / 当前窗口没有达到阈值的事件。", "");
  }

  for (const section of interests.sectionOrder) {
    const sectionStories = grouped.get(section) ?? [];
    if (sectionStories.length === 0) continue;
    lines.push(`## ${sectionZh(section)} / ${interests.sections[section] ?? titleCase(section)}`, "");

    for (const story of sectionStories.slice(0, interests.report.maxStoriesPerSection)) {
      lines.push(`### ${story.enrichment.titleZh}`, `**${story.title}**`, "");
      lines.push(`- **中文摘要：** ${story.enrichment.summaryZh}`);
      lines.push(`- **English summary:** ${story.summary || story.title}`);
      lines.push(`- **重要性 / Importance：** ${story.score}/100`);
      lines.push(`- **事件状态 / Status：** ${statusZh(story.status)} / ${story.status.toUpperCase()}`);
      lines.push(`- **演进 / Evolution：** 第 ${story.updateCount} 次追踪，本轮新增 ${story.newArticleCount} 篇报道`);
      lines.push(`- **覆盖 / Coverage：** ${story.articles.length} item(s), ${story.sources.length} source(s)`);
      lines.push(`- **为何关注 / Why it matters：** ${story.enrichment.whyZh}`);
      lines.push(`- **后续观察 / Watch next：** ${story.enrichment.watchZh}`);
      lines.push(`- **来源 / Sources：** ${story.sources.join(", ")}`);
      for (const article of story.articles.slice(0, 5)) {
        lines.push(`  - [${article.sourceName}](${article.canonicalUrl})`);
      }
      if (story.status === "developing") {
        lines.push("- **时间线 / Timeline：**");
        if (story.previousLastSeenAt) {
          lines.push(`  - ${formatDate(story.previousLastSeenAt, "zh-CN", true)} · 上次已知进展 / Previous known update`);
        }
        for (const article of timelineArticles(story)) {
          lines.push(`  - ${formatDate(article.publishedAt, "zh-CN", true)} · ${article.sourceName} · ${article.title}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function renderHtml(
  stories: EnrichedStory[],
  interests: InterestsConfig,
  windowStart: string,
  windowEnd: string
): string {
  const grouped = groupBySection(stories);
  const articleCount = stories.reduce((count, story) => count + story.articles.length, 0);
  const nav = interests.sectionOrder
    .filter((section) => (grouped.get(section)?.length ?? 0) > 0)
    .map((section) => `<a href="#${escapeHtml(section)}">${escapeHtml(sectionZh(section))}</a>`)
    .join("");
  const sections = interests.sectionOrder.map((section) => {
    const items = grouped.get(section) ?? [];
    if (items.length === 0) return "";
    const storiesHtml = items
      .slice(0, interests.report.maxStoriesPerSection)
      .map((story, index) => renderStory(story, index + 1))
      .join("");
    return `<section id="${escapeHtml(section)}" class="report-section">
      <header class="section-header">
        <div><span class="section-index">${String(interests.sectionOrder.indexOf(section) + 1).padStart(2, "0")}</span></div>
        <div><h2>${escapeHtml(sectionZh(section))}</h2><p>${escapeHtml(interests.sections[section] ?? titleCase(section))}</p></div>
        <span class="section-count">${items.length} events</span>
      </header>
      <div class="story-list">${storiesHtml}</div>
    </section>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>个人新闻情报简报 · ${escapeHtml(windowEnd.slice(0, 10))}</title>
  <style>${reportCss}</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="brand"><span class="brand-mark">NI</span><span>NEWS INTELLIGENCE</span></div>
      <div class="edition">${escapeHtml(windowEnd.slice(0, 10))} · DAILY EDITION</div>
    </div>
  </header>
  <main>
    <section class="brief-intro">
      <p class="eyebrow">PERSONAL MORNING BRIEF / 个人早间情报</p>
      <h1>今天值得知道的<br><span>What matters today</span></h1>
      <div class="brief-meta">
        <div><strong>${stories.length}</strong><span>聚合事件<br>STORIES</span></div>
        <div><strong>${articleCount}</strong><span>原始报道<br>SOURCE ITEMS</span></div>
        <div><strong>${formatDate(windowStart, "zh-CN", true)}</strong><span>起始时间<br>FROM</span></div>
        <div><strong>${formatDate(windowEnd, "zh-CN", true)}</strong><span>截止时间<br>TO</span></div>
      </div>
    </section>
    <nav class="section-nav">${nav}</nav>
    ${stories.length === 0 ? '<p class="empty">当前窗口没有达到阈值的事件。</p>' : sections}
  </main>
  <footer><span>Generated by Personal News Intelligence</span><span>中英双语用于核对与学习，请以原文为准。</span></footer>
</body>
</html>`;
}

function renderStory(story: EnrichedStory, index: number): string {
  const links = story.articles.slice(0, 5).map((article) =>
    `<a href="${escapeAttribute(article.canonicalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(article.sourceName)}</a>`
  ).join("");
  const entities = story.entities.slice(0, 6).map((entity) => `<span>${escapeHtml(entity)}</span>`).join("");
  const previousUpdate = story.previousLastSeenAt
    ? `<div><time>${escapeHtml(formatDate(story.previousLastSeenAt, "zh-CN", true))}</time><span>HISTORY</span><p>上次已知进展 / Previous known update</p></div>`
    : "";
  const timeline = story.status === "developing"
    ? `<div class="timeline"><label>事件时间线 / TIMELINE</label>${previousUpdate}${timelineArticles(story).map((article) =>
      `<div><time>${escapeHtml(formatDate(article.publishedAt, "zh-CN", true))}</time><span>${escapeHtml(article.sourceName)}</span><p>${escapeHtml(article.title)}</p></div>`
    ).join("")}</div>`
    : "";
  return `<article class="story">
    <div class="story-rank">${String(index).padStart(2, "0")}</div>
    <div class="story-main">
      <div class="story-topline">
        <div class="score"><i style="width:${Math.min(100, story.score)}%"></i></div>
        <b>${story.score}</b><span>IMPORTANCE</span>
        <span class="story-status ${story.status}">${escapeHtml(statusZh(story.status))}</span>
        <span>TRACKED ${story.updateCount}× · +${story.newArticleCount} NEW</span>
        <time>${escapeHtml(relativeTime(story.lastSeenAt))}</time>
      </div>
      <h3>${escapeHtml(story.enrichment.titleZh)}</h3>
      <p class="title-en">${escapeHtml(story.title)}</p>
      <div class="bilingual">
        <div><label>中文摘要</label><p>${escapeHtml(story.enrichment.summaryZh)}</p></div>
        <div><label>ENGLISH SUMMARY</label><p>${escapeHtml(story.summary || story.title)}</p></div>
      </div>
      <div class="analysis">
        <div><label>为何关注</label><p>${escapeHtml(story.enrichment.whyZh)}</p></div>
        <div><label>后续观察</label><p>${escapeHtml(story.enrichment.watchZh)}</p></div>
      </div>
      ${timeline}
      <div class="story-footer">
        <div class="tags">${entities}</div>
        <div class="sources"><span>${story.sources.length} SOURCES</span>${links}</div>
      </div>
    </div>
  </article>`;
}

function timelineArticles(story: EnrichedStory): EnrichedStory["articles"] {
  return [...story.articles]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-4);
}

function statusZh(status: EnrichedStory["status"]): string {
  return status === "developing" ? "发展中" : status === "ongoing" ? "持续关注" : "新事件";
}

function groupBySection(stories: EnrichedStory[]): Map<string, EnrichedStory[]> {
  const grouped = new Map<string, EnrichedStory[]>();
  for (const story of stories) {
    const list = grouped.get(story.section) ?? [];
    list.push(story);
    grouped.set(story.section, list);
  }
  return grouped;
}

type StoryLike = Pick<EnrichedStory, "section">;

function formatDate(value: string, locale: string, short = false): string {
  return new Date(value).toLocaleString(locale, short
    ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char] ?? char);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

const reportCss = `
:root{--ink:#151a1d;--muted:#667077;--line:#d7dde0;--paper:#f7f8f6;--red:#d33b35;--teal:#0c7773;--yellow:#e7b83f}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,"Noto Sans SC","PingFang SC",Arial,sans-serif;letter-spacing:0}
.masthead{border-bottom:1px solid var(--ink);background:#fff}.masthead-inner{max-width:1180px;margin:auto;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;letter-spacing:.08em}
.brand{display:flex;gap:10px;align-items:center}.brand-mark{background:var(--ink);color:#fff;padding:7px 8px;letter-spacing:0}.edition{color:var(--muted)}
main{max-width:1180px;margin:auto;padding:0 24px}.brief-intro{padding:54px 0 36px;border-bottom:1px solid var(--ink)}.eyebrow{font-size:12px;font-weight:800;color:var(--red)}
h1{margin:12px 0 34px;font-family:Georgia,"Songti SC",serif;font-size:64px;line-height:1.02;font-weight:600}h1 span{font-size:.48em;color:var(--muted)}
.brief-meta{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.brief-meta div{display:flex;gap:14px;align-items:center;padding:18px 16px;border-right:1px solid var(--line)}.brief-meta div:last-child{border-right:0}.brief-meta strong{font-size:26px}.brief-meta span{font-size:10px;line-height:1.4;color:var(--muted);font-weight:700}
.section-nav{position:sticky;top:0;z-index:5;display:flex;gap:24px;overflow:auto;background:rgba(247,248,246,.96);border-bottom:1px solid var(--ink);padding:14px 0}.section-nav a{color:var(--ink);text-decoration:none;white-space:nowrap;font-size:13px;font-weight:700}
.report-section{padding:50px 0}.section-header{display:grid;grid-template-columns:48px 1fr auto;gap:18px;align-items:end;padding-bottom:18px;border-bottom:3px solid var(--ink)}.section-index{font-size:12px;color:var(--red);font-weight:800}.section-header h2{margin:0;font-family:Georgia,"Songti SC",serif;font-size:32px}.section-header p{margin:4px 0 0;color:var(--muted);font-size:12px;font-weight:700}.section-count{font-size:11px;color:var(--muted)}
.story{display:grid;grid-template-columns:48px 1fr;gap:18px;padding:30px 0;border-bottom:1px solid var(--line)}.story-rank{font-family:Georgia,serif;font-size:16px;color:var(--muted)}.story-topline{display:flex;align-items:center;gap:8px;font-size:9px;color:var(--muted);font-weight:800}.story-topline time{margin-left:auto}.score{width:90px;height:4px;background:#dfe3e4}.score i{display:block;height:100%;background:var(--red)}
.story-status{padding:4px 7px;border:1px solid var(--line);color:var(--ink)}.story-status.developing{background:var(--red);border-color:var(--red);color:#fff}.story-status.ongoing{border-color:var(--teal);color:var(--teal)}
.story h3{font-family:Georgia,"Songti SC",serif;font-size:29px;line-height:1.24;margin:14px 0 4px;max-width:850px}.title-en{font-family:Georgia,serif;font-size:17px;line-height:1.45;color:#4d575d;margin:0 0 24px}
.bilingual,.analysis{display:grid;grid-template-columns:1fr 1fr;gap:30px}.bilingual{padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.analysis{padding:20px 0}.bilingual div+div,.analysis div+div{border-left:1px solid var(--line);padding-left:30px}label{display:block;font-size:9px;color:var(--teal);font-weight:900;margin-bottom:8px}.bilingual p,.analysis p{margin:0;line-height:1.7;font-size:14px}
.timeline{margin:0 0 22px;padding:18px 20px;border-left:3px solid var(--red);background:#fff}.timeline>div{display:grid;grid-template-columns:110px 90px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:11px}.timeline>div:last-child{border-bottom:0}.timeline time,.timeline span{color:var(--muted)}.timeline p{margin:0;font-family:Georgia,serif}
.story-footer{display:flex;justify-content:space-between;gap:20px;align-items:center}.tags,.sources{display:flex;gap:8px;flex-wrap:wrap}.tags span{font-size:10px;padding:4px 7px;border:1px solid var(--line)}.sources span,.sources a{font-size:10px}.sources a{color:var(--teal);font-weight:700}
footer{max-width:1180px;margin:30px auto 0;padding:24px;border-top:1px solid var(--ink);display:flex;justify-content:space-between;color:var(--muted);font-size:11px}.empty{padding:60px 0}
@media(max-width:760px){h1{font-size:44px}.brief-meta{grid-template-columns:1fr 1fr}.brief-meta div:nth-child(2){border-right:0}.section-header{grid-template-columns:32px 1fr}.section-count{display:none}.story{grid-template-columns:30px 1fr}.story-topline{flex-wrap:wrap}.story-topline time{margin-left:0}.bilingual,.analysis{grid-template-columns:1fr}.bilingual div+div,.analysis div+div{border-left:0;border-top:1px solid var(--line);padding:18px 0 0}.timeline>div{grid-template-columns:1fr}.story-footer,footer{align-items:flex-start;flex-direction:column}.story h3{font-size:24px}}
`;
