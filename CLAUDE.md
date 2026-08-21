# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**DevTut** — a [VuePress 1.x](https://v1.vuepress.vuejs.org/) static documentation site published to
<https://devtut.github.io>. The content is 3,500+ example-driven lessons compiled from the Stack
Overflow Documentation archive (text is CC BY-SA; each topic credits its authors in
`contributors.md`).

There is **no application code** here beyond the VuePress config and one Vue component. Practically
every change is either a markdown edit or a sidebar edit.

`origin` is `onderk/generate`, a fork. Upstream is `devtut/generate`, which is what the site's
"Edit this page on GitHub" links and `deploy.sh` still point at.

## Commands

```bash
yarn install            # or npm install
yarn docs:dev           # vuepress dev docs  — local server with hot reload
yarn docs:build         # vuepress build docs — output to docs/.vuepress/dist/ (gitignored)
sh deploy.sh            # build + force-push to the live site (see warning below)
```

- **No tests, no linter, no CI.** `npm test` is a stub that exits 1. There is no `.github/`.
  Verification means: the build completes, and the page looks right in `docs:dev`.
- **`yarn docs:build` needs two `NODE_OPTIONS` flags on a modern Node.** Both were verified on
  Node 22; use:
  ```bash
  NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=16384" yarn docs:build
  ```
  - `--openssl-legacy-provider`: the tree pins `webpack@4.44.2` (`yarn.lock:7765`), which hashes
    with MD4. Without the flag the build dies immediately on Node 17+ with
    `ERR_OSSL_EVP_UNSUPPORTED` / `error:0308010C:digital envelope routines::unsupported`. Using
    Node 16 instead also works.
  - `--max-old-space-size`: this is not optional at 3,500 pages. Both webpack passes finish
    (~8 min, ~130 MB of assets), then the **`Rendering static HTML...` phase** exhausts the heap:
    it OOMs at both 8192 and 12288 with `FATAL ERROR: Ineffective mark-compacts near heap limit`.
    `deploy.sh` uses 16384, so a full build wants a machine with **more than 16 GB of RAM** —
    expect it to fail on a smaller box regardless of flags.
- **Prefer `yarn docs:dev` for verification.** It compiles on demand, so it sidesteps the render
  phase entirely and is the practical way to check a content change.
- ⚠️ **Do not run `deploy.sh` unless explicitly asked.** It force-pushes the built `dist/` to
  `git@github.com:devtut/devtut.github.io.git master` — the upstream project's live site, not this
  fork's.

## Layout

```
docs/README.md                                home page (home: true frontmatter + <LanguageSearch/>)
docs/<topic>/README.md                        per-topic "Disclaimer" landing page
docs/<topic>/<slug>.md                        one lesson per file, lowercase-hyphenated
docs/<topic>/contributors.md                  Stack Overflow credit list, always last in the sidebar
docs/.vuepress/config.js                      site config + the entire sidebar (4,057 lines)
docs/.vuepress/components/LanguageSearch.vue  homepage card grid (hand-maintained)
docs/.vuepress/styles/index.styl              two small overrides
docs/.vuepress/public/                        favicons, logo, webmanifest
```

46 topic directories. Largest: `android` (269 files), `ios` (209), `python` (206), `java` (186).
Every topic directory has both a `README.md` and a `contributors.md` — no exceptions.

## Page conventions

A lesson page looks like this (`docs/python/dictionary.md`):

````markdown
---
metaTitle: "Python - Dictionary"
description: "Introduction to Dictionary, Avoiding KeyError Exceptions, Iterating Over a Dictionary"
---

# Dictionary

## Introduction to Dictionary

Prose, then examples.

```py
d = {'key': 'value'}
```
````

- **Frontmatter is exactly two keys.** `metaTitle: "<Topic> - <Page Title>"` and `description:`, a
  comma-joined list of the page's `##` headings. Both are read by `vuepress-plugin-seo` (configured
  at the bottom of `config.js`) to generate meta and Open Graph tags — keep `description` in sync
  when you add or rename an `##` section.
- **Heading structure:** one `# H1` matching the page title, then `##` per example. Many pages carry
  Stack Overflow export sections `#### Syntax` (756 pages), `#### Parameters` (371) and
  `#### Remarks` (1,437) — leave those headings at `####`.
- **The only container in use is `::: tip … :::`** (46 uses, all in `README.md` / `contributors.md`).

### Code fence languages

Each topic directory uses **one consistent fence tag**, chosen so Prism highlights it. Two recent
commits ("Fix syntax highlighting", "update syntax highlighting for algorithm") were fixes to this,
so match the directory rather than guessing:

| Fence | Topic directories |
| --- | --- |
| `py` | python |
| `js` | javascript, nodejs, jquery, angular2, angularjs, reactjs, reactnative, mongodb |
| `java` | java, android, spring |
| `cs` | csharp, entityframework, xamarin |
| `cpp` | cpp, algorithm |
| `c` | c |
| `swift` | swift, ios |
| `sql` | sql, mysql, mssql, postgresql, oracle |
| `ruby` | ruby, rubyonrails |
| `vb` | vbnet, vba, excelvba |
| `bash` | bash, linux |
| `hs` | haskell |
| `ts` | typescript |
| `dotnet` | dotnet |
| `git` | git |
| own name | php, r, perl, matlab, powershell, kotlin, objectivec, css, html, latex |

Mixed-content topics (`html`, `css`) use the right tag per snippet — e.g. `html` pages contain `js`
fences for scripts.

## Adding, renaming or removing a page

**A new `.md` file is invisible until `docs/.vuepress/config.js` lists it.** The sidebar is fully
hand-maintained, one section per topic keyed `"/<topic>/"`:

```js
"/linux/": [
  {
    title: "Linux",
    collapsable: false,
    children: [
      ["", "Disclaimer"],          // ← the topic README.md; leave it first
      "getting-started-with-gnu-linux",
      "shell",
      // ... new entries go here
      "contributors",              // ← always stays last
    ],
  },
],
```

Checklist:

1. Create `docs/<topic>/<slug>.md` with the two frontmatter keys and the topic's fence language.
2. Add `"<slug>",` to that topic's `children` array — filename **without** `.md`, placed above the
   trailing `"contributors",`.
3. Renaming a file means renaming its sidebar entry **in the same commit**, or the link 404s.
4. Deleting a file means deleting its sidebar entry.
5. If the topic's page count changed, update that topic's `topics:` number in
   `LanguageSearch.vue` (see below).

## Homepage card grid — `LanguageSearch.vue`

`docs/README.md` renders `<LanguageSearch />`. The component holds two hand-maintained arrays:

- `languages[]` — one entry per topic: `{ id, name, topics, url, type }`, where `topics` is a
  page count shown as "Master N lessons →" and `url` is `/<topic>/`.
- `sections[]` — the display order of `type` groups.

**A topic whose `type` is not listed in `sections[]` never renders.** Types currently in use:
Essential, Programming Language, Database Technology, JavaScript Technology, Mobile Technology,
Framework, Visual Basic, Terminal.

## Site config notes

In `docs/.vuepress/config.js`:

- `themeConfig.repo: "devtut/generate"` with `editLinks: true` and `docsDir: "docs"` — edit links
  point at upstream, not this fork.
- Algolia DocSearch (`indexName: "devtut"`) powers the top-bar search; `lastUpdated: false`,
  `smoothScroll: true`, `shouldPrefetch: () => false`.
- No `nav:` is defined — the top bar is just search plus the repo link.
- Plugins: `@vuepress/google-analytics`, `@vuepress/back-to-top`, `sitemap`
  (`hostname: https://devtut.github.io`), and `seo` (maps `$page.frontmatter.metaTitle` /
  `.description` onto meta tags).

## Known issues

Verified against the tree; **documented, not fixed** — don't "helpfully" repair these as a side
effect of unrelated work, but they're accurate if someone asks for a fix.

- `sections[]` in `LanguageSearch.vue` omits `"Terminal"`, so the **Linux, Bash and PowerShell cards
  never render** on the homepage even though their `languages[]` entries exist.
- **16 of 46** `topics:` counts in `LanguageSearch.vue` are stale. Largest gaps: `objectivec` claims
  34 (actual 51), `xamarin` claims 79 (actual 72), `ios` 210 (207), `rubyonrails` 74 (72). Others
  off by one or two: python, php, java, csharp, ruby, perl, oracle, mongodb, angular2, html, dotnet,
  android.
- **Duplicate sidebar entries** render the same link twice in 10 topics: `c` (`common-pitfalls`,
  `testing-frameworks`, `threads-native`, `valgrind`), `ios` (3), `mongodb` (2), `rubyonrails` (2),
  and one each in `dotnet`, `html`, `perl`, `oracle`, `android`, `xamarin`.
- **Two orphan pages** exist on disk but appear in no sidebar:
  `docs/c/command-line-arguments.md` and `docs/xamarin/xamarin-gesture.md`.
- Good news: **zero broken sidebar links** — every sidebar entry resolves to a real file. Keep it
  that way.

Quick check before committing a sidebar change:

```bash
python3 - <<'EOF'
import re, os
src = open('docs/.vuepress/config.js').read()
for key, body in re.findall(r'"(/[a-z0-9]+/)": \[(.*?)\n      \],', src, re.S):
    topic = key.strip('/')
    slugs = re.findall(r'"([a-z0-9\-]+)"', body)
    files = {f[:-3] for f in os.listdir('docs/' + topic) if f.endswith('.md')} - {'README'}
    missing = [s for s in slugs if s not in files]
    if missing:
        print(topic, 'BROKEN LINKS:', missing)
EOF
```

## Git workflow

- Work on the designated feature branch; push with `git push -u origin <branch>`.
- Do not open a pull request unless explicitly asked.
- Content edits are small and self-contained — one topic per commit keeps review sane, given how
  large `config.js` diffs can get.
