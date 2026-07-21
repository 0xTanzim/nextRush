## Why

NextRush is moving from the v3 line to v4, and the documentation has to move with it. Two
problems today:

1. **The docs site (`apps/docs`) and every package's `README.md` / `ARCHITECTURE.md` predate the
   current templates and the `engineering-documentation` skill.** They are inconsistent in shape,
   some are missing entirely (e.g. `@nextrush/router` has a `README.md` but **no**
   `ARCHITECTURE.md`), and none were authored against the EDS-001…022 standards. Per AGENTS.md §13
   and §21, an off-pattern or missing doc is a defect — 35 packages currently sit in that state.
2. **There is no captured, resumable plan for the rewrite.** A 35-package, multi-wave effort that
   will run across many agent sessions needs a persistent contract (this change) so no future
   session loses context — the alternative (a standalone planning folder) is exactly the
   dead-weight we just pruned (`docs/documentation-rebuild`, AGENTS.md §20).

This change is the durable home for the v4 documentation effort: the tooling decisions, the v3→v4
cutover strategy, and the wave-by-wave rewrite tracker.

## What Changes

**Docs-site modernization (`apps/docs`, keep Fumadocs — no framework swap):**

- Formalize the **`llms.txt` / `llms-full.txt`** pipeline via Fumadocs' first-class `source.llms()`
  / `remarkLLMs` support (today it exists only as an incidental build artifact — `llms-full.txt`,
  `ask-ai-index.json`). Make it a documented, first-class output for AI/agent consumption.
- Wire **`@nextrush/openapi`**'s generated spec into Fumadocs' **Scalar**-based OpenAPI renderer for
  interactive, try-it-out API reference pages (today `reference/` is hand-written).
- Adopt **`AutoTypeTable`** (`fumadocs-typescript`) everywhere a type/option table appears, so
  reference tables generate from live TS source and cannot drift across 35 packages at mixed
  versions (3.1.0 core / 1.0.0 newer).
- Rebuild site content against the skill's page-type standards and the docs-site content map.

**Package documentation (all 35 publishable packages):**

- **Harden and freeze the templates first (foundation).** Before scaling, the two package
  templates and the eight docs-site page-type templates — plus their EDS standards — are rewritten
  to a frozen canonical structure via the pilot (see `tasks.md` §0.6, `design.md` D7), so all 35
  packages and every site page author from one stable, reviewed bar rather than a drifting one.
- Rewrite every package's `README.md` (npm landing — usage) and author/rewrite its
  `ARCHITECTURE.md` (internals — diagrams), each from `docs/templates/package-readme.template.md`
  (+ authoring guide) and `docs/templates/package-architecture.template.md`, using the
  `engineering-documentation` skill. Depth follows the package's tier.
- Executed in **tier-driven waves** with parallel subagents (Planner → isolated-worktree
  Implementers → independent Validator → Integrator), gated wave by wave.

**v3 retirement (no `_archive/` folder — AGENTS.md §20):**

- Snapshot v3 docs as a git **tag** (`docs-v3-final`) and build v4 on a **branch**; v3 stays live
  until v4 is validated, then old content is removed from the tree (recoverable via the tag). No
  permanent archive directory is created at any point.
- Author a **redirect map** before cutover for any v3 URL that changes under v4.

## Capabilities

### New Capabilities
- _None._ This is a documentation change. It adds and modifies no framework capability, public API,
  or runtime behavior, so it creates no `specs/<capability>/` delta (AGENTS.md §20).

### Modified Capabilities
- _None._

## Scope / Non-goals

- **In scope:** all `apps/docs` content, all 35 package `README.md` + `ARCHITECTURE.md`, the docs
  tooling additions above, and the v3→v4 cutover.
- **Out of scope:** any source-code change. If a doc rewrite surfaces a code defect or an API that
  contradicts its docs, that is logged as a Finding and RFC/spec-gated separately — it is never
  fixed silently inside a docs wave (source wins; docs describe truth, they don't change it).
