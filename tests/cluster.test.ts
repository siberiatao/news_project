import test from "node:test";
import assert from "node:assert/strict";
import { clusterArticles } from "../src/cluster/index.ts";
import type { InterestsConfig, StoredArticle } from "../src/types.ts";

const interests: InterestsConfig = {
  briefTime: "08:00",
  defaultWindowHours: 24,
  minScoreForBrief: 20,
  sectionOrder: ["tech"],
  sections: { tech: "Tech" },
  domainWeights: { tech: 20 },
  sourceReliabilityWeight: 20,
  keyEntities: ["NVIDIA"],
  keywords: {},
  clustering: {
    similarityThreshold: 0.35,
    maxHoursApart: 48,
    minSharedTokens: 2
  },
  report: {
    maxStoriesPerSection: 8,
    bilingual: true
  }
};

test("clusters similar reports and applies multi-source bonus", () => {
  const articles = [
    article(1, "Reuters", "NVIDIA unveils new AI chip for data centers", 54),
    article(2, "BBC", "NVIDIA unveils a new AI chip aimed at data centers", 48)
  ];

  const stories = clusterArticles(articles, interests);
  assert.equal(stories.length, 1);
  assert.equal(stories[0].articles.length, 2);
  assert.deepEqual(stories[0].sources.sort(), ["BBC", "Reuters"]);
  assert.equal(stories[0].score, 62);
  assert.match(stories[0].scoreReasons.join(" "), /multi-source/);
});

test("keeps unrelated reports separate", () => {
  const stories = clusterArticles([
    article(1, "Reuters", "NVIDIA unveils new AI chip for data centers", 54),
    article(2, "BBC", "Central bank holds interest rates steady", 48)
  ], interests);
  assert.equal(stories.length, 2);
});

function article(id: number, sourceName: string, title: string, score: number): StoredArticle {
  return {
    id,
    sourceId: sourceName.toLowerCase(),
    sourceName,
    canonicalUrl: `https://example.com/${id}`,
    title,
    publishedAt: "2026-06-09T00:00:00.000Z",
    fetchedAt: "2026-06-09T00:05:00.000Z",
    hash: String(id),
    tags: ["tech", "NVIDIA"],
    entities: ["NVIDIA"],
    section: "tech",
    score,
    scoreReasons: ["domain:tech+20"],
    metadata: { sourceType: "rss" },
    createdAt: "2026-06-09T00:05:00.000Z"
  };
}
