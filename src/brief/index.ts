import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { paths } from "../config.ts";
import type { InterestsConfig, StoredArticle } from "../types.ts";

export type BriefResult = {
  path: string;
  markdown: string;
  itemCount: number;
  windowStart: string;
  windowEnd: string;
};

export async function generateMarkdownBrief(
  articles: StoredArticle[],
  interests: InterestsConfig,
  windowStart: string,
  windowEnd: string
): Promise<BriefResult> {
  await mkdir(paths.briefsDir, { recursive: true });

  const grouped = groupBySection(articles);
  const lines: string[] = [];
  lines.push(`# Daily News Brief`);
  lines.push("");
  lines.push(`Window: ${formatDate(windowStart)} - ${formatDate(windowEnd)}`);
  lines.push(`Generated: ${formatDate(new Date().toISOString())}`);
  lines.push("");

  if (articles.length === 0) {
    lines.push("No articles matched the current briefing threshold.");
    lines.push("");
  }

  for (const section of interests.sectionOrder) {
    const sectionArticles = grouped.get(section) ?? [];
    if (sectionArticles.length === 0) continue;
    lines.push(`## ${interests.sections[section] ?? titleCase(section)}`);
    lines.push("");

    for (const article of sectionArticles.slice(0, 8)) {
      lines.push(`### ${article.title}`);
      lines.push("");
      lines.push(`- Summary: ${article.summary || article.title}`);
      lines.push(`- Importance: ${article.score}/100`);
      lines.push(`- Sources: ${article.sourceName}`);
      lines.push(`- Original: ${article.canonicalUrl}`);
      lines.push(`- Why it matters: ${whyItMatters(article)}`);
      lines.push(`- Watch next: ${watchNext(article)}`);
      lines.push("");
    }
  }

  const markdown = lines.join("\n");
  const filename = `brief-${windowEnd.slice(0, 10)}.md`;
  const outputPath = resolve(paths.briefsDir, filename);
  await writeFile(outputPath, markdown, "utf8");

  return {
    path: outputPath,
    markdown,
    itemCount: articles.length,
    windowStart,
    windowEnd
  };
}

export function resolveBriefWindow(hours: number, end = new Date()): { windowStart: string; windowEnd: string } {
  const windowEnd = end.toISOString();
  const windowStart = new Date(end.getTime() - hours * 60 * 60 * 1000).toISOString();
  return { windowStart, windowEnd };
}

function groupBySection(articles: StoredArticle[]): Map<string, StoredArticle[]> {
  const grouped = new Map<string, StoredArticle[]>();
  for (const article of articles) {
    const list = grouped.get(article.section) ?? [];
    list.push(article);
    grouped.set(article.section, list);
  }
  return grouped;
}

function whyItMatters(article: StoredArticle): string {
  if (article.entities.length > 0) {
    return `Touches key watchlist entities: ${article.entities.join(", ")}.`;
  }
  const domainReason = article.scoreReasons.find((reason) => reason.startsWith("domain:"));
  if (domainReason) {
    return `Matches your ${article.section} intelligence lane.`;
  }
  return "It passed the current importance threshold for the briefing window.";
}

function watchNext(article: StoredArticle): string {
  if (article.section === "happening") {
    return "Check whether more trusted sources confirm the development and whether follow-on policy or market reaction appears.";
  }
  if (article.section === "semiconductor") {
    return "Watch for supply chain, export control, capex, or customer impact.";
  }
  if (article.section === "finance") {
    return "Watch market pricing, earnings revisions, rate expectations, and second-order company impact.";
  }
  if (article.section === "tech") {
    return "Watch product, platform, regulation, and competitive response.";
  }
  return "Watch for updates from primary sources and higher-quality follow-up reporting.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { hour12: false });
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
