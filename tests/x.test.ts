import test from "node:test";
import assert from "node:assert/strict";
import { normalizeItem } from "../src/normalize/index.ts";
import { parseXSearchResponse } from "../src/sources/x.ts";
import type { InterestsConfig, NewsSource } from "../src/types.ts";

test("maps X recent search response to raw feed items", () => {
  const items = parseXSearchResponse({
    data: [{
      id: "123",
      text: "NVIDIA announces a new AI platform",
      author_id: "42",
      created_at: "2026-06-09T00:00:00.000Z",
      lang: "en",
      public_metrics: { like_count: 120, retweet_count: 30 }
    }],
    includes: {
      users: [{
        id: "42",
        name: "NVIDIA",
        username: "nvidia",
        verified: true
      }]
    }
  }, { id: "x-watch", name: "X Watch" });

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://x.com/nvidia/status/123");
  assert.equal(items[0].author, "@nvidia");
  assert.deepEqual(items[0].raw?.publicMetrics, { like_count: 120, retweet_count: 30 });
});

test("keeps X posts in the X section while preserving topic tags", () => {
  const source: NewsSource = {
    id: "x-watch",
    name: "X Watch",
    type: "x",
    query: "NVIDIA",
    category: "x",
    reliability: 0.6,
    enabled: true
  };
  const interests: InterestsConfig = {
    briefTime: "08:00",
    defaultWindowHours: 24,
    minScoreForBrief: 20,
    sectionOrder: ["x"],
    sections: { x: "X" },
    domainWeights: { x: 16, semiconductor: 28 },
    sourceReliabilityWeight: 20,
    keyEntities: ["NVIDIA"],
    keywords: { semiconductor: ["chip", "GPU"] },
    clustering: {
      similarityThreshold: 0.42,
      maxHoursApart: 48,
      minSharedTokens: 2
    }
  };
  const normalized = normalizeItem({
    title: "NVIDIA announces a new GPU chip",
    url: "https://x.com/nvidia/status/123",
    sourceId: source.id,
    sourceName: source.name,
    raw: { publicMetrics: { like_count: 100 } }
  }, source, interests);

  assert.equal(normalized.section, "x");
  assert.ok(normalized.tags.includes("semiconductor"));
});
