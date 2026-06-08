import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paths } from "../config.ts";
import type { NewsSource, NormalizedArticle, StoredArticle } from "../types.ts";

export class NewsDatabase {
  private db: DatabaseSync;

  constructor(filename = paths.db) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  static async open(filename = paths.db): Promise<NewsDatabase> {
    await mkdir(dirname(filename), { recursive: true });
    return new NewsDatabase(filename);
  }

  async init(): Promise<void> {
    const schema = await readFile(paths.schema, "utf8");
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  upsertSource(source: NewsSource): void {
    this.db.prepare(`
      INSERT INTO sources (id, name, type, url, homepage, language, region, category, reliability, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        url = excluded.url,
        homepage = excluded.homepage,
        language = excluded.language,
        region = excluded.region,
        category = excluded.category,
        reliability = excluded.reliability,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(
      source.id,
      source.name,
      source.type,
      source.url,
      source.homepage ?? null,
      source.language ?? null,
      source.region ?? null,
      source.category ?? null,
      source.reliability ?? null,
      source.enabled ? 1 : 0,
      new Date().toISOString()
    );
  }

  startFetchJob(sourceId: string): number {
    const result = this.db.prepare(`
      INSERT INTO fetch_jobs (source_id, status, started_at)
      VALUES (?, 'running', ?)
    `).run(sourceId, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  finishFetchJob(jobId: number, status: "success" | "failed", itemCount: number, error?: string): void {
    this.db.prepare(`
      UPDATE fetch_jobs
      SET status = ?, finished_at = ?, item_count = ?, error = ?
      WHERE id = ?
    `).run(status, new Date().toISOString(), itemCount, error ?? null, jobId);
  }

  upsertArticle(article: NormalizedArticle): "inserted" | "updated" {
    const existing = this.db.prepare("SELECT id FROM articles WHERE canonical_url = ?").get(article.canonicalUrl);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO articles (
        source_id, source_name, canonical_url, title, author, published_at, fetched_at,
        language, summary, hash, tags_json, entities_json, section, score,
        score_reasons_json, metadata_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(canonical_url) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at,
        tags_json = excluded.tags_json,
        entities_json = excluded.entities_json,
        section = excluded.section,
        score = excluded.score,
        score_reasons_json = excluded.score_reasons_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      article.sourceId,
      article.sourceName,
      article.canonicalUrl,
      article.title,
      article.author ?? null,
      article.publishedAt,
      article.fetchedAt,
      article.language ?? null,
      article.summary ?? null,
      article.hash,
      JSON.stringify(article.tags),
      JSON.stringify(article.entities),
      article.section,
      article.score,
      JSON.stringify(article.scoreReasons),
      JSON.stringify(article.metadata),
      now,
      now
    );
    return existing ? "updated" : "inserted";
  }

  listArticles(windowStart: string, windowEnd: string, minScore = 0): StoredArticle[] {
    const rows = this.db.prepare(`
      SELECT *
      FROM articles
      WHERE published_at >= ? AND published_at <= ? AND score >= ?
      ORDER BY score DESC, published_at DESC
    `).all(windowStart, windowEnd, minScore) as ArticleRow[];
    return rows.map(rowToStoredArticle);
  }

  insertBrief(windowStart: string, windowEnd: string, path: string, itemCount: number): void {
    this.db.prepare(`
      INSERT INTO briefs (window_start, window_end, path, item_count, generated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(windowStart, windowEnd, path, itemCount, new Date().toISOString());
  }
}

type ArticleRow = {
  id: number;
  source_id: string;
  source_name: string;
  canonical_url: string;
  title: string;
  author: string | null;
  published_at: string;
  fetched_at: string;
  language: string | null;
  summary: string | null;
  hash: string;
  tags_json: string;
  entities_json: string;
  section: string;
  score: number;
  score_reasons_json: string;
  metadata_json: string;
  created_at: string;
};

function rowToStoredArticle(row: ArticleRow): StoredArticle {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    canonicalUrl: row.canonical_url,
    title: row.title,
    author: row.author ?? undefined,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    language: row.language ?? undefined,
    summary: row.summary ?? undefined,
    hash: row.hash,
    tags: JSON.parse(row.tags_json) as string[],
    entities: JSON.parse(row.entities_json) as string[],
    section: row.section,
    score: row.score,
    scoreReasons: JSON.parse(row.score_reasons_json) as string[],
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    createdAt: row.created_at
  };
}
