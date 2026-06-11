import test from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../src/web/server.ts";
import type { InterestsConfig } from "../src/types.ts";

const interests: InterestsConfig = {
  briefTime: "08:00",
  defaultWindowHours: 24,
  minScoreForBrief: 20,
  sectionOrder: ["tech"],
  sections: { tech: "IT / AI / Internet" },
  domainWeights: { tech: 24 },
  sourceReliabilityWeight: 20,
  keyEntities: [],
  keywords: {},
  clustering: { similarityThreshold: 0.42, maxHoursApart: 48, minSharedTokens: 2 },
  report: { maxStoriesPerSection: 8, bilingual: true }
};

test("renders dashboard shell and empty states", () => {
  const html = renderDashboard({
    stories: [],
    sourceHealth: [],
    briefs: [],
    stats: { articles: 0, stories: 0, sources: 0, failedJobs: 0 },
    query: "",
    section: "",
    hours: 72,
    interests
  });
  assert.match(html, /今日情报台/);
  assert.match(html, /事件流/);
  assert.match(html, /来源健康/);
});
