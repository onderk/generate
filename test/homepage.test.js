"use strict";

// docs/README.md is just <LanguageSearch />, so this component is the whole
// homepage. It renders by mapping over `sections` and filtering cards by `type`,
// which means a card whose type is absent from `sections` silently renders
// nowhere -- no error, no blank space, just a missing row.

const test = require("node:test");
const assert = require("node:assert/strict");

const docs = require("./helpers/docs");

const { sections, cards, source } = docs.languageSearch();
const sidebar = docs.sidebarByKey();

test("every card type appears in sections", () => {
  const known = new Set(sections);
  const stranded = cards.filter((c) => !known.has(c.type));
  assert.deepEqual(
    stranded.map((c) => `${c.name} (type "${c.type}")`),
    [],
    "these cards can never render -- their type is not in sections[]"
  );
});

test("every section holds at least one card", () => {
  const used = new Set(cards.map((c) => c.type));
  const empty = sections.filter((s) => !used.has(s));
  assert.deepEqual(empty, [], `sections with no cards: ${empty.join(", ")}`);
});

test("every card url has a sidebar section and a directory", () => {
  const missingSidebar = cards.filter((c) => !sidebar[c.url]);
  assert.deepEqual(
    missingSidebar.map((c) => `${c.name} -> ${c.url}`),
    [],
    "cards pointing at a url with no sidebar config"
  );

  const onDisk = new Set(docs.topicDirs());
  const missingDir = cards.filter((c) => !onDisk.has(docs.topicFromKey(c.url)));
  assert.deepEqual(
    missingDir.map((c) => `${c.name} -> ${c.url}`),
    [],
    "cards pointing at a directory that does not exist"
  );
});

test("every topic directory has a card", () => {
  const carded = new Set(cards.map((c) => docs.topicFromKey(c.url)));
  const uncarded = docs.topicDirs().filter((t) => !carded.has(t));
  assert.deepEqual(uncarded, [], `topics with no homepage card: ${uncarded.join(", ")}`);
});

test("card ids and urls are unique", () => {
  const dupeIds = [];
  const seenIds = new Set();
  for (const c of cards) {
    if (seenIds.has(c.id)) dupeIds.push(`${c.id} (${c.name})`);
    seenIds.add(c.id);
  }
  assert.deepEqual(dupeIds, [], `duplicate card ids: ${dupeIds.join(", ")}`);

  const dupeUrls = [];
  const seenUrls = new Set();
  for (const c of cards) {
    if (seenUrls.has(c.url)) dupeUrls.push(c.url);
    seenUrls.add(c.url);
  }
  assert.deepEqual(dupeUrls, [], `duplicate card urls: ${dupeUrls.join(", ")}`);
});

test("lesson counts are derived, not hard-coded", () => {
  // Hand-maintained counts drifted on 37 of 46 cards before this test existed.
  // The component now reads them from $site.themeConfig.sidebar instead.
  assert.ok(
    !/topics:\s*\d+/.test(source),
    "found a hard-coded topics: <number> -- lesson counts must be derived from the sidebar"
  );
  assert.ok(
    /themeConfig/.test(source),
    "component should read lesson counts from $site.themeConfig.sidebar"
  );
});

test("derived lesson counts match the pages on disk", () => {
  // Mirrors the component's arithmetic: sidebar children minus the README and
  // contributors entries.
  const wrong = [];
  for (const c of cards) {
    const derived = sidebar[c.url].length - 2;
    const actual = docs
      .pagesIn(docs.topicFromKey(c.url))
      .filter((f) => !docs.NON_TOPIC_PAGES.has(f)).length;
    if (derived !== actual) wrong.push(`${c.name}: derived ${derived}, on disk ${actual}`);
  }
  assert.deepEqual(wrong, [], `lesson counts disagree with the filesystem:\n  ${wrong.join("\n  ")}`);
});
