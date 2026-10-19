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

**Docs are a translation layer.** The repository reflects *engineering* (`packages/middleware/cors`);
the documentation reflects *user goals* (Security → CORS). Never mirror the package tree in
navigation. This holds **even for Reference** — the common "Reference is the lookup exception" excuse
is wrong: a newcomer looking up "CORS" doesn't know it's a middleware package. Group Reference by
**capability** (HTTP, Security, Observability, Real-time, …) and make the **package name + type
(middleware/extension/adapter) page metadata**, shown in the page's identity block. Implementation
concepts (middleware, registrar, extension, adapter, "package type") are taught **once** in an
architecture page, never used as first-class navigation. A separate A–Z package index serves the
minority who already know the package name.

## Design for personas and journeys, not just pages

A doc site is a **product** with distinct customers. Before grouping pages, name the personas who
arrive and design a **front door + path → success** for each. Typical personas for a framework/SDK:
the **newcomer** (teach me), the **switcher** coming from a competitor (show me the diff fast), the
**runtime/platform user** (does it run on my target, how do I ship), the **enterprise/security-first
team** (is it secure & operable), the **library/extension author** (how do I extend it), the
**operator/on-call** (keep it healthy), the **contributor** (how is it built), the **evaluator**
(should we adopt), and — increasingly — the **AI agent**.

Use a **persona → journey map as the acceptance test for the IA**: if a section serves no persona,
cut it; if a persona has no path, add one. A landing page can route personas explicitly
("What brings you here today?") rather than forcing everyone through one tree.

**The AI agent is a first-class persona.** Claude Code, Codex, Copilot, and Gemini CLI *retrieve*,
they don't browse. Serve them with a machine-readable surface (`llms.txt` / `llms-full.txt`, an
MCP/agent spec) and — just as important — **predictable, self-contained Reference/Recipe/Example
pages**, so a retrieved page answers correctly out of context. Optimizing for agents also improves
human search.

**Cross-cutting concerns get a pathway, not a single buried section.** When a capability spans the
journey — a runtime/platform (Node/Bun/Deno/Edge/Serverless), a security posture, an i18n locale —
weave it through **onboarding → production → reference** with a consistent entry point (a landing
router) and an **at-a-glance support signal on every affected page** (e.g. a runtime-support badge:
`✅ Node · ❌ Edge`), so a reader always knows if a feature fits their context. Prefer **one site with
many onboarding paths** over splitting the docs per context.

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

**Internationalization is the same discipline.** Be **i18n-*ready*, not i18n-*complete*.** Wiring the
infrastructure (locale routing with a **hidden default locale** so the primary-language URLs stay
unchanged, translatable UI chrome, a locale switcher, `hreflang`/canonical per EDS-017) is cheap and
should be done early. Translating the *content corpus* is expensive and ongoing, and **a stale or
partial translation is worse than none** — a reader on an outdated localized page is actively misled,
the opposite of the honesty this skill demands (EDS-001). So keep content **primary-language-first**,
translate **incrementally** (highest-traffic pages first), only for a locale with a committed
maintainer, and gate it with a **translation-freshness check** that flags any localized page older
than its source. Never block a release on full-corpus translation.

## The quality standard for architecture

Every page must be able to answer: *Who is this for? What problem does it solve? Why does this content live here? What should the reader understand after? Where do they go next?* If any answer is unclear, the page is misplaced or mistyped — redesign it before writing more.

The finished site should not read like a pile of Markdown files. It should read like a structured course that also happens to be the official reference.
