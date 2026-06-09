import { createHash } from "node:crypto";
import type { InterestsConfig, StoredArticle, StoryCluster } from "../types.ts";

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "have", "in", "is", "it", "its", "of", "on", "or", "that", "the", "this",
  "to", "was", "were", "will", "with", "after", "amid", "new", "says", "over"
]);

export function clusterArticles(
  articles: StoredArticle[],
  interests: InterestsConfig
): StoryCluster[] {
  const sorted = [...articles].sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
  const clusters: Array<{ representative: StoredArticle; articles: StoredArticle[] }> = [];

  for (const article of sorted) {
    let best:
      | { cluster: { representative: StoredArticle; articles: StoredArticle[] }; similarity: number }
      | undefined;

    for (const cluster of clusters) {
      if (!withinHours(article, cluster.representative, interests.clustering.maxHoursApart)) continue;
      const similarity = articleSimilarity(article, cluster.representative);
      const shared = sharedTokenCount(article.title, cluster.representative.title);
      const entityMatch = intersection(article.entities, cluster.representative.entities).length > 0;
      const qualifies =
        similarity >= interests.clustering.similarityThreshold &&
        (shared >= interests.clustering.minSharedTokens || entityMatch);
      if (qualifies && (!best || similarity > best.similarity)) {
        best = { cluster, similarity };
      }
    }

    if (best) {
      best.cluster.articles.push(article);
      if (article.score > best.cluster.representative.score) {
        best.cluster.representative = article;
      }
    } else {
      clusters.push({ representative: article, articles: [article] });
    }
  }

  return clusters
    .map(toStoryCluster)
    .sort((a, b) => b.score - a.score || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function articleSimilarity(a: StoredArticle, b: StoredArticle): number {
  const aTokens = tokenize(a.title);
  const bTokens = tokenize(b.title);
  const tokenScore = jaccard(aTokens, bTokens);
  const entityScore = jaccard(new Set(a.entities.map(normalizeToken)), new Set(b.entities.map(normalizeToken)));
  const tagScore = jaccard(new Set(a.tags.map(normalizeToken)), new Set(b.tags.map(normalizeToken)));
  return tokenScore * 0.7 + entityScore * 0.22 + tagScore * 0.08;
}

function toStoryCluster(cluster: { representative: StoredArticle; articles: StoredArticle[] }): StoryCluster {
  const articles = [...cluster.articles].sort(
    (a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt)
  );
  const representative = articles[0];
  const sources = unique(articles.map((article) => article.sourceName));
  const entities = unique(articles.flatMap((article) => article.entities));
  const tags = unique(articles.flatMap((article) => article.tags));
  const timestamps = articles.map((article) => article.publishedAt).sort();
  const multiSourceBonus = Math.min(24, Math.max(0, sources.length - 1) * 8);
  const xBonus = articles.some((article) => article.metadata.sourceType === "x") && sources.length > 1 ? 6 : 0;
  const score = Math.min(100, representative.score + multiSourceBonus + xBonus);
  const keyMaterial = [...tokenize(representative.title)].sort().join(" ") || representative.hash;

  return {
    key: createHash("sha256").update(keyMaterial).digest("hex"),
    title: representative.title,
    summary: chooseSummary(articles),
    section: chooseSection(articles),
    score,
    scoreReasons: [
      ...representative.scoreReasons,
      ...(multiSourceBonus > 0 ? [`multi-source:${sources.length}+${multiSourceBonus}`] : []),
      ...(xBonus > 0 ? ["x-corroboration+6"] : [])
    ],
    firstSeenAt: timestamps[0],
    lastSeenAt: timestamps[timestamps.length - 1],
    tags,
    entities,
    sources,
    articles
  };
}

function tokenize(value: string): Set<string> {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const words = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopWords.has(token));
  const tokens = new Set(words);

  for (const word of words) {
    if (/^[\p{Script=Han}]+$/u.test(word) && word.length > 2) {
      for (let index = 0; index < word.length - 1; index += 1) {
        tokens.add(word.slice(index, index + 2));
      }
    }
  }
  return tokens;
}

function sharedTokenCount(a: string, b: string): number {
  return intersection([...tokenize(a)], [...tokenize(b)]).length;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((value) => b.has(value)).length;
  return shared / (a.size + b.size - shared);
}

function withinHours(a: StoredArticle, b: StoredArticle, hours: number): boolean {
  return Math.abs(new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()) <= hours * 60 * 60 * 1000;
}

function chooseSummary(articles: StoredArticle[]): string | undefined {
  return articles
    .map((article) => article.summary)
    .filter((summary): summary is string => Boolean(summary))
    .sort((a, b) => b.length - a.length)[0];
}

function chooseSection(articles: StoredArticle[]): string {
  const domainArticles = articles.filter((article) => article.metadata.sourceType !== "x");
  const candidates = domainArticles.length > 0 ? domainArticles : articles;
  const weights = new Map<string, number>();
  for (const article of candidates) {
    weights.set(article.section, (weights.get(article.section) ?? 0) + article.score);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "global";
}

function intersection<T>(a: T[], b: T[]): T[] {
  const bSet = new Set(b);
  return [...new Set(a.filter((value) => bSet.has(value)))];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeToken(value: string): string {
  return value.toLowerCase();
}
