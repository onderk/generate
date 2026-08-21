"use strict";

// Everything the test suite knows about how docs/ is laid out lives here, so the
// individual test files stay declarative. Repo conventions encoded below:
//
//   docs/<topic>/          one directory per topic, 46 of them
//   docs/<topic>/README.md the topic landing page, no frontmatter by design
//   docs/<topic>/contributors.md  credits page, no frontmatter by design
//   docs/<topic>/<slug>.md a topic page, always has metaTitle + description
//   docs/.vuepress/        config and components, not a topic
//
// The sidebar in config.js mirrors that: one group per topic whose children are
// slugs, with the landing page written as the pair ["", "Disclaimer"].

const fs = require("fs");
const path = require("path");

const DOCS = path.join(__dirname, "..", "..", "docs");
const CONFIG = path.join(DOCS, ".vuepress", "config.js");
const COMPONENT = path.join(
  DOCS,
  ".vuepress",
  "components",
  "LanguageSearch.vue"
);

// Pages that live in every topic directory but are not lesson content.
const NON_TOPIC_PAGES = new Set(["README.md", "contributors.md"]);

function topicDirs() {
  return fs
    .readdirSync(DOCS)
    .filter(
      (name) =>
        !name.startsWith(".") && fs.statSync(path.join(DOCS, name)).isDirectory()
    )
    .sort();
}

// Every .md under a topic dir, including README and contributors.
function pagesIn(topic) {
  return fs
    .readdirSync(path.join(DOCS, topic))
    .filter((f) => f.endsWith(".md"))
    .sort();
}

// Slugs as the sidebar spells them: README becomes "".
function slugsIn(topic) {
  return pagesIn(topic).map((f) =>
    f === "README.md" ? "" : f.replace(/\.md$/, "")
  );
}

// Every lesson page in the repo, as { topic, file, slug, absPath, relPath }.
function topicPages() {
  const out = [];
  for (const topic of topicDirs()) {
    for (const file of pagesIn(topic)) {
      if (NON_TOPIC_PAGES.has(file)) continue;
      out.push({
        topic,
        file,
        slug: file.replace(/\.md$/, ""),
        absPath: path.join(DOCS, topic, file),
        relPath: `${topic}/${file}`,
      });
    }
  }
  return out;
}

// Every .md in the repo including landing/contributor pages and docs/README.md.
function allPages() {
  const out = [];
  for (const topic of topicDirs()) {
    for (const file of pagesIn(topic)) {
      out.push({
        topic,
        file,
        absPath: path.join(DOCS, topic, file),
        relPath: `${topic}/${file}`,
      });
    }
  }
  out.push({
    topic: null,
    file: "README.md",
    absPath: path.join(DOCS, "README.md"),
    relPath: "README.md",
  });
  return out;
}

function read(page) {
  return fs.readFileSync(page.absPath, "utf8");
}

// Returns { raw, body } where raw is the frontmatter block text, or null when
// the page has no frontmatter at all.
function frontmatter(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) return null;
  return { raw: m[1], body: source.slice(m[0].length) };
}

// Reads a single scalar key out of a frontmatter block. Values in this repo are
// always double-quoted single-line strings, so a full YAML parser is overkill.
function frontmatterValue(raw, key) {
  const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(raw);
  if (!m) return null;
  return m[1].trim().replace(/^"(.*)"$/, "$1");
}

// Splits a page into fence-delimited runs. Returns { fences, lines } where each
// fence is { line, lang, raw } and lines is a per-line array flagging whether
// that line sits inside a fenced block.
function scanFences(source) {
  const lines = source.split("\n");
  const fences = [];
  const inFence = new Array(lines.length).fill(false);
  // CommonMark: a fence is closed only by a run of at least as many backticks
  // with no info string. That is what lets a page document markdown itself by
  // wrapping ``` samples in a ```` fence.
  let openLength = 0;
  // A language-tagged fence found while a block is already open means the
  // previous block was never closed. Parity alone cannot see this: the stray
  // block simply runs on until some later bare fence absorbs it, leaving the
  // file balanced but rendering everything in between as code.
  const strayOpeners = [];

  lines.forEach((text, i) => {
    const m = /^(\s*)(`{3,})(.*)$/.exec(text);
    if (m) {
      const length = m[2].length;
      const info = m[3].trim();
      if (openLength === 0) {
        openLength = length;
        fences.push({ line: i + 1, lang: info, raw: text });
        inFence[i] = true;
        return;
      }
      if (length >= openLength && info === "") {
        openLength = 0;
        inFence[i] = true;
        return;
      }
      // A shorter run inside a longer fence is ordinary content -- that is how
      // a page quotes markdown at all -- so only same-or-longer runs count.
      if (info !== "" && length >= openLength) {
        strayOpeners.push({ line: i + 1, raw: text.trim() });
      }
    }
    inFence[i] = openLength > 0;
  });

  return {
    fences,
    inFence,
    lines,
    strayOpeners,
    balanced: openLength === 0 && strayOpeners.length === 0,
  };
}

// Sidebar children flattened to slugs. A child is either "slug" or ["slug", "Title"].
function sidebarSlugs(children) {
  return children.map((c) => (Array.isArray(c) ? c[0] : c));
}

function loadConfig() {
  delete require.cache[require.resolve(CONFIG)];
  return require(CONFIG);
}

// { "/python/": ["", "getting-started-...", ...], ... }
function sidebarByKey() {
  const sidebar = loadConfig().themeConfig.sidebar;
  const out = {};
  for (const key of Object.keys(sidebar)) {
    const slugs = [];
    for (const group of sidebar[key]) {
      slugs.push(...sidebarSlugs(group.children || []));
    }
    out[key] = slugs;
  }
  return out;
}

// "/python/" -> "python"
function topicFromKey(key) {
  return key.replace(/^\/|\/$/g, "");
}

// The component's data is a plain literal, so parsing the source is enough to
// assert the invariants that actually break (a card typed with a section name
// that does not exist renders nowhere). Avoids pulling in a Vue test runtime.
function languageSearch() {
  const src = fs.readFileSync(COMPONENT, "utf8");
  const sectionsBlock = /sections:\s*\[([\s\S]*?)\]/.exec(src);
  if (!sectionsBlock) throw new Error("could not find sections[] in LanguageSearch.vue");
  const sections = (sectionsBlock[1].match(/"([^"]+)"/g) || []).map((s) =>
    s.slice(1, -1)
  );

  const cards = [];
  const re =
    /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*url:\s*"([^"]+)",\s*type:\s*"([^"]+)"\s*\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    cards.push({ id: Number(m[1]), name: m[2], url: m[3], type: m[4] });
  }
  if (cards.length === 0) throw new Error("could not parse any language cards from LanguageSearch.vue");
  return { sections, cards, source: src };
}

// Blanks out spans that look like links but are not: inline code, and HTML
// comments. Replacing with spaces rather than deleting keeps column offsets, so
// reported line numbers stay right.
function maskNonLinkSpans(line) {
  return line
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/(`+)(?:(?!\1)[\s\S])*\1/g, (m) => " ".repeat(m.length));
}

// Reads a markdown link destination starting at the "(" and returns
// { href, end } or null. Handles <...> destinations and the balanced
// parentheses that show up constantly in MSDN and Wikipedia urls.
function readDestination(text, open) {
  if (text[open] !== "(") return null;
  let i = open + 1;
  while (i < text.length && /\s/.test(text[i])) i++;

  if (text[i] === "<") {
    const close = text.indexOf(">", i + 1);
    if (close === -1) return null;
    const end = text.indexOf(")", close);
    if (end === -1) return null;
    return { href: text.slice(i + 1, close), end };
  }

  let depth = 1;
  const start = i;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        // A title may follow the url: [x](/url "Title")
        const raw = text.slice(start, i).trim();
        return { href: raw.split(/\s+/)[0], end: i };
      }
    }
  }
  return null;
}

// Markdown links outside code fences, as { href, line, isImage }. Links inside a
// fenced block are sample code, not navigation, so they are skipped.
function linksIn(source) {
  const { lines, inFence } = scanFences(source);
  const out = [];
  lines.forEach((raw, i) => {
    if (inFence[i]) return;
    const line = maskNonLinkSpans(raw);
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== "[") continue;
      const close = line.indexOf("]", j + 1);
      if (close === -1) break;
      // Empty link text is almost always an artifact (`operator[](n)`), not a link.
      if (close === j + 1) { j = close; continue; }
      const dest = readDestination(line, close + 1);
      if (!dest) { j = close; continue; }
      out.push({
        href: dest.href,
        line: i + 1,
        isImage: j > 0 && line[j - 1] === "!",
      });
      j = dest.end;
    }
  });
  return out;
}

const EXTERNAL = /^(https?:|mailto:|tel:|ftp:|data:|\/\/|#)/i;

// Resolves an internal href to a file on disk, or null if nothing matches.
// A doc link may be written as ./foo, ./foo.md, ./foo.html or a directory.
function resolveLink(fromAbsPath, href) {
  const target = href.split("#")[0].split("?")[0];
  if (!target) return fromAbsPath; // pure anchor
  const base = target.startsWith("/")
    ? path.join(DOCS, target)
    : path.resolve(path.dirname(fromAbsPath), target);
  const candidates = [
    base,
    `${base}.md`,
    base.replace(/\.html$/, ".md"),
    path.join(base, "README.md"),
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

// Images resolve against docs/.vuepress/public when written absolute, since
// that is what VuePress copies to the site root.
function resolveImage(fromAbsPath, href) {
  const target = href.split("#")[0].split("?")[0];
  if (!target) return null;
  const base = target.startsWith("/")
    ? path.join(DOCS, ".vuepress", "public", target)
    : path.resolve(path.dirname(fromAbsPath), target);
  return fs.existsSync(base) ? base : null;
}

function loadBaseline() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "baseline.json"), "utf8")
  );
}

module.exports = {
  DOCS,
  CONFIG,
  COMPONENT,
  NON_TOPIC_PAGES,
  topicDirs,
  pagesIn,
  slugsIn,
  topicPages,
  allPages,
  read,
  frontmatter,
  frontmatterValue,
  scanFences,
  sidebarSlugs,
  loadConfig,
  sidebarByKey,
  topicFromKey,
  languageSearch,
  linksIn,
  resolveLink,
  resolveImage,
  EXTERNAL,
  loadBaseline,
};
