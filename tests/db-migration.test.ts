import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NewsDatabase } from "../src/db/index.ts";

test("migrates an existing stories table with evolution columns", async () => {
  const directory = await mkdtemp(join(tmpdir(), "news-db-"));
  const filename = join(directory, "news.db");
  const legacy = new DatabaseSync(filename);
  legacy.exec(`
    CREATE TABLE stories (
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
      updated_at TEXT NOT NULL
    );
  `);
  legacy.close();

  const db = await NewsDatabase.open(filename);
  await db.init();
  db.close();

  const migrated = new DatabaseSync(filename);
  const columns = migrated.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string }>;
  migrated.close();
  await rm(directory, { recursive: true, force: true });

  assert.ok(columns.some((column) => column.name === "status"));
  assert.ok(columns.some((column) => column.name === "update_count"));
});
