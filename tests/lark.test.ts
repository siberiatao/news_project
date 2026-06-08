import test from "node:test";
import assert from "node:assert/strict";
import { buildLarkText, createLarkSignature } from "../src/delivery/lark.ts";
import type { BriefResult } from "../src/brief/index.ts";
import type { InterestsConfig, StoredArticle } from "../src/types.ts";

test("creates deterministic Lark signature for timestamp and secret", () => {
  assert.equal(createLarkSignature("1234567890", "secret"), "ZfKVuj6L5hFYWbpNk/R//8s1lu9nDXiIbG0Fc4NaCEk=");
});

test("builds capped Lark text", () => {
  const brief: BriefResult = {
    path: "/tmp/brief.md",
    markdown: "",
    itemCount: 1,
    windowStart: "2026-06-07T00:00:00.000Z",
    windowEnd: "2026-06-08T00:00:00.000Z"
  };
  const interests: InterestsConfig = {
    briefTime: "08:00",
    defaultWindowHours: 24,
    minScoreForBrief: 20,
    sectionOrder: ["tech"],
    sections: { tech: "IT / AI / Internet" },
    domainWeights: {},
    sourceReliabilityWeight: 20,
    keyEntities: [],
    keywords: {}
  };
  const article: StoredArticle = {
    id: 1,
    sourceId: "src",
    sourceName: "Source",
    canonicalUrl: "https://example.com",
    title: "OpenAI releases a long platform update",
    publishedAt: "2026-06-08T00:00:00.000Z",
    fetchedAt: "2026-06-08T00:00:00.000Z",
    hash: "hash",
    tags: ["tech"],
    entities: ["OpenAI"],
    section: "tech",
    score: 42,
    scoreReasons: [],
    metadata: {},
    createdAt: "2026-06-08T00:00:00.000Z"
  };

  const text = buildLarkText(brief, [article], interests, 180);
  assert.match(text, /每日新闻情报简报/);
  assert.ok(text.length <= 220);
  assert.match(text, /完整简报/);
});
