"use strict";

// Most of the corpus was exported from Stack Overflow documentation, and the
// export left behind links to paths that only existed there (/documentation/...,
// /questions/tagged/...). Those 404 on devtut.github.io. This test stops any new
// ones from landing and tracks the existing set down to zero.
//
// External http(s) links are deliberately not fetched -- there are 16k of them
// and network checks do not belong in `npm test`.

const test = require("node:test");
const assert = require("node:assert/strict");

const docs = require("./helpers/docs");
const { assertSetRatchet } = require("./helpers/ratchet");

const pages = docs.allPages();
const baseline = docs.loadBaseline();

function collectBrokenLinks() {
  const found = {};
  for (const p of pages) {
    const broken = [];
    for (const link of docs.linksIn(docs.read(p))) {
      if (link.isImage || docs.EXTERNAL.test(link.href)) continue;
      if (docs.resolveLink(p.absPath, link.href) === null) broken.push(link.href);
    }
    if (broken.length) found[p.relPath] = broken;
  }
  return found;
}

test("internal links resolve, and broken ones do not increase", () => {
  assertSetRatchet(collectBrokenLinks(), baseline.brokenInternalLinks, "broken internal links");
});

test("every local image exists", () => {
  const missing = [];
  for (const p of pages) {
    for (const link of docs.linksIn(docs.read(p))) {
      if (!link.isImage) continue;
      if (/^(https?:|data:|\/\/)/i.test(link.href)) continue;
      if (docs.resolveImage(p.absPath, link.href) === null) {
        missing.push(`${p.relPath}:${link.line} -> ${link.href}`);
      }
    }
  }
  assert.deepEqual(missing, [], `images referenced but not on disk:\n  ${missing.join("\n  ")}`);
});

test("no link points at a Stack Overflow export path", () => {
  // These resolve to nothing and are the single largest source of dead links.
  // Anything already in the baseline is exempt until it is cleaned up.
  const allowed = new Set(
    Object.entries(baseline.brokenInternalLinks).flatMap(([file, hrefs]) =>
      hrefs.map((h) => `${file} -> ${h}`)
    )
  );
  const leftovers = [];
  for (const p of pages) {
    for (const link of docs.linksIn(docs.read(p))) {
      if (!/^\/(documentation|questions|users|tags)\//.test(link.href)) continue;
      const key = `${p.relPath} -> ${link.href}`;
      if (!allowed.has(key)) leftovers.push(key);
    }
  }
  assert.deepEqual(leftovers, [], `new Stack Overflow export links:\n  ${leftovers.join("\n  ")}`);
});

test("the site root README links only to real topics", () => {
  const rootReadme = pages.find((p) => p.relPath === "README.md");
  assert.ok(rootReadme, "docs/README.md should exist");
  const broken = docs
    .linksIn(docs.read(rootReadme))
    .filter((l) => !docs.EXTERNAL.test(l.href))
    .filter((l) => docs.resolveLink(rootReadme.absPath, l.href) === null)
    .map((l) => l.href);
  assert.deepEqual(broken, [], `broken links on the homepage: ${broken.join(", ")}`);
});
