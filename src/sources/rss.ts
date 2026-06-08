import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NewsSource, RawFeedItem } from "../types.ts";

const execFileAsync = promisify(execFile);

export async function fetchRssSource(source: NewsSource): Promise<RawFeedItem[]> {
  const xml = await fetchFeedText(source.url);
  return parseFeed(xml, source);
}

async function fetchFeedText(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "personal-news-intelligence/0.1 (+local MVP)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    const fetchMessage = error instanceof Error ? error.message : String(error);
    try {
      const { stdout } = await execFileAsync("curl", [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
        "--user-agent",
        "personal-news-intelligence/0.1 (+local MVP)",
        url
      ], { maxBuffer: 10 * 1024 * 1024 });
      return stdout;
    } catch (curlError) {
      const curlMessage = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`fetch failed (${fetchMessage}); curl fallback failed (${curlMessage})`);
    }
  }
}

export function parseFeed(xml: string, source: Pick<NewsSource, "id" | "name">): RawFeedItem[] {
  const rssItems = extractBlocks(xml, "item").map((block) => parseRssItem(block, source));
  if (rssItems.length > 0) {
    return rssItems.filter(hasRequiredFields);
  }

  return extractBlocks(xml, "entry").map((block) => parseAtomEntry(block, source)).filter(hasRequiredFields);
}

function parseRssItem(block: string, source: Pick<NewsSource, "id" | "name">): RawFeedItem {
  return {
    title: textTag(block, "title"),
    url: textTag(block, "link") || attrTag(block, "link", "href") || textTag(block, "guid"),
    sourceId: source.id,
    sourceName: source.name,
    publishedAt: textTag(block, "pubDate") || textTag(block, "dc:date"),
    summary: textTag(block, "description") || textTag(block, "content:encoded"),
    author: textTag(block, "author") || textTag(block, "dc:creator"),
    raw: { format: "rss" }
  };
}

function parseAtomEntry(block: string, source: Pick<NewsSource, "id" | "name">): RawFeedItem {
  return {
    title: textTag(block, "title"),
    url: attrTag(block, "link", "href") || textTag(block, "id"),
    sourceId: source.id,
    sourceName: source.name,
    publishedAt: textTag(block, "published") || textTag(block, "updated"),
    summary: textTag(block, "summary") || textTag(block, "content"),
    author: nestedTextTag(block, "author", "name"),
    raw: { format: "atom" }
  };
}

function extractBlocks(xml: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? "");
}

function textTag(block: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const value = block.match(pattern)?.[1] ?? "";
  return cleanXmlText(value);
}

function nestedTextTag(block: string, parent: string, child: string): string {
  const parentBlock = extractBlocks(block, parent)[0] ?? "";
  return textTag(parentBlock, child);
}

function attrTag(block: string, tag: string, attr: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttr = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escapedTag}\\b[^>]*\\s${escapedAttr}=["']([^"']+)["'][^>]*\\/?>`, "i");
  return decodeXml(block.match(pattern)?.[1] ?? "").trim();
}

function cleanXmlText(value: string): string {
  return decodeXml(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function hasRequiredFields(item: RawFeedItem): boolean {
  return item.title.length > 0 && item.url.length > 0;
}
