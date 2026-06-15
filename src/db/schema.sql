CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  homepage TEXT,
  language TEXT,
  region TEXT,
  category TEXT,
  reliability REAL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fetch_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  item_count INTEGER DEFAULT 0,
  error TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  language TEXT,
  summary TEXT,
  hash TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  entities_json TEXT NOT NULL,
  section TEXT NOT NULL,
  score INTEGER NOT NULL,
  score_reasons_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section);
CREATE INDEX IF NOT EXISTS idx_articles_score ON articles(score);

CREATE TABLE IF NOT EXISTS briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  path TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  section TEXT NOT NULL,
  score INTEGER NOT NULL,
  score_reasons_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  entities_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  update_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_articles (
  story_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  similarity REAL NOT NULL,
  PRIMARY KEY (story_id, article_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stories_last_seen ON stories(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_stories_score ON stories(score);
