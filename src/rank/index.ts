import type { InterestsConfig, NewsSource } from "../types.ts";

type RankableArticle = {
  title: string;
  summary?: string;
  tags: string[];
  entities: string[];
  section: string;
  source: NewsSource;
  raw?: Record<string, unknown>;
};

export function scoreArticle(article: RankableArticle, interests: InterestsConfig): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const sourceReliability = article.source.reliability ?? 0.5;
  const domainWeight = interests.domainWeights[article.section] ?? 8;

  score += domainWeight;
  reasons.push(`domain:${article.section}+${domainWeight}`);

  const reliabilityPoints = Math.round(sourceReliability * interests.sourceReliabilityWeight);
  score += reliabilityPoints;
  reasons.push(`source:${article.source.name}+${reliabilityPoints}`);

  if (article.entities.length > 0) {
    const entityPoints = Math.min(24, article.entities.length * 6);
    score += entityPoints;
    reasons.push(`entities:${article.entities.join(",")}+${entityPoints}`);
  }

  const text = `${article.title} ${article.summary ?? ""}`;
  for (const [section, keywords] of Object.entries(interests.keywords)) {
    const matches = keywords.filter((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text));
    if (matches.length > 0) {
      const points = Math.min(15, matches.length * 3);
      score += points;
      reasons.push(`keywords:${section}+${points}`);
    }
  }

  if (/(breaking|urgent|developing|live|surges|plunges|sanction|ban|policy)/i.test(text)) {
    score += 8;
    reasons.push("happening+8");
  }

  if (article.source.type === "x") {
    const metrics = article.raw?.publicMetrics as Record<string, number> | undefined;
    const engagement =
      (metrics?.like_count ?? 0) +
      (metrics?.retweet_count ?? 0) * 2 +
      (metrics?.quote_count ?? 0) * 2 +
      (metrics?.reply_count ?? 0);
    const socialPoints = Math.min(20, Math.floor(Math.log10(engagement + 1) * 6));
    if (socialPoints > 0) {
      score += socialPoints;
      reasons.push(`x-engagement+${socialPoints}`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
