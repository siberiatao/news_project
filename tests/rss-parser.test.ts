import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../src/sources/rss.ts";

test("parses RSS feed items", () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>NVIDIA announces new AI chip</title>
      <link>https://example.com/news?utm_source=test</link>
      <pubDate>Mon, 08 Jun 2026 00:00:00 GMT</pubDate>
      <description><![CDATA[The company shared details.]]></description>
    </item>
  </channel></rss>`;

  const items = parseFeed(xml, { id: "sample", name: "Sample" });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "NVIDIA announces new AI chip");
  assert.equal(items[0].url, "https://example.com/news?utm_source=test");
  assert.equal(items[0].sourceName, "Sample");
});

test("parses Atom feed entries", () => {
  const xml = `<?xml version="1.0"?>
  <feed>
    <entry>
      <title>OpenAI updates model platform</title>
      <link href="https://example.com/atom-entry" />
      <updated>2026-06-08T01:00:00Z</updated>
      <summary>Platform update details.</summary>
      <author><name>Reporter</name></author>
    </entry>
  </feed>`;

  const items = parseFeed(xml, { id: "atom", name: "Atom" });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "OpenAI updates model platform");
  assert.equal(items[0].url, "https://example.com/atom-entry");
  assert.equal(items[0].author, "Reporter");
});
