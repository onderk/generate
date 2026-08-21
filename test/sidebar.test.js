"use strict";

// The sidebar in config.js is the site's navigation. Nothing else checks that it
// agrees with the files on disk, so drift shows up as a 404 in the nav or as a
// page nobody can reach.

const test = require("node:test");
const assert = require("node:assert/strict");

const docs = require("./helpers/docs");

const sidebar = docs.sidebarByKey();
const keys = Object.keys(sidebar);

test("every topic directory has a sidebar section", () => {
  const configured = new Set(keys.map(docs.topicFromKey));
  const missing = docs.topicDirs().filter((t) => !configured.has(t));
  assert.deepEqual(missing, [], `topic directories with no sidebar: ${missing.join(", ")}`);
});

test("every sidebar section has a topic directory", () => {
  const onDisk = new Set(docs.topicDirs());
  const dangling = keys.filter((k) => !onDisk.has(docs.topicFromKey(k)));
  assert.deepEqual(dangling, [], `sidebar sections with no directory: ${dangling.join(", ")}`);
});

test("every sidebar entry resolves to a page on disk", () => {
  const broken = [];
  for (const key of keys) {
    const onDisk = new Set(docs.slugsIn(docs.topicFromKey(key)));
    for (const slug of sidebar[key]) {
      if (!onDisk.has(slug)) broken.push(`${key}${slug || "(README)"}`);
    }
  }
  assert.deepEqual(broken, [], `sidebar links to missing pages:\n  ${broken.join("\n  ")}`);
});

test("every page on disk appears in its sidebar", () => {
  const orphans = [];
  for (const key of keys) {
    const listed = new Set(sidebar[key]);
    for (const slug of docs.slugsIn(docs.topicFromKey(key))) {
      if (!listed.has(slug)) orphans.push(`${key}${slug || "(README)"}`);
    }
  }
  assert.deepEqual(orphans, [], `pages unreachable from the sidebar:\n  ${orphans.join("\n  ")}`);
});

test("no sidebar entry is listed twice", () => {
  const dupes = [];
  for (const key of keys) {
    const seen = new Set();
    for (const slug of sidebar[key]) {
      if (seen.has(slug)) dupes.push(`${key}${slug || "(README)"}`);
      seen.add(slug);
    }
  }
  assert.deepEqual(dupes, [], `duplicate sidebar entries:\n  ${dupes.join("\n  ")}`);
});

test("every sidebar section opens with the landing page and ends with contributors", () => {
  // LanguageSearch derives its lesson counts from these two being present, so the
  // shape is load-bearing, not just cosmetic.
  for (const key of keys) {
    const slugs = sidebar[key];
    assert.equal(slugs[0], "", `${key} should start with the README entry`);
    assert.equal(
      slugs[slugs.length - 1],
      "contributors",
      `${key} should end with the contributors entry`
    );
  }
});
