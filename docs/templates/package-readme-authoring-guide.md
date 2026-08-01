# Package README — Authoring Guide

The rules behind [`package-readme.template.md`](./package-readme.template.md). The template is
the **clean skeleton** you copy; this guide is the **why and how**. Read it once, then work from
the template. Treat package READMEs as a **documentation design system** — every package inherits
the same structure, so moving between `@nextrush/core`, `@nextrush/router`, and any future package
feels seamless, the way a good UI reuses patterns across screens.

> [!IMPORTANT]
> The README is **published to npm** — it is the package's landing page, not an afterthought.
> Most developers decide whether to install after a **30-second scan**. Design for the scan.

---

## The five questions the first screen must answer

If a developer can't answer all five within ~30 seconds of scrolling, the README is failing:

1. **What is this?** — title + tagline + At a glance
2. **Should I use it?** — At a glance + When to use
3. **How do I install it?** — Installation
4. **Can I copy an example?** — Quick start
5. **Is it production-ready?** — support tier + At a glance (stability, tier)

This is why the order front-loads identity → decision → install → copy-paste.

---

## Standard section order (freeze this)

Every **Tier 1** package follows this exact sequence. Tier 2 keeps the same order, dropping the
`(opt)` sections it doesn't need; Tier 3 keeps only the **bold** ones.

| # | Section | Tier | Answers |
|---|---------|------|---------|
| 1 | **Title** `@nextrush/NAME` | all | What is this |
| 2 | **Tagline** (blockquote) | all | What is this |
| 3 | **Badges** | all | Trust signals |
| 4 | **Package identity** (table) ⭐ | all | Type · Status · Support tier · Runtime · Requires · Introduced · Maintained |
| 5 | **At a glance** ⭐ | 1–2 | What am I getting (capabilities) |
| 6 | Table of contents (opt, collapsible) | 1 | Navigation |
| 7 | **The problem** | 1–2 | Why this exists |
| 8 | When to use / not use ⭐ | 1–2 | Should I use it |
| 9 | **Installation** | all | How to install |
| 10 | **Quick start** | all | Copy-paste-run |
| 11 | Features ⭐ | 1–2 | What can it do |
| 12 | Mental model | 1–2 | How it thinks |
| 13 | Usage (task-based) | 1–2 | Real-project use |
| 14 | **API reference** (with `Since`) | all | The full surface |
| 15 | Options | 1–2 | Configuration |
| 16 | Performance | **perf-relevant only** | Can I trust the speed |
| 17 | **Compatibility** (framework ver + peer deps) | all | Versions / runtimes / ESM |
| 18 | Troubleshooting | 1–2 | What if it breaks |
| 19 | FAQ | 1–2 | Repeated questions |
| 20 | **Ecosystem** (you-are-here · Works with · See also) | all | Where am I / what's next |
| 21 | **Architecture** (link) | all | How it works |
| 22 | **Need help?** (learn · ask · report · contribute) | all | Go deeper / get unstuck |
| 23 | **License** | all | Legal |

**Package identity block (row 4):** a compact 2-column table right after the badges — Package type,
Status, Support tier, Runtime, Requires, Introduced (the version it landed in), Maintained. It
gives readers instant confidence and replaces the old standalone "support tier" line. `At a glance`
(row 5) then stays purely *capabilities* (zero-dep, tree-shakable, typed, bundle size) with no
overlap.

**Performance is NOT universal (row 16):** include it ONLY for perf-relevant packages —
`router`, `core`, `body-parser`, `serializer`, `static`, `adapters`, `compression`, `stream`.
Nobody asks "how fast are cookies?" — every other package DELETES the section entirely (heading
included), never leaves an empty one. Any number must be reproducible from `apps/benchmark`.

**Compatibility carries framework version + peer deps (row 17):** a version table (NextRush `3.x`,
Node `>=22`, TS `>=5.x`) plus — especially for middleware — explicit **Peer dependencies**,
**Works with** (ordering, e.g. "runs after body-parser"), and **Incompatible with**.

**Ecosystem = three distinct things (row 20):** the "← you are here" ASCII tree (renders on npm),
**Works well with** (typical companions), and **See also** (common *next steps*, not dependencies —
e.g. a body-parser reader's next stop is often validation/openapi).

**Footer is a "Need help?" CTA (row 22):** readers reach the bottom because they still have a
question. Give them Learn (Documentation, Wiki, Architecture, RFCs, Benchmarks) and Ask/Report
(GitHub Issues), then Contribute and the license line. As of now the repo has **no Discord and
GitHub Discussions is disabled** — link only verified channels; add Discord/Discussions rows only
if they get enabled, never a dead link.

**Why Installation + Quick start come before Mental model:** npm users want copy → paste → try
*first*, then get curious about how it works. Selling (Performance, Features) sits above
Troubleshooting because most visitors are deciding to adopt, not debugging.

**Reading rhythm:** don't let every section be *heading → paragraph → code*. Alternate: some
sections are a bullet list, some a table, some a callout, some a diagram. Variation keeps a long
README scannable. Use `---` between major concepts.

---

## Package tiers (depth control)

From `.kiro/steering/documentation.instructions.md` — so a one-file middleware doesn't get a
2,000-line README:

- **Tier 1** — core: `core`, `runtime`, `router`, `di`, `class`, `types`, `errors`. Every section.
- **Tier 2** — middleware / extensions / stream. Problem → install → quick start → features →
  usage → options → troubleshooting → FAQ. Link concepts, don't re-teach them.
- **Tier 3** — adapters / `dev` / `testing` / `create-nextrush`. Bold sections only: purpose,
  install, one runnable example, API reference, compatibility, ecosystem, links.

---

## Advanced markdown — what renders where

This is the single most important authoring constraint: the README must look perfect on
**npmjs.com**, which supports *less* than GitHub.

| Feature | GitHub | npmjs.com | Use in README? |
|---|---|---|---|
| GFM tables | yes | yes | ✅ API / options / compat / at-a-glance |
| Task lists `- [ ]` | yes | yes | ✅ roadmaps / checklists |
| Collapsible `<details><summary>` | yes | yes | ✅ long examples, FAQ, TOC |
| Fenced code with language | yes | yes | ✅ always |
| Badges (shields.io) | yes | yes | ✅ **absolute URLs only** |
| Blockquotes | yes | yes | ✅ |
| GitHub alerts `> [!NOTE]` etc. | rich box | plain blockquote | ✅ degrades gracefully |
| ASCII diagrams (in code fence) | yes | yes | ✅ the ONLY diagram type for a README |
| Anchor / TOC links | yes | yes | ✅ |
| Footnotes `[^1]` | yes | partial | ⚠ avoid |
| **Mermaid** ` ```mermaid ` | rich render | **raw text** | ❌ → ARCHITECTURE.md or ASCII |
| **Relative images** `![](./x.png)` | yes | **broken** | ❌ → absolute `raw.githubusercontent.com` (SVG: add `?sanitize=true`) |
| HTML `<script>` / `<iframe>` | no | no | ❌ stripped |
| Emoji shortcodes `:rocket:` | yes | partial | ⚠ prefer literal emoji 🚀 |

> [!WARNING]
> If a feature only renders on GitHub (Mermaid, relative images), it does **not** belong in the
> README. Diagrams go in `ARCHITECTURE.md` (read on GitHub). The README links to it.

---

## Callout convention (standardized — use consistently across all packages)

| Callout | Means | Use for |
|---|---|---|
| `> [!NOTE]` | Helpful context | a clarification, a smart default worth surfacing |
| `> [!TIP]` | Best practice | the recommended pattern, a shortcut |
| `> [!IMPORTANT]` | Must-know behavior | ESM-only, ordering requirements, contracts |
| `> [!WARNING]` | Common mistake | a footgun that bites real users |
| `> [!CAUTION]` | Risk | security / data-loss consequences |

Prefer a callout over a bare paragraph for anything the reader must not miss — callouts break
visual monotony and draw the eye.

---

## Design-system rules (non-negotiable, every package)

- Every package starts with the **same visual structure** (the order above).
- Every **Quick start is 100% runnable** — real imports, no `...`, no pseudo-code.
- Every package has **exactly one "golden path" example** (the Quick start). Extra examples go
  under Usage or in collapsible `<details>`.
- Every package links to its **`ARCHITECTURE.md`**.
- Every package ends with the **same footer nav block** (Ecosystem + Full documentation), so
  navigation feels identical everywhere.
- Every "At a glance" surfaces the same facts in the same order: dependencies · module format ·
  runtimes · typing · bundle size · support tier.

---

## Done checklist (tick before publishing to npm)

- [ ] First screen answers the five questions (what / why / install / example / production-ready).
- [ ] Renders correctly on npm — **no Mermaid, no relative images** (checked against the table above).
- [ ] All badge/image URLs are absolute; badges point to the real package.
- [ ] Section order matches the frozen sequence; tier depth is respected (Tier 3 stays lean).
- [ ] **Package identity** block present (type · status · tier · runtime · requires · introduced · maintained).
- [ ] Quick start is complete and copy-paste-runnable (imports included, no `...`).
- [ ] Exactly one golden-path example; extras are under Usage / collapsed.
- [ ] API reference lists the **sealed public surface only** — no internal exports — with a `Since` column.
- [ ] **Performance section OMITTED** unless this is a perf-relevant package (no empty "N/A" section).
- [ ] Compatibility states framework version (NextRush `3.x`) + peer deps / works-with / incompatible-with.
- [ ] Options table marks security-relevant defaults; ESM-only + Node `>=22` stated.
- [ ] Callouts use the standardized types (NOTE / TIP / IMPORTANT / WARNING / CAUTION).
- [ ] "At a glance", "When to use", Ecosystem (you-are-here + Works with + **See also**) present (Tier 1–2).
- [ ] Ends with a **Need help?** CTA (learn · ask · report · contribute), then the license line.
- [ ] A sibling `ARCHITECTURE.md` exists and is linked; governing RFC/ADR linked.
- [ ] Reading rhythm varies (not every section heading → paragraph → code).
- [ ] All guidance comments removed from the final README.
