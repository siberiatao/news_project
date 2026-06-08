import { createHmac } from "node:crypto";
import type { BriefResult } from "../brief/index.ts";
import type { InterestsConfig, StoredArticle } from "../types.ts";

export type LarkDeliveryConfig = {
  webhookUrl?: string;
  secret?: string;
  dryRun: boolean;
  maxChars: number;
  locale: "zh_cn" | "en_us";
};

export type DeliveryResult = {
  skipped: boolean;
  dryRun: boolean;
  ok: boolean;
  status?: number;
  message: string;
};

type LarkPayload = {
  timestamp?: string;
  sign?: string;
  msg_type: "text";
  content: {
    text: string;
  };
};

export function loadLarkConfig(env = process.env): LarkDeliveryConfig {
  return {
    webhookUrl: env.LARK_WEBHOOK_URL,
    secret: env.LARK_WEBHOOK_SECRET,
    dryRun: env.LARK_DRY_RUN === "1" || env.LARK_DRY_RUN === "true",
    maxChars: Number.parseInt(env.LARK_MAX_CHARS ?? "6000", 10),
    locale: env.LARK_LOCALE === "en_us" ? "en_us" : "zh_cn"
  };
}

export async function sendBriefToLark(
  brief: BriefResult,
  articles: StoredArticle[],
  interests: InterestsConfig,
  config = loadLarkConfig()
): Promise<DeliveryResult> {
  if (!config.webhookUrl) {
    return {
      skipped: true,
      dryRun: false,
      ok: true,
      message: "Lark delivery skipped because LARK_WEBHOOK_URL is not set"
    };
  }

  const payload = buildLarkPayload(brief, articles, interests, config);

  if (config.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return {
      skipped: false,
      dryRun: true,
      ok: true,
      message: "Lark dry run payload printed"
    };
  }

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();

  if (!response.ok) {
    return {
      skipped: false,
      dryRun: false,
      ok: false,
      status: response.status,
      message: `Lark webhook failed with HTTP ${response.status}: ${text}`
    };
  }

  return {
    skipped: false,
    dryRun: false,
    ok: true,
    status: response.status,
    message: text || "Lark webhook sent"
  };
}

export function buildLarkPayload(
  brief: BriefResult,
  articles: StoredArticle[],
  interests: InterestsConfig,
  config: LarkDeliveryConfig
): LarkPayload {
  const text = buildLarkText(brief, articles, interests, config.maxChars);
  const payload: LarkPayload = {
    msg_type: "text",
    content: { text }
  };

  if (config.secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = createLarkSignature(timestamp, config.secret);
  }

  return payload;
}

export function createLarkSignature(timestamp: string, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

export function buildLarkText(
  brief: BriefResult,
  articles: StoredArticle[],
  interests: InterestsConfig,
  maxChars: number
): string {
  const lines: string[] = [];
  lines.push("每日新闻情报简报");
  lines.push(`窗口：${formatDate(brief.windowStart)} - ${formatDate(brief.windowEnd)}`);
  lines.push(`入选：${brief.itemCount} 条`);
  lines.push("");

  for (const section of interests.sectionOrder) {
    const sectionArticles = articles.filter((article) => article.section === section).slice(0, 5);
    if (sectionArticles.length === 0) continue;
    lines.push(`【${interests.sections[section] ?? section}】`);
    for (const article of sectionArticles) {
      const entities = article.entities.length > 0 ? `｜${article.entities.join(", ")}` : "";
      lines.push(`- ${article.title}`);
      lines.push(`  评分：${article.score}/100｜来源：${article.sourceName}${entities}`);
      lines.push(`  链接：${article.canonicalUrl}`);
    }
    lines.push("");
  }

  lines.push(`本地归档：${brief.path}`);

  const text = lines.join("\n");
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n...已截断，完整简报见本地归档：${brief.path}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
