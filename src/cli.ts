import { mkdir } from "node:fs/promises";
import { generateMarkdownBrief, resolveBriefWindow } from "./brief/index.ts";
import { clusterArticles } from "./cluster/index.ts";
import { loadInterests, loadSources, paths } from "./config.ts";
import { NewsDatabase } from "./db/index.ts";
import { sendBriefToLark } from "./delivery/lark.ts";
import { ingestSources } from "./ingest/index.ts";

const command = process.argv[2] ?? "help";

async function main(): Promise<void> {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  await mkdir(paths.dataDir, { recursive: true });
  const db = await NewsDatabase.open();
  try {
    if (command === "init-db") {
      await db.init();
      console.log(`Initialized SQLite database at ${paths.db}`);
      return;
    }

    await db.init();
    const sources = await loadSources();
    const interests = await loadInterests();

    if (command === "ingest") {
      const summaries = await ingestSources(sources, interests, db);
      printIngestSummary(summaries);
      return;
    }

    if (command === "brief") {
      await createBrief(db, interests, {
        deliver: process.argv.includes("--deliver"),
        hours: readHours(interests.defaultWindowHours)
      });
      return;
    }

    if (command === "run") {
      const summaries = await ingestSources(sources, interests, db);
      printIngestSummary(summaries);
      await createBrief(db, interests, {
        deliver: process.argv.includes("--deliver"),
        hours: readHours(interests.defaultWindowHours)
      });
      return;
    }

    if (command === "cluster") {
      const count = clusterWindow(db, interests, readHours(interests.defaultWindowHours));
      console.log(`Built and stored ${count} story clusters`);
      return;
    }

    if (command === "sources") {
      for (const source of sources) {
        const credential =
          source.type === "x" && !process.env.X_BEARER_TOKEN ? " (missing X_BEARER_TOKEN)" : "";
        console.log(`${source.enabled ? "enabled " : "disabled"} ${source.type.padEnd(7)} ${source.id}${credential}`);
      }
      return;
    }

    if (command === "stats") {
      const stats = db.getStats();
      console.log(`Articles: ${stats.articles}`);
      console.log(`Stories: ${stats.stories}`);
      console.log(`Enabled sources seen: ${stats.sources}`);
      console.log(`Failed fetch jobs: ${stats.failedJobs}`);
      return;
    }

    if (command === "search") {
      const query = process.argv.slice(3).join(" ").trim();
      if (!query) throw new Error("Usage: search <query>");
      const articles = db.searchArticles(query);
      for (const article of articles) {
        console.log(`[${article.score}] ${article.publishedAt} ${article.sourceName} - ${article.title}`);
        console.log(`    ${article.canonicalUrl}`);
      }
      return;
    }

    if (command === "deliver") {
      await createBrief(db, interests, {
        deliver: true,
        hours: readHours(interests.defaultWindowHours)
      });
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    db.close();
  }
}

async function createBrief(
  db: NewsDatabase,
  interests: Awaited<ReturnType<typeof loadInterests>>,
  options: { deliver: boolean; hours: number }
): Promise<void> {
  const { windowStart, windowEnd } = resolveBriefWindow(options.hours);
  const articles = db.listArticles(windowStart, windowEnd, interests.minScoreForBrief);
  const stories = clusterArticles(articles, interests);
  db.replaceStories(stories);
  const result = await generateMarkdownBrief(stories, interests, windowStart, windowEnd);
  db.insertBrief(windowStart, windowEnd, result.path, result.itemCount);
  console.log(`Generated ${result.itemCount} story brief from ${result.articleCount} source items: ${result.path}`);

  if (options.deliver) {
    const delivery = await sendBriefToLark(
      result,
      stories.map((story) => story.articles[0]),
      interests
    );
    console.log(delivery.message);
    if (!delivery.ok) {
      process.exitCode = 1;
    }
  }
}

function clusterWindow(
  db: NewsDatabase,
  interests: Awaited<ReturnType<typeof loadInterests>>,
  hours: number
): number {
  const { windowStart, windowEnd } = resolveBriefWindow(hours);
  const articles = db.listArticles(windowStart, windowEnd, interests.minScoreForBrief);
  const stories = clusterArticles(articles, interests);
  db.replaceStories(stories);
  return stories.length;
}

function readHours(fallback: number): number {
  const inline = process.argv.find((argument) => argument.startsWith("--hours="));
  const index = process.argv.indexOf("--hours");
  const raw = inline?.slice("--hours=".length) ?? (index >= 0 ? process.argv[index + 1] : undefined);
  if (!raw) return fallback;
  const hours = Number.parseInt(raw, 10);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    throw new Error("--hours must be between 1 and 168");
  }
  return hours;
}

function printIngestSummary(summaries: Awaited<ReturnType<typeof ingestSources>>): void {
  for (const summary of summaries) {
    if (summary.failed) {
      console.log(`${summary.sourceName}: failed - ${summary.failed}`);
    } else {
      console.log(`${summary.sourceName}: fetched=${summary.fetched} inserted=${summary.inserted} updated=${summary.updated}`);
    }
  }
}

function printHelp(): void {
  console.log(`Personal News Intelligence MVP

Commands:
  init-db   Create or migrate the SQLite database
  ingest    Fetch enabled RSS/RSSHub sources and store articles
  brief     Generate a Markdown brief from stored articles
  brief --deliver
           Generate a Markdown brief and send it to Lark
  deliver   Generate a Markdown brief and send it to Lark
  cluster   Rebuild story clusters for the current briefing window
  sources   Show configured source and credential status
  stats     Show local database counts
  search    Search stored articles, for example: search NVIDIA
  run       Ingest, cluster, and generate a brief
  run --deliver
           Ingest, cluster, generate, and explicitly deliver

Options:
  --hours N Override the briefing/cluster window (1-168 hours)
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
