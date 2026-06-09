import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { paths } from "../config.ts";
import type { InterestsConfig, StoryCluster } from "../types.ts";

export type BriefResult = {
  path: string;
  markdown: string;
  itemCount: number;
  articleCount: number;
  windowStart: string;
  windowEnd: string;
};

export async function generateMarkdownBrief(
  stories: StoryCluster[],
  interests: InterestsConfig,
  windowStart: string,
  windowEnd: string
): Promise<BriefResult> {
  await mkdir(paths.briefsDir, { recursive: true });

  const grouped = groupBySection(stories);
  const lines: string[] = [];
  lines.push(`# Daily News Brief`);
  lines.push("");
  lines.push(`Window: ${formatDate(windowStart)} - ${formatDate(windowEnd)}`);
  lines.push(`Generated: ${formatDate(new Date().toISOString())}`);
  lines.push("");

  lines.push(`Stories: ${stories.length}`);
  lines.push(`Source items: ${stories.reduce((count, story) => count + story.articles.length, 0)}`);
  lines.push("");

  if (stories.length === 0) {
    lines.push("No stories matched the current briefing threshold.");
    lines.push("");
  }

  for (const section of interests.sectionOrder) {
    const sectionStories = grouped.get(section) ?? [];
    if (sectionStories.length === 0) continue;
    lines.push(`## ${interests.sections[section] ?? titleCase(section)}`);
    lines.push("");

    for (const story of sectionStories.slice(0, 8)) {
      lines.push(`### ${story.title}`);
      lines.push("");
      lines.push(`- Summary: ${story.summary || story.title}`);
      lines.push(`- Importance: ${story.score}/100`);
      lines.push(`- Coverage: ${story.articles.length} item(s) from ${story.sources.length} source(s)`);
      lines.push(`- Sources: ${story.sources.join(", ")}`);
      lines.push(`- First / latest: ${formatDate(story.firstSeenAt)} / ${formatDate(story.lastSeenAt)}`);
      lines.push(`- Why it matters: ${whyItMatters(story)}`);
      lines.push(`- Watch next: ${watchNext(story)}`);
      lines.push("- Original links:");
      for (const article of story.articles.slice(0, 5)) {
        lines.push(`  - [${article.sourceName}](${article.canonicalUrl})`);
      }
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
    itemCount: stories.length,
    articleCount: stories.reduce((count, story) => count + story.articles.length, 0),
    windowStart,
    windowEnd
  };
}

export function resolveBriefWindow(hours: number, end = new Date()): { windowStart: string; windowEnd: string } {
  const windowEnd = end.toISOString();
  const windowStart = new Date(end.getTime() - hours * 60 * 60 * 1000).toISOString();
  return { windowStart, windowEnd };
}

function groupBySection(stories: StoryCluster[]): Map<string, StoryCluster[]> {
  const grouped = new Map<string, StoryCluster[]>();
  for (const story of stories) {
    const list = grouped.get(story.section) ?? [];
    list.push(story);
    grouped.set(story.section, list);
  }
  return grouped;
}

function whyItMatters(story: StoryCluster): string {
  if (story.sources.length > 1) {
    return `${story.sources.length} independent sources are covering the same development.`;
  }
  if (story.entities.length > 0) {
    return `Touches key watchlist entities: ${story.entities.join(", ")}.`;
  }
  const domainReason = story.scoreReasons.find((reason) => reason.startsWith("domain:"));
  if (domainReason) {
    return `Matches your ${story.section} intelligence lane.`;
  }
  return "It passed the current importance threshold for the briefing window.";
}

function watchNext(story: StoryCluster): string {
  if (story.section === "happening") {
    return "Check whether more trusted sources confirm the development and whether follow-on policy or market reaction appears.";
  }
  if (story.section === "semiconductor") {
    return "Watch for supply chain, export control, capex, or customer impact.";
  }
  if (story.section === "finance") {
    return "Watch market pricing, earnings revisions, rate expectations, and second-order company impact.";
  }
  if (story.section === "tech") {
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
