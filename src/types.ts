export type SourceType = "rss" | "rsshub" | "x" | "web" | "manual";

export type NewsSource = {
  id: string;
  name: string;
  type: SourceType;
  url?: string;
  query?: string;
  maxResults?: number;
  maxPages?: number;
  homepage?: string;
  language?: string;
  region?: string;
  category?: string;
  reliability?: number;
  enabled: boolean;
};

export type RawFeedItem = {
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt?: string;
  summary?: string;
  author?: string;
  raw?: Record<string, unknown>;
};

export type NormalizedArticle = {
  sourceId: string;
  sourceName: string;
  canonicalUrl: string;
  title: string;
  author?: string;
  publishedAt: string;
  fetchedAt: string;
  language?: string;
  summary?: string;
  hash: string;
  tags: string[];
  entities: string[];
  section: string;
  score: number;
  scoreReasons: string[];
  metadata: Record<string, unknown>;
};

export type InterestsConfig = {
  briefTime: string;
  defaultWindowHours: number;
  minScoreForBrief: number;
  sectionOrder: string[];
  sections: Record<string, string>;
  domainWeights: Record<string, number>;
  sourceReliabilityWeight: number;
  keyEntities: string[];
  keywords: Record<string, string[]>;
  clustering: {
    similarityThreshold: number;
    maxHoursApart: number;
    minSharedTokens: number;
  };
};

export type StoredArticle = NormalizedArticle & {
  id: number;
  createdAt: string;
};

export type StoryCluster = {
  key: string;
  title: string;
  summary?: string;
  section: string;
  score: number;
  scoreReasons: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  tags: string[];
  entities: string[];
  sources: string[];
  articles: StoredArticle[];
};
