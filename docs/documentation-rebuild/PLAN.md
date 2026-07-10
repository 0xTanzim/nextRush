# NextRush Documentation Platform Rebuild — PLAN

> **Status:** Approved, ready for execution.
> **Owner:** Documentation
> **Last updated:** 2026-07-10
> **Tracker:** see [`ROADMAP.md`](./ROADMAP.md) in this folder.
> **Source of truth:** framework **source code + package READMEs** are authoritative.
> Do **not** treat `.kiro/steering/v3-architecture.instructions.md` as a spec — it is a
> historical overview kept in sync best-effort. Every page in this rebuild is verified
> against source.

This is the contract for the rebuild. It is read at the start of every rebuild work session.
`ROADMAP.md` is the tracker (what is done / in progress); this file is the *why and what*.

---

## 1. Problem Statement

NextRush's documentation describes an older product than the shipped code:

- The architecture consolidated into **`nextrush/class`** (modules, request scope,
  interceptors, exception filters, lifecycle hooks) — the docs still reflect the deprecated
  `@nextrush/decorators` + `@nextrush/controllers` + `@nextrush/di` split.
- Routing is a **segment trie**, not a radix tree (stale term still in steering).
- There are **35 publishable packages**, with no discovery surface — they are buried.
- There is **no production / operational layer** (config, deployment, observability, caching,
  scaling, reliability, security hardening).
- The landing experience is a sidebar, not a flow. Findability for 30+ packages is poor.

This is a **complete platform rebuild**, not a content refresh.

## 2. Requirements

1. **Full rebuild**, every page verified against real 3.1 source (not stale steering).
2. **Stay on Fumadocs** — modern, professional, zero lock-in, existing agent stack (llms.txt,
   MCP, agent-spec, OG, skills).
3. **Kill drift structurally** — generate reference type tables/signatures from TypeScript
   source via `fumadocs-typescript`.
4. **Discovery-first flow** — a curated Docs Hub launchpad, a top-level **Packages/Ecosystem**
   directory, and a task-based **capability finder**; organized by human-psychology principles
   (recognition over recall, chunking / Miller 7±2, progressive disclosure, type badges).
5. **Complete the missing halves** — production/operations spine, recipes, consolidated
   migration, internals/RFCs, resources.
6. **Feature-rich layer** — single-page "NextRush in One Page", Blog, Showcase, Ask AI,
   runnable examples, feedback widget, runtime switcher, compatibility matrix.
7. **Versioning** — single "latest" now + version-switcher affordance + compatibility matrix
   (handles mixed 3.1.0 / 1.0.0 package versions); branch-based version trees deferred to a
   future major.

## 3. Background (research + verified facts)

- **Platform:** 2026 reviews position Fumadocs as the leading Next.js docs framework
  (Mintlify-grade aesthetics, deep MDX, full-text search, zero vendor lock-in).
  `fumadocs-typescript` (`AutoTypeTable` + `remarkAutoTypeTable`, TSDoc tags `@internal`,
  `@remarks`, `@fumadocsType`) generates reference from source; `fumadocs-openapi` can render
  the REST surface. Fumadocs versioning is DIY primitives — acceptable since version trees are
  deferred. Mintlify (hosted/proprietary), Docusaurus (heavier, older), Starlight (Astro
  rebuild) all rejected — reasons in the audit.
- **Source truth (verified):** core packages at `3.1.0`; newer middleware at `1.0.0`.
  `@nextrush/class` merges the former `@nextrush/decorators` + `@nextrush/controllers` and
  re-exports `@nextrush/di`. It contains `modules/`, `request/`, `lifecycle/`, `interceptors/`,
  `filters/`, `guards/`, `binding/`, `discovery/`, `diagnostics/`, `bootstrap/`, `registrar/`.
  Public surface includes `@Module`/`registerModule`, `@Catch`/`@UseFilter`, `@UseInterceptor`,
  `OnInit`/`OnShutdown`, `FilesystemSource`/`MemorySource`, `getClassDiagnostics`.
- **`docs/` at repo root** was empty — RFCs referenced (e.g. `RFC-NEXTRUSH-CLASS-CONSOLIDATION`)
  but not surfaced. This folder now hosts the rebuild plan and will host the RFC/ADR index.
- **Diátaxis** (Tutorial / Guide / Concept / Reference) + two framework spines (Production,
  Internals) gives every page one home and one job — the anti-duplication, anti-drift backbone.

## 4. Proposed Solution

A discovery-first Fumadocs platform:

- A curated **Docs Hub** routes each persona; a top-level **Packages directory** and
  **capability finder** solve findability for 30+ packages.
- **Diátaxis-structured content** (start, concepts, guides, production, reference, recipes,
  migrate, internals, resources) rebuilt against source.
- A **single package registry** feeds catalog / clusters / badges / agent endpoints.
- **Generated reference** eliminates drift.
- A **CI verification harness** (link-check, example-compile, reference-match, lint, a11y)
  defines "done" for every page.
- A **feature-rich layer** (one-page overview, Blog, Showcase, Ask AI, runnable examples)
  makes it premium.

### Target top-level sitemap

```
/                         → Marketing landing (exists)
/docs                     → Docs Hub / Launchpad (curated, not a redirect)
  /docs/start             → incl. "NextRush in One Page"
  /docs/concepts          → app, context, routing, middleware, error-handling, extending,
                            DI + scopes, modules, guards, interceptors, filters, lifecycle,
                            runtime-model
  /docs/guides            → index = "What do you want to do?" capability finder
  /docs/production        → config, deployment (node/bun/deno/edge/docker), reliability,
                            observability, security, caching, scaling, tuning, benchmarking
  /docs/reference         → capability clusters + generated tables (lookup)
  /docs/recipes           → cookbook
  /docs/migrate           → from-express/koa/fastify/nestjs, deprecations, upgrade
  /docs/internals         → design, package hierarchy, engine/router/DI internals,
                            adapter contract, RFCs/ADRs, versioning, benchmark harness, contributing
  /docs/resources         → faq, troubleshooting, glossary, compatibility matrix, changelog, roadmap
/packages                 → Ecosystem directory (discovery) + /packages/<name>
/blog                     → release notes, deep dives, design decisions
/showcase                 → social proof (optional)
```

### Reference organization (30+ packages, done right)

- **Axis A — sidebar grouped by capability cluster:** Core · Class runtime · Security ·
  Request data · Responses · Observability · Real-time & events · Adapters · Tooling.
- **Axis B — "All Packages" catalog** (top-level `/packages`): filterable card grid with type
  badges (Core / Middleware / Extension / Adapter / Tool) and status (Stable / New / Deprecated).
- Both generated from the **package registry** so they can never drift from the real 35 packages.

## 5. Task Breakdown (22 tasks, 6 phases)

"Test-driven" for docs = verification gates: `pnpm build` clean, link-check passes, every code
sample compiles/runs, generated tables match source, page meets the docs-standards quality score.

### Phase 0 — Foundations & guardrails (define "done" before content)

**T1. Lock source-of-truth & retire stale steering.** Record that source code + READMEs are
authoritative; mark `v3-architecture.instructions.md` non-authoritative; fix terminology
(segment trie, `nextrush/class`, real package count). *Verify:* standards doc states the rule;
every later task carries a "verified against source file X" checklist item.

**T2. Verification harness (test layer first).** CI gates: internal link-check, MDX code-example
typecheck/compile, forbidden-words + heading-intent + import-style lint, reference-matches-source
check. *Verify:* green on baseline, fails on seeded broken link + broken sample.
*Demo:* `pnpm docs:verify` blocks a bad PR.

**T3. Package registry (single source of truth).** Typed registry (name, npm, category, type,
status, summary, since-version) for all 35 packages, feeding catalog/clusters/badges/llms.txt.
*Verify:* parity script asserts registry == real `package.json` set. *Demo:* new package appears
everywhere automatically.

**T4. Generated-reference tooling (pilot).** Wire `fumadocs-typescript`; prove `reference/context`
renders a `ctx` table generated from source. *Verify:* reference-match gate passes; source edit
updates the table. *Demo:* zero-manual-edit reference update.

**T5. Page templates & standards.** Type-specific templates (Concept, Guide, Reference, Tutorial,
Production, Recipe, Migration) + contributor doc; encode heading-intent, import-style, callout
limits, terminology. *Verify:* lint fails a seeded non-compliant page. *Demo:* copy a template →
linter guides to compliance.

### Phase 1 — Skeleton & shell

**T6. Scaffold IA + nav + redirects (no content loss).** New folder tree + `meta.json`; redirects
from every old URL. *Verify:* link-check green; redirect test passes. *Demo:* new spines render,
old URLs still resolve.

**T7. Top-level navigation shell.** Persistent nav (Documentation · Packages · Reference · Recipes
· Blog) + ⌘K search + version switcher affordance + Ask AI slot + GitHub. *Verify:* nav on all
routes, no client-JS perf regression. *Demo:* every destination reachable globally.

**T8. Docs Hub launchpad.** Curated `/docs`: hero + CTAs, search, path cards, capability finder,
featured packages → browse all, popular guides/recipes, latest blog. *Verify:* all links resolve;
SSR clean. *Demo:* any persona routed in one click.

### Phase 2 — Core content rebuild (accuracy-first, verified vs source)

**T9. `start/` tutorial spine.** Introduction (why/who/when-NOT), Installation, Quick Start,
Scaffolding, Project Structure, TypeScript Setup — using `nextrush`. *Verify:* every block
compiles; quick-start boots in a smoke test. *Demo:* new user reaches a running JSON API.

**T10. "NextRush in One Page".** Koa-style full single-scroll tour, each section with a
"→ deep dive" link; backbone of `llms-full.txt`. *Verify:* blocks compile; deep-dive links
resolve. *Demo:* whole framework understood from one page.

**T11. `concepts/` incl. missing subsystems (P0 drift fix).** Rewrite mental models + ADD
Modules, DI scopes, Interceptors, Exception Filters, Lifecycle; move internals to `internals/`.
*Verify:* examples compile vs `nextrush/class`; signatures pass reference-match. *Demo:* reader
uses modules + request scope + interceptors; no deprecated imports.

**T12. `reference/` — capability clusters + generated tables.** Replace `api-reference/{di,
plugins/controllers}` with clustered `reference/`; generate signatures/options; hand-write CLI;
deprecated packages get warn-callout shim pages. *Verify:* generated tables match source;
deprecated badged. *Demo:* every public API lookup-able; tables regenerate from source.

**T13. Top-level Packages/Ecosystem directory.** `/packages` card grid + category tabs +
type/status badges + search, generated from the registry; per-package landing pages.
*Verify:* directory == real packages; card links resolve; deprecated badged. *Demo:* browse/filter
all 30+ packages and jump to any docs.

**T14. `guides/` + capability finder; fold in examples.** Rewrite task guides + `extending/`
cluster; guides index = "What do you want to do?" finder; migrate examples into guides/recipes.
*Verify:* each guide's final code compiles + verification step runs; finder links resolve.
*Demo:* "I want to add auth" → runnable tested feature without knowing a package name.

### Phase 3 — Production & day-2

**T15. `production/` spine.** Configuration/env/secrets, Deployment (node/bun/deno/edge/docker),
Reliability (graceful shutdown/health/timeouts), Observability (logging/metrics/tracing/
request-id/correlation), Security hardening, Caching, Scaling, Performance tuning, Benchmarking.
*Verify:* Dockerfile builds + health-check responds in CI smoke test; snippets compile.
*Demo:* a team ships to production using only this spine.

### Phase 4 — Depth & growth

**T16. `recipes/` cookbook.** Short copy-paste solutions (pagination, JWT auth, per-user
rate-limit, CORS, Postgres, background jobs, …). *Verify:* every recipe compiles + links to a
concept. *Demo:* copy-paste runs.

**T17. Consolidated `migrate/`.** from-Express/Koa/Fastify/NestJS, Deprecations (controllers/
decorators → class), version Upgrade guide. *Verify:* migration code compiles; deprecation map
matches reality. *Demo:* Express user reaches a working equivalent.

**T18. `internals/` + RFCs/ADRs + versioning policy.** Design principles, package hierarchy +
dependency graph (generated from `package.json` deps), engine/router/DI internals, adapter
contract + conformance, RFC/ADR index (relocate/create in `docs/`), versioning & compatibility,
benchmark harness, contributing. *Verify:* dep graph matches actual deps (script). *Demo:*
contributor finds architecture + design decisions; RFCs on the site.

**T19. `resources/`.** FAQ, Troubleshooting (error→cause→fix from `@nextrush/errors`), Glossary,
Compatibility matrix, Changelog, Roadmap. *Verify:* troubleshooting entries reference real error
messages; matrix versions match `package.json`s. *Demo:* user resolves a real error.

**T20. Blog + Showcase.** Fumadocs blog collection (seed: major-release announcement + "why the
class runtime"); optional Showcase grid. *Verify:* blog builds, in nav + RSS; posts link to docs.
*Demo:* release announcement live and links into new docs.

### Phase 5 — Premium & launch

**T21. Feature-rich layer.** Ask AI (wired to llms.txt/MCP), runnable example embeds, feedback
widget, runtime switcher (Node/Bun/Deno/Edge), "copy page as Markdown / open in LLM".
*Verify:* Ask AI answers from current content; embeds load; feedback posts. *Demo:* in-docs
question returns an accurate sourced answer.

**T22. Launch hardening + full-site verification.** Visual-rhythm/density pass; a11y (contrast,
semantic headings, keyboard nav via playwright-cli/chrome-devtools); SEO/perf; regenerate
llms.txt/llms-full.txt/MCP/agent-spec for the new IA; run the full harness site-wide; version-ready
URL shell. *Verify:* full-site link-check + example-compile + reference-match green; a11y + perf
pass; agent endpoints resolve. *Demo:* complete site builds clean, every sample verified, ready
to publish.

## 6. Definition of Done (whole rebuild)

- [ ] Every page verified against source; zero deprecated-package imports in examples.
- [ ] Reference type tables generated from source (drift-proof).
- [ ] Discovery flow live: Docs Hub + Packages directory + capability finder.
- [ ] Production spine complete; a team can ship to prod from docs alone.
- [ ] Migration + recipes + internals + resources complete.
- [ ] Blog + feature-rich layer (Ask AI, runnable examples) shipped.
- [ ] Full verification harness green site-wide; agent endpoints regenerated.
