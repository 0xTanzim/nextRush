# EDS-002 — Documentation Architecture

> A documentation site is a system, not a folder of Markdown. Every page has one purpose, every piece of content lives in exactly one place, and the whole thing is organized around what the reader is trying to *do* — never around how the code is packaged.

This is the site-level standard: how pages are grouped, how a reader moves between them, and where a new page belongs. Page-*internal* structure is EDS-006.

---

## Organize by reader goal, not by package

The single most common IA mistake is mirroring the codebase: a sidebar of `core`, `router`, `types`, `cors`, `cookies`. That is *your* mental model, not the reader's. The package a feature lives in is an implementation detail.

Organize instead by what the reader wants to accomplish:

```text
Bad (by package)          Good (by goal)
  core                      Get started
  router          →         Define routes
  types                     Handle requests
  cookies                   Read & write cookies
  cors                      Enable CORS
```

## The four content layers

Every page serves one of four reader goals. This is the top level of the information architecture.

| Layer | Reader goal | Contains |
|---|---|---|
| **Learn** | *Understand* the system | Overview/landing, concepts, mental models, architecture overview |
| **Build** | *Accomplish* a task | Tutorials, guides, recipes |
| **Reference** | *Look up* a fact fast | API, CLI, config, types |
| **Evolve** | *Upgrade & go deep* | Migration/versioning, internals/architecture, decision guides, performance |

A reader is almost always in one layer at a time. Mixing layers on one page (a tutorial that turns into an API dump that turns into an architecture essay) is the fastest way to lose them.

## The documentation pyramid

Within the doc set, content is stacked so understanding comes before lookup. **API reference sits near the bottom, not the top** — people adopt software to solve a problem, and the signature only becomes meaningful once they understand what it's for.

```text
Problem  →  Concept / mental model  →  Quick start  →  Common tasks (guides)
   →  Advanced usage / recipes  →  Reference  →  Architecture / internals
```

A homepage that opens with an API table is optimizing for the 5% who already know the tool at the expense of the 95% deciding whether to learn it.

## Page types (Diátaxis + extensions)

Every page is exactly one type. The five core types are [Diátaxis](https://diataxis.fr) — the industry-standard model that separates *learning* from *doing* from *looking up* from *understanding*. This skill adds three extensions for framework docs.

| Type | Job | The one question it answers |
|---|---|---|
| Concept (explanation) | Teach an idea | "Why does this exist and how should I think about it?" |
| Tutorial | Teach by building | "Walk me through building something real." |
| Guide (how-to) | Solve one task | "How do I do this specific thing?" |
| Reference | Exact lookup | "What are the precise facts?" |
| Architecture (deep explanation) | Reveal internals | "How does it work inside, and why?" |
| Landing / Overview | Orient & route | "What is this, and where do I start?" |
| Recipe / Cookbook | Complete solution | "Give me the whole runnable answer." |
| Migration / Versioning | Move forward | "How do I upgrade or switch to this?" |

The rules for each are EDS-007–011 and EDS-018–020.

## One page, one purpose

Each page answers *one* primary question. "Middleware" answers *why middleware exists and how to think about it* — not *every middleware API* (that's reference) and not *how to build a rate limiter* (that's a guide). When a page tries to answer three questions, split it into three pages and link them.

## Single source of truth

Every concept has exactly one authoritative page. Everywhere else *links* to it rather than re-explaining it. Duplicated explanations drift out of sync and quietly become wrong; a link never does. If you find yourself re-teaching cookies on the auth page, stop and link the cookies concept page.

## Navigation is part of the content

A reader should always know three things: **where they are, why they're here, and where to go next.** The site delivers that through:

- **A sidebar grouped by the four layers / by goal** — the map. Order it along the learning path, not alphabetically.
- **A landing/overview page per major section** — the entry point that routes newcomers (EDS-018).
- **"Next steps" on every page** — the single most important navigation element. Learning is a graph; every page names the next logical node (EDS-006).
- **Breadcrumbs** — position within the hierarchy.
- **Search** — assume many readers enter here, not the homepage; good titles and descriptions (EDS-017) are what make search work.
- **Sequential prev/next** for tutorials that form a series.

## The learning path

The default journey a newcomer follows should be deliberate and linear:

```text
Landing → Install → Quick start → Core concepts → Guides → Architecture → Reference
```

Each page should hand off to the next. A reader should never hit a dead end and wonder "now what?"

## Versioning & freshness

Docs are tied to a shipping product. Version-specific content is labelled; when a version is duplicated, set a canonical URL (EDS-017) so search doesn't split or surface the wrong one. Deprecated pages redirect or carry a clear banner pointing to the replacement — never leave a stale page silently live.

## The quality standard for architecture

Every page must be able to answer: *Who is this for? What problem does it solve? Why does this content live here? What should the reader understand after? Where do they go next?* If any answer is unclear, the page is misplaced or mistyped — redesign it before writing more.

The finished site should not read like a pile of Markdown files. It should read like a structured course that also happens to be the official reference.
