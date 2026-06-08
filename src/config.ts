import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { InterestsConfig, NewsSource } from "./types.ts";

const root = resolve(import.meta.dirname, "..");

export const paths = {
  root,
  dataDir: resolve(root, "data"),
  briefsDir: resolve(root, "data", "briefs"),
  db: resolve(root, "data", "news.db"),
  sources: resolve(root, "config", "sources.json"),
  interests: resolve(root, "config", "interests.json"),
  schema: resolve(root, "src", "db", "schema.sql")
};

export async function loadSources(): Promise<NewsSource[]> {
  const content = await readFile(paths.sources, "utf8");
  return JSON.parse(content) as NewsSource[];
}

export async function loadInterests(): Promise<InterestsConfig> {
  const content = await readFile(paths.interests, "utf8");
  return JSON.parse(content) as InterestsConfig;
}
