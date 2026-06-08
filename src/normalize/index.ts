import { createHash } from "node:crypto";
import type { InterestsConfig, NewsSource, NormalizedArticle, RawFeedItem } from "../types.ts";
import { scoreArticle } from "../rank/index.ts";

export function normalizeItem(
  item: RawFeedItem,
  source: NewsSource,
  interests: InterestsConfig,
  fetchedAt = new Date().toISOString()
): NormalizedArticle {
  const canonicalUrl = canonicalizeUrl(item.url);
  const title = normalizeWhitespace(item.title);
  const summary = item.summary ? normalizeWhitespace(item.summary) : undefined;
  const publishedAt = parseDate(item.publishedAt) ?? fetchedAt;
  const combinedText = [title, summary].filter(Boolean).join(" ");
  const entities = extractEntities(combinedText, interests.keyEntities);
  const tags = extractTags(combinedText, source, interests, entities);
  const hash = stableHash(`${title.toLowerCase()}|${source.id}`);
  const section = chooseSection(tags, source.category);
  const scoring = scoreArticle({ title, summary, tags, entities, section, source }, interests);

  return {
    sourceId: source.id,
    sourceName: source.name,
    canonicalUrl,
    title,
    author: item.author,
    publishedAt,
    fetchedAt,
    language: source.language,
    summary,
    hash,
    tags,
    entities,
    section,
    score: scoring.score,
    scoreReasons: scoring.reasons,
    metadata: {
      sourceType: source.type,
      sourceRegion: source.region,
      sourceCategory: source.category,
      raw: item.raw ?? {}
    }
  };
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function extractEntities(text: string, entities: string[]): string[] {
  const found = new Set<string>();
  for (const entity of entities) {
    const pattern = new RegExp(`\\b${escapeRegExp(entity)}\\b`, "i");
    if (pattern.test(text)) {
      found.add(entity);
    }
  }
  return [...found];
}

function extractTags(
  text: string,
  source: NewsSource,
  interests: InterestsConfig,
  entities: string[]
): string[] {
  const tags = new Set<string>();
  if (source.category) tags.add(source.category);
  if (source.region) tags.add(source.region);
  if (source.language) tags.add(source.language);
  for (const entity of entities) tags.add(entity);

  for (const [section, keywords] of Object.entries(interests.keywords)) {
    if (keywords.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text))) {
      tags.add(section);
    }
  }

  return [...tags];
}

function chooseSection(tags: string[], fallback?: string): string {
  for (const section of ["semiconductor", "finance", "tech", "happening", "x", "global"]) {
    if (tags.includes(section)) return section;
  }
  return fallback ?? "global";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
