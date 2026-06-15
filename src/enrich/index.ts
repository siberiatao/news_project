import type { EnrichedStory, StoryCluster, StoryEnrichment } from "../types.ts";

export type EnrichmentConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
};

export function loadEnrichmentConfig(env = process.env): EnrichmentConfig {
  return {
    apiKey: env.ENRICHMENT_API_KEY,
    baseUrl: (env.ENRICHMENT_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: env.ENRICHMENT_MODEL ?? "gpt-4.1-mini",
    timeoutMs: Number.parseInt(env.ENRICHMENT_TIMEOUT_MS ?? "30000", 10)
  };
}

export async function enrichStories(
  stories: StoryCluster[],
  config = loadEnrichmentConfig()
): Promise<EnrichedStory[]> {
  if (!config.apiKey) {
    return stories.map((story) => ({ ...story, enrichment: fallbackEnrichment(story) }));
  }

  const enriched: EnrichedStory[] = [];
  for (const story of stories) {
    try {
      enriched.push({ ...story, enrichment: await enrichStory(story, config) });
    } catch {
      enriched.push({ ...story, enrichment: fallbackEnrichment(story) });
    }
  }
  return enriched;
}

export function fallbackEnrichment(story: StoryCluster): StoryEnrichment {
  const entities = story.entities.length > 0 ? story.entities.join("、") : sectionZh(story.section);
  return {
    storyKey: story.key,
    titleZh: `${entities}相关动态`,
    summaryZh: `这是一条关于${entities}的${sectionZh(story.section)}情报。建议结合英文原文核对具体事实和措辞。`,
    whyZh: story.sources.length > 1
      ? `该事件已有 ${story.sources.length} 个独立来源报道，可信度和影响范围值得关注。`
      : `该事件符合你的${sectionZh(story.section)}关注方向。`,
    watchZh: story.status === "developing"
      ? `该事件已有新进展。${watchZh(story.section)}`
      : watchZh(story.section),
    provider: "rule-based"
  };
}

async function enrichStory(story: StoryCluster, config: EnrichmentConfig): Promise<StoryEnrichment> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You translate and analyze news for a bilingual intelligence brief. Return JSON only."
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Translate faithfully into concise Simplified Chinese. Do not add unsupported facts.",
              requiredKeys: ["titleZh", "summaryZh", "whyZh", "watchZh"],
              title: story.title,
              summary: story.summary,
              section: story.section,
              score: story.score,
              status: story.status,
              updateCount: story.updateCount,
              newArticleCount: story.newArticleCount,
              sources: story.sources,
              entities: story.entities
            })
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`Enrichment failed with ${response.status}`);
    const result = await response.json() as ChatCompletion;
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("Enrichment response is empty");
    const parsed = JSON.parse(content) as Partial<StoryEnrichment>;
    if (!parsed.titleZh || !parsed.summaryZh || !parsed.whyZh || !parsed.watchZh) {
      throw new Error("Enrichment response is incomplete");
    }
    return {
      storyKey: story.key,
      titleZh: parsed.titleZh,
      summaryZh: parsed.summaryZh,
      whyZh: parsed.whyZh,
      watchZh: parsed.watchZh,
      provider: config.model
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function sectionZh(section: string): string {
  return ({
    global: "全球要闻",
    tech: "科技与人工智能",
    finance: "金融与市场",
    semiconductor: "半导体与供应链",
    x: "社交媒体动态",
    happening: "持续发展事件"
  } as Record<string, string>)[section] ?? "综合新闻";
}

function watchZh(section: string): string {
  return ({
    global: "继续观察权威来源的后续报道及其地区影响。",
    tech: "继续观察产品落地、竞争对手反应、监管变化和商业化进展。",
    finance: "继续观察市场定价、利率预期、业绩指引和行业传导效应。",
    semiconductor: "继续观察供应链、出口管制、资本开支、产能与客户影响。",
    x: "等待官方渠道或可信媒体进一步确认。",
    happening: "关注是否出现更多独立来源确认，以及政策或市场的后续反应。"
  } as Record<string, string>)[section] ?? "继续观察可信来源的后续更新。";
}
