import { fetchRssSource } from "../sources/rss.ts";
import { fetchXRecentSearch } from "../sources/x.ts";
import type { InterestsConfig, NewsSource } from "../types.ts";
import { normalizeItem } from "../normalize/index.ts";
import type { NewsDatabase } from "../db/index.ts";

export type IngestSummary = {
  sourceId: string;
  sourceName: string;
  fetched: number;
  inserted: number;
  updated: number;
  failed?: string;
};

export async function ingestSources(
  sources: NewsSource[],
  interests: InterestsConfig,
  db: NewsDatabase
): Promise<IngestSummary[]> {
  const enabled = sources.filter((source) => source.enabled);
  const summaries: IngestSummary[] = [];

  for (const source of enabled) {
    db.upsertSource(source);
    const jobId = db.startFetchJob(source.id);
    try {
      const rawItems = await fetchSource(source);
      let inserted = 0;
      let updated = 0;
      const fetchedAt = new Date().toISOString();

      for (const item of rawItems) {
        const article = normalizeItem(item, source, interests, fetchedAt);
        const result = db.upsertArticle(article);
        if (result === "inserted") inserted += 1;
        else updated += 1;
      }

      db.finishFetchJob(jobId, "success", rawItems.length);
      summaries.push({ sourceId: source.id, sourceName: source.name, fetched: rawItems.length, inserted, updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db.finishFetchJob(jobId, "failed", 0, message);
      summaries.push({ sourceId: source.id, sourceName: source.name, fetched: 0, inserted: 0, updated: 0, failed: message });
    }
  }

  return summaries;
}

async function fetchSource(source: NewsSource) {
  if (source.type === "rss" || source.type === "rsshub") {
    return fetchRssSource(source);
  }
  if (source.type === "x") {
    return fetchXRecentSearch(source);
  }
  throw new Error(`Source type ${source.type} is not implemented yet`);
}
