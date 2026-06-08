import { mkdir } from "node:fs/promises";
import { generateMarkdownBrief, resolveBriefWindow } from "./brief/index.ts";
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
      await createBrief(db, interests, { deliver: process.argv.includes("--deliver") });
      return;
    }

    if (command === "run") {
      const summaries = await ingestSources(sources, interests, db);
      printIngestSummary(summaries);
      await createBrief(db, interests, { deliver: true });
      return;
    }

    if (command === "deliver") {
      await createBrief(db, interests, { deliver: true });
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
  options: { deliver: boolean }
): Promise<void> {
  const { windowStart, windowEnd } = resolveBriefWindow(interests.defaultWindowHours);
  const articles = db.listArticles(windowStart, windowEnd, interests.minScoreForBrief);
  const result = await generateMarkdownBrief(articles, interests, windowStart, windowEnd);
  db.insertBrief(windowStart, windowEnd, result.path, result.itemCount);
  console.log(`Generated ${result.itemCount} item brief: ${result.path}`);

  if (options.deliver) {
    const delivery = await sendBriefToLark(result, articles, interests);
    console.log(delivery.message);
    if (!delivery.ok) {
      process.exitCode = 1;
    }
  }
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
  run       Ingest sources, generate a brief, then send it to Lark when configured
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
