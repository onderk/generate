"use strict";

// Regenerates test/baseline.json from the current tree. Run it after fixing some
// of the allowlisted debt (`npm run test:baseline`), then commit the smaller
// baseline alongside the fix. Never run it to silence a genuinely new failure --
// the numbers are only meaningful while they move in one direction.

const fs = require("node:fs");
const path = require("node:path");

const docs = require("./helpers/docs");

const pages = docs.allPages();

const untaggedFences = {};
const vueInterpolation = {};
const brokenInternalLinks = {};

for (const page of pages) {
  const source = docs.read(page);

  const { fences, lines, inFence } = docs.scanFences(source);

  const untagged = fences.filter((f) => !f.lang).length;
  if (untagged > 0) untaggedFences[page.relPath] = untagged;

  let interpolations = 0;
  lines.forEach((line, i) => {
    if (inFence[i]) return;
    if (/^\s{4,}\S/.test(line)) return;
    if (/\{\{[\s\S]*?\}\}/.test(line)) interpolations++;
  });
  if (interpolations > 0) vueInterpolation[page.relPath] = interpolations;

  const broken = [];
  for (const link of docs.linksIn(source)) {
    if (link.isImage || docs.EXTERNAL.test(link.href)) continue;
    if (docs.resolveLink(page.absPath, link.href) === null) broken.push(link.href);
  }
  if (broken.length) brokenInternalLinks[page.relPath] = broken;
}

const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

const baseline = {
  _comment:
    "Legacy issues that predate the test suite. These counts may shrink, never grow. Regenerate with `npm run test:baseline` after fixing some.",
  untaggedFences: sortKeys(untaggedFences),
  vueInterpolation: sortKeys(vueInterpolation),
  brokenInternalLinks: sortKeys(brokenInternalLinks),
};

fs.writeFileSync(
  path.join(__dirname, "baseline.json"),
  `${JSON.stringify(baseline, null, 2)}\n`
);

const total = (obj) => Object.values(obj).reduce((a, b) => a + (Array.isArray(b) ? b.length : b), 0);
console.log(
  `baseline.json written: ${total(untaggedFences)} untagged fences, ` +
    `${total(vueInterpolation)} interpolations, ` +
    `${total(brokenInternalLinks)} broken internal links`
);
