---
wave: B2
track: B
tasks_md_item: 9
depends_on: [B0, B1]
status: complete
---

# Wave B2 — guides/ + recipes/ + production/ (v4 rebuild + IA dedup)

## Objective

Bring `guides/`, `recipes/`, and `production/` to v4-compliance: fix real staleness (retired
terms, wrong import paths, out-of-date API claims), and — just as important — **resolve two
real IA overlaps Wave B0 already flagged but did not execute**: `guides/migration.mdx`
duplicating the frozen `migrate/` section, and `guides/deployment.mdx` duplicating the frozen
`production/deployment/` cluster.

There is no `examples/` docs-site content type — `documentation.instructions.md`'s content map
is `start/concepts/guides/recipes/production/reference/internals/migrate/resources` only. A
prior session summary listing "examples/" as in-scope was in error; this brief corrects that.

## Scope — real existing files (verified before writing this brief, not assumed)

### guides/ (19 files, `apps/docs/content/docs/guides/`)
`index, rest-api, class-based, dev-tools, generators, error-handling, validation,
custom-middleware, mounting-and-grouping-routes, testing, migration, deployment, security,
authentication, database, file-upload, hello-world, websocket, meta.json`

**Staleness confirmed via grep before this brief was written** (retired terms / dead import
paths — do not assume the rest are clean, this was a quick pre-scope scan, not a full audit):
`migration.mdx`, `websocket.mdx` — flagged hits, verify and fix.

**IA dedup (do this, not just content fixes):**
- `migration.mdx` — frozen `migrate/` (7 pages: `index, from-{express,fastify,koa,nestjs},
  upgrade-guide, deprecations`) is the sole owner per Wave B0's IA freeze (`wave-b0-ia.md` line
  91: "migrate/ — Keep (+breaking-changes)"). **Remove `guides/migration.mdx`**, redirect any
  incoming link to `migrate/`, remove it from `guides/meta.json`'s `pages` array.
- `deployment.mdx` — frozen `production/deployment/` (index + node/bun/deno/edge) is the sole
  owner. **Remove `guides/deployment.mdx`**, redirect incoming links to
  `production/deployment/`, remove from `guides/meta.json`.
- Before removing either file, grep the WHOLE `apps/docs/content/docs/` tree for relative links
  pointing at `guides/migration` or `guides/deployment` and fix every incoming link — do not
  leave a dead link (Wave B0's §6b explicitly required a "no 404 dead-end" guard).

### recipes/ (7 files, `apps/docs/content/docs/recipes/`)
`index, background-jobs, cors-multi-tenant, jwt-authentication, pagination,
postgres-service, rate-limiting, meta.json`

No IA overlap found. Verify each recipe's code sample still compiles against real v4 APIs
(EDS-013) and doesn't import a granular `@nextrush/*` package where the meta package covers it
(Recipe pages follow the teaching-page import-style rule per `documentation.instructions.md`).

### production/ (14 files + 2 sub-clusters, `apps/docs/content/docs/production/`)
`index, benchmarking, caching, configuration, performance-tuning, reliability, scaling,
security, meta.json`, plus `deployment/{index,node,bun,deno,edge,meta.json}` (already the
frozen dedup target above) and `observability/{index,logging,request-tracing,meta.json}`.

**Staleness confirmed:** `observability/index.mdx`, `observability/logging.mdx` — flagged hits,
verify and fix. Cross-check `observability/logging.mdx` against `@nextrush/logger`'s
just-validated ARCHITECTURE.md (Wave A2 batch 4) for the real redaction-default behavior
(redact defaults `true` in production only, `false` in dev/test) — don't let this page repeat
a stale claim the package docs already correctly fixed.

## Known risk areas (extra scrutiny — from this session's established findings)

- **`production/deployment/bun.mdx`** (if it exists as a distinct guide beyond the adapter
  cluster) — Wave B1 already found and fixed a stale "Internal tier" + body-size-limit claim in
  `start/runtime/bun.mdx`; confirm this production-side page doesn't carry the same stale claim.
- **`production/deployment/edge.mdx`** — covers Cloudflare Workers AND Vercel Edge per the
  frozen IA split (confirmed twice this session: Wave B0's final review, and A3's
  `adapter-edge` package docs). Confirm this page's scope matches.
- **Any Lambda/serverless deployment content** — `ctx.runtime` reports `'edge'`, never `'node'`,
  on every serverless provider (B1 finding, re-confirmed in A3's `adapter-serverless` docs).
  Grep for a stale `'node'` claim before this wave closes.
- **`production/observability/logging.mdx`** — cross-check against `@nextrush/logger`'s
  now-validated docs (Wave A2): it's a thin wrapper re-exporting the external `@nextrush/log`
  package, redaction is real but production-only by default. Don't let this page describe
  logging as if it were self-contained package logic.
- **`guides/error-handling.mdx`** — cross-check against `@nextrush/errors`' Wave A1 docs (the
  HttpError hierarchy) for API-signature drift.
- **`guides/validation.mdx`** — cross-check against `@nextrush/validation`'s Wave A2 finding:
  only Zod is integration-tested; Valibot/ArkType are "structurally compatible," not tested.
  Don't let this guide overclaim equal support.
- **`guides/websocket.mdx`** — cross-check against `@nextrush/websocket`'s Wave A2 finding: this
  package is **Node-only**, not an Extension, and has a real dead-code bug (`clientTimeout`
  declared but never read). Confirm the guide doesn't claim cross-runtime support or working
  `clientTimeout` behavior.

## Diagram conventions (EDS-012, same house style)

- Deployment/production flows: `sequenceDiagram` for request paths, `architecture-beta` or
  `block-beta` for topology (a deployment target's infrastructure shape), never a bare
  flowchart standing in for either.
- Recipes are typically code-first; a diagram is optional and only earns its place if the
  recipe's flow is genuinely hard to hold in prose (per this repo's own diagram philosophy).

## Per-item checklist

- [ ] Read the file's current content in full before editing — this is a v3→v4 rewrite pass on
      real existing content, not blank-page authoring (some files may be entirely correct
      already, per A3's `dev`-package and A2's `health`-package precedent — verify, don't
      assume rewrite is needed).
- [ ] Every code sample compiles against real v4 APIs (EDS-013) — verify signatures against
      package source, not the page's own prior version.
- [ ] Import style follows the teaching-page rule (`nextrush` / `nextrush/class`, not granular
      `@nextrush/*`, except where a page is specifically about one package).
- [ ] No retired terms ("radix tree"), no dead `@nextrush/decorators`/`@nextrush/controllers`
      references (both deprecated shims — migration-only mentions are fine, primary-path
      mentions are not).
- [ ] `guides/migration.mdx` and `guides/deployment.mdx` removed; `guides/meta.json` updated;
      every incoming link across the whole docs tree fixed, zero dead links introduced.
- [ ] EDS-012 diagram compliance where a diagram is used.
- [ ] Any real engineering/doc-inconsistency finding logged honestly, not silently patched.

## Independent validator checklist (zero-trust)

- [ ] Re-derive every API claim from real package source (not from the page's own prior text).
- [ ] Confirm the two IA-dedup removals actually happened AND no dead links remain anywhere in
      `apps/docs/content/docs/` pointing at the removed paths.
- [ ] Confirm each of the "known risk area" claims above against the now-validated Wave
      A1/A2/A3 package docs, not just against this page's own prose.
- [ ] Confirm diagram types, ASCII/marketing-word/placeholder mechanical checks.
- [ ] Confirm `guides/meta.json`'s `pages` array has no dangling reference to a removed file.

## Outcome (2026-07-22)

**✅ COMPLETE.** Run as a dedicated dedup node (must-complete-first) plus 4 parallel content
batches (guides-batch1, guides-batch2, recipes, production) sharing disjoint file sets, closed
out with a main-session mechanical sweep + 2 direct fixes for issues no batch owned.

**IA dedup**: `guides/migration.mdx` and `guides/deployment.mdx` removed; 10 real incoming links
across 9 files fixed to point at `migrate/*` or `production/deployment/*`; `guides/meta.json`
updated. Independently re-confirmed clean (0 dead links tree-wide).

**Real defects caught and fixed (not silently patched):**
- `class-based.mdx`: `delay`/`Optional` are NOT re-exported by `nextrush/class` (real gap in
  `packages/class/src/index.ts`'s barrel vs. `@nextrush/di`'s full surface) — fixed imports,
  added the missing caveat at first mention (not just in "Common Mistakes").
- `generators.mdx`: CLI-generated code samples claimed `from 'nextrush'` but the real generator
  templates (`packages/dev/src/generators/templates.ts`) emit `from 'nextrush/class'` — a
  developer running the real CLI would get different code than the guide showed. Fixed.
- `dev-tools.mdx`: missing `--dts`/`--cache` CLI flags; a stale watch-path default claim
  (`getDefaultWatchPaths()` is dead code, never called from the real dev-server path — real
  behavior is "watch imported files automatically"). Fixed both.
- `error-handling.mdx`: multiple code samples imported symbols from `@nextrush/errors` that the
  `nextrush` meta-package's barrel does not re-export (`RequiredFieldError`, `getErrorStatus`,
  etc.) — fixed with a split import + explanatory Callout.
- `validation.mdx`: the guide never used the real `@nextrush/validation` package at all,
  hand-rolling validation from scratch — added a "Step 0" teaching the real `validate()`
  middleware as the recommended path.
- `websocket.mdx`: rewrote to the now-recommended `createWebSocketExtension()` API; fixed a
  wrong import source (`@nextrush/adapter-node` → `nextrush` for `listen`).
- `postgres-service.mdx` (recipes): a false "nothing more" completeness claim about
  `nextrush/class`'s DI re-exports — corrected.
- `testing.mdx`: one dead link (`/docs/performance` doesn't exist) fixed to
  `/docs/production/performance-tuning`.
- 2 EDS-012 diagram-type violations found by validators but left unfixed by any batch (a
  parallel-dispatch gap — neither batch's `files_in_scope` covered the flagged files) — fixed
  directly by the main session: `mounting-and-grouping-routes.mdx`'s router-topology diagram
  was a generic `flowchart TB` (now `block-beta`, matching the house convention for structure);
  `security.mdx`'s middleware-order diagram was `flowchart LR` (now `sequenceDiagram`, matching
  EDS-012's explicit rule for "request lifecycle, middleware order").

**Real findings logged, deliberately not fixed here (out of B2's scope, cross-referenced for a
future pass):** `reference/plugins/websocket.mdx:331` (a Reference page, outside B2) repeats
the same false `clientTimeout` claim already caught and disclosed in `@nextrush/websocket`'s
own Wave A2 docs — the heartbeat system does not actually terminate connections based on it.

**Process note on parallel dispatch:** one validator (`production-validate`, mid-pipeline read)
reported `guides/meta.json` was missing 5 sidebar entries — this was a stale read racing against
`guides-batch2-impl`'s concurrent fix, not a real defect. Re-verified directly against the final
file state: all 16 real files are present in the array. Resolved by checking ground truth
directly rather than trusting either report at face value — the same zero-trust discipline
applies to conflicting sub-agent reports, not just to a single self-report.

**Mechanical sweep (main session, before commit):** 0 dead links tree-wide; all `{{` hits in
touched files are legitimate JSX props (`types={{`, `dependencies={{`) or real Docker
Go-template syntax, not leftover placeholders; 0 "radix tree" mentions; 0 stale
`ctx.runtime === 'node'` claims on serverless content; `bun.mdx`/`edge.mdx` correctly avoid the
stale Internal-tier claim and correctly scope to Cloudflare Workers + Vercel Edge + Netlify Edge.
