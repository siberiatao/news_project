import test from "node:test";
import assert from "node:assert/strict";
import { renderHtml, renderMarkdown, selectReportStories } from "../src/brief/index.ts";
import { fallbackEnrichment } from "../src/enrich/index.ts";
import type { EnrichedStory, InterestsConfig, StoredArticle } from "../src/types.ts";

const interests: InterestsConfig = {
  briefTime: "08:00",
  defaultWindowHours: 24,
  minScoreForBrief: 20,
  sectionOrder: ["tech"],
  sections: { tech: "IT / AI / Internet" },
  domainWeights: { tech: 24 },
  sourceReliabilityWeight: 20,
  keyEntities: ["OpenAI"],
  keywords: {},
  clustering: { similarityThreshold: 0.42, maxHoursApart: 48, minSharedTokens: 2 },
  report: { maxStoriesPerSection: 8, bilingual: true }
};

test("renders bilingual Markdown and standalone HTML", () => {
  const story = makeStory();
  const markdown = renderMarkdown([story], interests, story.firstSeenAt, story.lastSeenAt);
  const html = renderHtml([story], interests, story.firstSeenAt, story.lastSeenAt);

  assert.match(markdown, /中文摘要/);
  assert.match(markdown, /English summary/);
  assert.match(html, /What matters today/);
  assert.match(html, /中文摘要/);
  assert.match(html, /OpenAI releases a platform update/);
  assert.match(html, /Previous known update/);
  assert.match(markdown, /Previous known update/);
});

test("selects only the configured number of stories per section", () => {
  const story = makeStory();
  const repeated = Array.from({ length: 3 }, (_, index) => ({
    ...story,
    key: `story-${index}`,
    score: 90 - index
  }));
  const selected = selectReportStories(repeated, {
    ...interests,
    report: { ...interests.report, maxStoriesPerSection: 2 }
  });
  assert.equal(selected.length, 2);
  assert.deepEqual(selected.map((item) => item.key), ["story-0", "story-1"]);
});

function makeStory(): EnrichedStory {
  const article: StoredArticle = {
    id: 1,
    sourceId: "sample",
    sourceName: "Sample",
    canonicalUrl: "https://example.com/story",
    title: "OpenAI releases a platform update",
    summary: "The update improves developer tools.",
    publishedAt: "2026-06-11T00:00:00.000Z",
    fetchedAt: "2026-06-11T00:01:00.000Z",
    hash: "hash",
    tags: ["tech"],
    entities: ["OpenAI"],
    section: "tech",
    score: 55,
    scoreReasons: ["domain:tech+24"],
    metadata: { sourceType: "rss" },
    createdAt: "2026-06-11T00:01:00.000Z"
  };
  const base = {
    key: "story",
    title: article.title,
    summary: article.summary,
    section: "tech",
    score: 55,
    scoreReasons: article.scoreReasons,
    firstSeenAt: article.publishedAt,
    lastSeenAt: article.publishedAt,
    tags: article.tags,
    entities: article.entities,
    sources: [article.sourceName],
    articles: [article],
    status: "developing" as const,
    updateCount: 2,
    newArticleCount: 1,
    previousLastSeenAt: "2026-06-10T00:00:00.000Z"
  };
  return { ...base, enrichment: fallbackEnrichment(base) };
}
