import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paths } from "../config.ts";
import type {
  BriefRecord,
  NewsSource,
  NormalizedArticle,
  SourceHealth,
  StoredArticle,
  StoredStorySnapshot,
  StoryCluster
} from "../types.ts";

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
    this.ensureColumn("stories", "status", "TEXT NOT NULL DEFAULT 'new'");
    this.ensureColumn("stories", "update_count", "INTEGER NOT NULL DEFAULT 1");
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
      source.url ?? "",
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

  replaceStories(stories: StoryCluster[]): void {
    this.db.exec("BEGIN");
    try {
      const upsertStory = this.db.prepare(`
        INSERT INTO stories (
          story_key, title, summary, section, score, score_reasons_json,
          first_seen_at, last_seen_at, tags_json, entities_json, sources_json,
          status, update_count, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(story_key) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          section = excluded.section,
          score = excluded.score,
          score_reasons_json = excluded.score_reasons_json,
          first_seen_at = excluded.first_seen_at,
          last_seen_at = excluded.last_seen_at,
          tags_json = excluded.tags_json,
          entities_json = excluded.entities_json,
          sources_json = excluded.sources_json,
          status = excluded.status,
          update_count = excluded.update_count,
          updated_at = excluded.updated_at
        RETURNING id
      `);
      const deleteLinks = this.db.prepare("DELETE FROM story_articles WHERE story_id = ?");
      const insertLink = this.db.prepare(`
        INSERT INTO story_articles (story_id, article_id, similarity)
        VALUES (?, ?, ?)
      `);

      for (const story of stories) {
        const row = upsertStory.get(
          story.key,
          story.title,
          story.summary ?? null,
          story.section,
          story.score,
          JSON.stringify(story.scoreReasons),
          story.firstSeenAt,
          story.lastSeenAt,
          JSON.stringify(story.tags),
          JSON.stringify(story.entities),
          JSON.stringify(story.sources),
          story.status,
          story.updateCount,
          new Date().toISOString()
        ) as { id: number };
        deleteLinks.run(row.id);
        for (const article of story.articles) {
          insertLink.run(row.id, article.id, article.id === story.articles[0]?.id ? 1 : 0.5);
        }
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listStorySnapshots(since: string): StoredStorySnapshot[] {
    const rows = this.db.prepare(`
      SELECT
        s.story_key, s.title, s.section, s.first_seen_at, s.last_seen_at,
        s.tags_json, s.entities_json, s.status, s.update_count,
        COALESCE(json_group_array(sa.article_id) FILTER (WHERE sa.article_id IS NOT NULL), '[]') AS article_ids_json
      FROM stories s
      LEFT JOIN story_articles sa ON sa.story_id = s.id
      WHERE s.last_seen_at >= ?
      GROUP BY s.id
      ORDER BY s.last_seen_at DESC
    `).all(since) as StorySnapshotRow[];
    return rows.map((row) => ({
      key: row.story_key,
      title: row.title,
      section: row.section,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      tags: JSON.parse(row.tags_json) as string[],
      entities: JSON.parse(row.entities_json) as string[],
      status: row.status === "developing" || row.status === "ongoing" ? row.status : "new",
      updateCount: row.update_count,
      articleIds: JSON.parse(row.article_ids_json) as number[]
    }));
  }

  searchArticles(query: string, limit = 20): StoredArticle[] {
    const pattern = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT *
      FROM articles
      WHERE title LIKE ? OR summary LIKE ? OR entities_json LIKE ? OR tags_json LIKE ?
      ORDER BY published_at DESC, score DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, pattern, limit) as ArticleRow[];
    return rows.map(rowToStoredArticle);
  }

  getStats(): {
    articles: number;
    stories: number;
    developingStories: number;
    sources: number;
    failedJobs: number;
  } {
    const scalar = (sql: string) => Number((this.db.prepare(sql).get() as { count: number }).count);
    return {
      articles: scalar("SELECT COUNT(*) AS count FROM articles"),
      stories: scalar("SELECT COUNT(*) AS count FROM stories"),
      developingStories: scalar("SELECT COUNT(*) AS count FROM stories WHERE status = 'developing'"),
      sources: scalar("SELECT COUNT(*) AS count FROM sources WHERE enabled = 1"),
      failedJobs: scalar("SELECT COUNT(*) AS count FROM fetch_jobs WHERE status = 'failed'")
    };
  }

  listSourceHealth(): SourceHealth[] {
    const rows = this.db.prepare(`
      SELECT
        s.id, s.name, s.type, s.enabled,
        j.status AS last_status,
        j.finished_at AS last_fetched_at,
        j.item_count AS last_item_count,
        j.error AS last_error
      FROM sources s
      LEFT JOIN fetch_jobs j ON j.id = (
        SELECT id FROM fetch_jobs WHERE source_id = s.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY s.enabled DESC, s.name ASC
    `).all() as SourceHealthRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      enabled: row.enabled === 1,
      status: row.last_status === "success" ? "healthy" : row.last_status === "failed" ? "degraded" : "unknown",
      lastFetchedAt: row.last_fetched_at ?? undefined,
      lastStatus: row.last_status ?? undefined,
      lastItemCount: row.last_item_count ?? undefined,
      lastError: row.last_error ?? undefined
    }));
  }

  listBriefs(limit = 20): BriefRecord[] {
    const rows = this.db.prepare(`
      SELECT b.id, b.window_start, b.window_end, b.path, b.item_count, b.generated_at
      FROM briefs b
      WHERE b.id = (
        SELECT MAX(latest.id)
        FROM briefs latest
        WHERE latest.path = b.path
      )
      ORDER BY b.id DESC
      LIMIT ?
    `).all(limit) as BriefRow[];
    return rows.map((row) => ({
      id: row.id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      path: row.path,
      itemCount: row.item_count,
      generatedAt: row.generated_at
    }));
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((existing) => existing.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
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

type SourceHealthRow = {
  id: string;
  name: string;
  type: string;
  enabled: number;
  last_status: string | null;
  last_fetched_at: string | null;
  last_item_count: number | null;
  last_error: string | null;
};

type BriefRow = {
  id: number;
  window_start: string;
  window_end: string;
  path: string;
  item_count: number;
  generated_at: string;
};

type StorySnapshotRow = {
  story_key: string;
  title: string;
  section: string;
  first_seen_at: string;
  last_seen_at: string;
  tags_json: string;
  entities_json: string;
  status: string;
  update_count: number;
  article_ids_json: string;
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
