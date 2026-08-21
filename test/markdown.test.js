"use strict";

// VuePress compiles each markdown file as a Vue template. Two things break the
// render silently: a fence that never closes (the rest of the page becomes code)
// and a {{ ... }} in prose (Vue tries to evaluate it as an expression).

const test = require("node:test");
const assert = require("node:assert/strict");

const docs = require("./helpers/docs");
const { assertCountRatchet } = require("./helpers/ratchet");

const pages = docs.allPages();
const baseline = docs.loadBaseline();

// The tags actually in use across the corpus. Keeping this closed catches typos
// like ```r` that would otherwise ship as an unhighlighted block.
const KNOWN_LANGUAGES = new Set([
  "bash", "c", "cpp", "cs", "css", "dotnet", "git", "haskell", "hs", "html",
  "java", "js", "json", "kotlin", "latex", "matlab", "objectivec", "perl",
  "php", "powershell", "py", "python", "r", "ruby", "sql", "swift", "text",
  "ts", "typescript", "vb", "xml", "yaml",
]);

test("no code fence is left open at end of file", () => {
  const unclosed = [];
  for (const p of pages) {
    const { strayOpeners, balanced } = docs.scanFences(docs.read(p));
    if (!balanced && strayOpeners.length === 0) unclosed.push(p.relPath);
  }
  assert.deepEqual(
    unclosed,
    [],
    `files ending inside a code fence:\n  ${unclosed.join("\n  ")}`
  );
});

test("no code fence swallows the page after it", () => {
  // The stricter of the two checks. A file can end balanced and still be broken:
  // an unclosed block just runs on until some later bare fence absorbs it, and
  // everything in between renders as code. A language-tagged fence opening while
  // a block is already open is the signature of exactly that.
  const stray = [];
  for (const p of pages) {
    for (const s of docs.scanFences(docs.read(p)).strayOpeners) {
      stray.push(`${p.relPath}:${s.line} -> ${s.raw}`);
    }
  }
  assert.deepEqual(
    stray,
    [],
    `code fence opened while another was still open -- the earlier block is missing its close:\n  ${stray.join("\n  ")}`
  );
});

test("every fence language tag is a known language", () => {
  const unknown = [];
  for (const p of pages) {
    for (const f of docs.scanFences(docs.read(p)).fences) {
      if (f.lang && !KNOWN_LANGUAGES.has(f.lang)) {
        unknown.push(`${p.relPath}:${f.line} -> \`\`\`${f.lang}`);
      }
    }
  }
  assert.deepEqual(unknown, [], `unrecognised fence languages:\n  ${unknown.join("\n  ")}`);
});

test("untagged code fences do not increase", () => {
  // 1,305 fences predate this suite and render without highlighting. They are
  // allowlisted per file so new ones fail while the debt can only shrink.
  const counts = {};
  for (const p of pages) {
    const n = docs.scanFences(docs.read(p)).fences.filter((f) => !f.lang).length;
    if (n > 0) counts[p.relPath] = n;
  }
  assertCountRatchet(counts, baseline.untaggedFences, "untagged code fences");
});

test("prose does not contain Vue interpolation", () => {
  const found = {};
  for (const p of pages) {
    const { lines, inFence } = docs.scanFences(docs.read(p));
    let n = 0;
    lines.forEach((line, i) => {
      if (inFence[i]) return;
      if (/^\s{4,}\S/.test(line)) return; // indented code block
      if (/\{\{[\s\S]*?\}\}/.test(line)) n++;
    });
    if (n > 0) found[p.relPath] = n;
  }
  assertCountRatchet(found, baseline.vueInterpolation, "{{ }} in prose");
});
