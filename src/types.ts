export type SourceType = "rss" | "rsshub" | "x" | "web" | "manual";

export type NewsSource = {
  id: string;
  name: string;
  type: SourceType;
  url: string;
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
};

export type StoredArticle = NormalizedArticle & {
  id: number;
  createdAt: string;
};
