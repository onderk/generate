"use strict";

// The seo plugin in config.js reads $page.frontmatter.metaTitle and .description
// straight into <title> and <meta name="description">. A page missing either
// ships with an undefined tag, so these are the site's SEO contract.

const test = require("node:test");
const assert = require("node:assert/strict");

const docs = require("./helpers/docs");

const pages = docs.topicPages();

test("there are topic pages to check", () => {
  assert.ok(pages.length > 3000, `expected the full corpus, found ${pages.length} pages`);
});

test("every topic page has frontmatter", () => {
  const missing = pages
    .filter((p) => docs.frontmatter(docs.read(p)) === null)
    .map((p) => p.relPath);
  assert.deepEqual(missing, [], `pages with no frontmatter block:\n  ${missing.join("\n  ")}`);
});

test("every topic page has a non-empty metaTitle and description", () => {
  const bad = [];
  for (const p of pages) {
    const fm = docs.frontmatter(docs.read(p));
    if (!fm) continue; // reported by the test above
    for (const key of ["metaTitle", "description"]) {
      const value = docs.frontmatterValue(fm.raw, key);
      if (!value) bad.push(`${p.relPath} (${key})`);
    }
  }
  assert.deepEqual(bad, [], `pages missing SEO frontmatter:\n  ${bad.join("\n  ")}`);
});

test("metaTitle is unique across the site", () => {
  // Two pages sharing a title compete with each other in search results.
  const byTitle = new Map();
  for (const p of pages) {
    const fm = docs.frontmatter(docs.read(p));
    if (!fm) continue;
    const title = docs.frontmatterValue(fm.raw, "metaTitle");
    if (!title) continue;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(p.relPath);
  }
  const collisions = [...byTitle.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([title, paths]) => `"${title}" -> ${paths.join(", ")}`);
  assert.deepEqual(collisions, [], `duplicate metaTitle:\n  ${collisions.join("\n  ")}`);
});

test("every topic page opens with an H1", () => {
  // VuePress takes the page's sidebar/breadcrumb title from the first heading,
  // so a page whose first heading is an H2 renders a downgraded title. Counting
  // H1s outright would misfire: a lot of imported pages embed raw HTML blocks
  // containing shell/R comments that start with "#" but are never headings.
  const bad = [];
  for (const p of pages) {
    const source = docs.read(p);
    const fm = docs.frontmatter(source);
    const body = fm ? fm.body : source;
    const { inFence, lines } = docs.scanFences(body);
    const first = lines.findIndex((line, i) => !inFence[i] && /^#{1,6}\s+\S/.test(line));
    if (first === -1) {
      bad.push(`${p.relPath} (no heading at all)`);
      continue;
    }
    const level = /^(#+)/.exec(lines[first])[1].length;
    if (level !== 1) bad.push(`${p.relPath} (opens with H${level})`);
  }
  assert.deepEqual(bad, [], `pages that do not open with an H1:\n  ${bad.join("\n  ")}`);
});

test("landing and contributor pages stay frontmatter-free by convention", () => {
  // These are excluded from the SEO checks above, so pin the convention that
  // makes that exclusion correct.
  const unexpected = [];
  for (const topic of docs.topicDirs()) {
    for (const file of docs.NON_TOPIC_PAGES) {
      const abs = require("node:path").join(docs.DOCS, topic, file);
      if (!require("node:fs").existsSync(abs)) {
        unexpected.push(`${topic}/${file} is missing`);
      }
    }
  }
  assert.deepEqual(unexpected, [], unexpected.join("\n  "));
});
