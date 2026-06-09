import type { NewsSource, RawFeedItem } from "../types.ts";

type XPost = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  entities?: {
    urls?: Array<{ expanded_url?: string; unwound_url?: string }>;
  };
};

type XUser = {
  id: string;
  name?: string;
  username?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count?: number;
  };
};

type XSearchResponse = {
  data?: XPost[];
  includes?: { users?: XUser[] };
  meta?: { next_token?: string; result_count?: number };
  errors?: Array<{ detail?: string; title?: string }>;
};

export async function fetchXRecentSearch(
  source: NewsSource,
  env = process.env
): Promise<RawFeedItem[]> {
  const token = env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("X_BEARER_TOKEN is not configured");
  }
  if (!source.query) {
    throw new Error(`X source ${source.id} is missing query`);
  }

  const maxResults = clamp(source.maxResults ?? 50, 10, 100);
  const maxPages = clamp(source.maxPages ?? 1, 1, 10);
  const items: RawFeedItem[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", source.query);
    url.searchParams.set("max_results", String(maxResults));
    url.searchParams.set("tweet.fields", "created_at,lang,public_metrics,author_id,entities");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username,verified,public_metrics");
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "personal-news-intelligence/0.2"
      }
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`X recent search failed with ${response.status}: ${body}`);
    }

    const result = JSON.parse(body) as XSearchResponse;
    if (result.errors?.length && !result.data?.length) {
      throw new Error(result.errors.map((error) => error.detail ?? error.title).join("; "));
    }

    items.push(...parseXSearchResponse(result, source));

    nextToken = result.meta?.next_token;
    if (!nextToken) break;
  }

  return items;
}

export function parseXSearchResponse(
  result: XSearchResponse,
  source: Pick<NewsSource, "id" | "name">
): RawFeedItem[] {
  const users = new Map((result.includes?.users ?? []).map((user) => [user.id, user]));
  return (result.data ?? []).map((post) => {
    const user = post.author_id ? users.get(post.author_id) : undefined;
    const username = user?.username;
    return {
      title: post.text,
      summary: post.text,
      url: username
        ? `https://x.com/${username}/status/${post.id}`
        : `https://x.com/i/web/status/${post.id}`,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: post.created_at,
      author: username ? `@${username}` : user?.name,
      raw: {
        format: "x",
        postId: post.id,
        language: post.lang,
        publicMetrics: post.public_metrics ?? {},
        author: user ?? {},
        expandedUrls: (post.entities?.urls ?? [])
          .map((entry) => entry.unwound_url ?? entry.expanded_url)
          .filter(Boolean)
      }
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
