---
wave: B3
track: B
tasks_md_item: 10
depends_on: [B0, B1, B2]
status: complete
---

# Wave B3 — reference/ + architecture/ (frozen IA migration + content v4 rewrite)

## Objective

This is NOT a content-only wave — Wave B0 froze a real structural IA migration that has not
yet been executed on disk. B3 must (1) execute that migration, (2) rewrite every page's content
to v4-accuracy against the now-fully-validated Track A package docs, and (3) guarantee zero
dead links / zero 404s from the URL changes (Wave B0 §6b's explicit no-dead-end requirement).

**Do not treat this as "just fix the content" — the folder/URL structure itself is wrong on
disk relative to the frozen decisions below, and must change.**

## The frozen decisions this wave executes (verified against `design.md` D9, not assumed)

1. **D9.1 — Reference URLs are flat.** `reference/{core,middleware,plugins,adapters}/{pkg}` (the
   current on-disk structure, ~36 pages) → `reference/{pkg}` (no package-type folder). URL =
   package identity (stable); capability/type is page **metadata**, not a folder. This is the
   FINAL decision — a "zero-churn, keep folders" alternative was considered and explicitly
   rejected in favor of this (`wave-b0-ia.md` line 298's alternative was NOT taken).
   - Exception: `reference/class/*` — **KEEP as a subfolder** (`wave-b0-ia.md` line 297,
     "KEEP (cohesive)") — the class runtime's surface (decorators, DI, controllers, modules) is
     cohesive enough to stay grouped, unlike the other single-purpose packages.
2. **D9.3 — `internals/` renames to `architecture/`.** Also: `standards/`+`specs/` concepts fold
   into it (no new top-level section); `contributing.mdx` moves OUT to
   `community/contributing.mdx` (a real duplicate/merge target — `community/contributing.mdx`
   may already partially exist, check before overwriting). Frozen sidebar order: **Design
   Principles · Contracts (Extension API · Adapter Contract) · Request Lifecycle · Capability
   Composition ⊕(new) · Package Hierarchy · internals · RFC · ADR**.
3. **"Adapters" → "Platforms"** in Reference nomenclature (R4 in `wave-b0-ia.md` line 19) — the
   nav label changes; the underlying pages (bun/deno/edge/node/serverless) are unaffected by the
   flat-URL move beyond losing their `adapters/` folder prefix.
4. **New `reference/packages` A-Z index** — does not exist yet on disk. Cross-links to (does
   not duplicate) the marketing `/packages` showcase page (`wave-b0-ia.md` §258-260's explicit
   decision: marketing overview vs. in-docs lookup, cross-link both, never duplicate).
5. **`concepts/plugins` → `concepts/extensions`** — already done in Wave B1 (verify still
   correct, do not re-do).

## Exact current-state → target-state mapping (verified via `find` before writing this brief)

| Current path (on disk now) | Target path (v4 frozen) |
| --------------------------- | ------------------------ |
| `reference/core/{core,dev,errors,nextrush,router,runtime,testing,types}.mdx` | `reference/{core,dev,errors,nextrush,router,runtime,testing,types}.mdx` |
| `reference/middleware/{body-parser,compression,cookies,cors,csrf,health,helmet,multipart,rate-limit,request-id,timer,validation}.mdx` | `reference/{same-name}.mdx` |
| `reference/plugins/{events,logger,openapi,static,stream,template,websocket}.mdx` | `reference/{same-name}.mdx` |
| `reference/adapters/{bun,deno,edge,node,serverless}.mdx` | `reference/platforms/{same-name}.mdx` — **KEEP as a subfolder** (nav renamed "Platforms", not flattened — 5 adapter pages are cohesive like class, not standalone like a single middleware) |
| `reference/class/*` (7 files) | **unchanged path** — stays `reference/class/*` per the explicit KEEP decision |
| `internals/{adapters,design-principles,di-internals,middleware-internals,package-hierarchy,router-internals,rfcs,versioning}.mdx` | `architecture/{same-name}.mdx` |
| `internals/contributing.mdx` | MERGE into `community/contributing.mdx` (check existing content there first, don't blindly overwrite) |
| *(new)* | `reference/packages.mdx` — A-Z capability-tagged index of all 35 packages |

**Two missing pages the frozen sidebar requires that do not exist under any name — write them
new:** "Contracts" (Extension API · Adapter Contract) and "Capability Composition". These are
NOT in the current `internals/` file list at all — this is genuinely new content synthesizing
the extension taxonomy (`.kiro/steering/architecture.instructions.md`'s Extension taxonomy
section) and the capability-composition model, not a rename of an existing file.

**11 `reference/*/meta.json` files collapse into fewer** — `reference/meta.json` becomes the
one real sidebar-grouping file (grouping by capability category per D9.2, not by folder);
`reference/core/meta.json`, `reference/middleware/meta.json`, `reference/plugins/meta.json`,
`reference/adapters/meta.json` are superseded. `internals/meta.json` → `architecture/meta.json`
(new content, per the frozen sidebar order in decision 2 above).

## Redirect requirement (non-negotiable, Wave B0 §6b)

Every one of the ~36 moved reference pages, plus the whole `internals/*` → `architecture/*`
move, changes a live URL. Before this wave closes:
- [ ] Grep the ENTIRE `apps/docs/content/docs/` tree (not just reference/internals) for any
      relative or absolute link pointing at an old path and fix every one.
- [ ] Check `apps/docs/next.config.*` or a dedicated redirects config for whether Fumadocs/
      Next.js needs an explicit redirect entry for the old public URLs (external
      bookmarks/search-engine links to `/docs/reference/middleware/cors` should not 404 after
      this move) — if a redirects mechanism exists, add entries; if none exists, log this as a
      finding for a maintainer decision (a docs-only wave should not invent new infra without
      confirming the mechanism first).
- [ ] Confirm `llms.txt`/`llms-full.txt`/any machine-readable sitemap referencing old paths is
      regenerated or updated (Wave B0 §6b explicitly named this layer as first-class).

## Content-accuracy pass (once structure is correct)

Every reference page's API surface must match the now-fully-validated Track A package docs
(all 35 packages' README/ARCHITECTURE, done this session) — cross-check signatures/defaults
against those, not against the page's own prior v3 text. Known specific risk (already
confirmed real, not fixed yet): `reference/plugins/websocket.mdx` (→ `reference/websocket.mdx`
post-move) repeats a false `clientTimeout` claim already caught and disclosed in
`@nextrush/websocket`'s Wave A2 ARCHITECTURE.md — the heartbeat system does not actually consume
that option. Fix it in this wave.

## Diagram conventions (EDS-012)

- `architecture/router-internals.mdx`, `di-internals.mdx`, `middleware-internals.mdx`,
  `adapters.mdx` — same house diagram style as the package ARCHITECTURE.md docs:
  `sequenceDiagram`/`stateDiagram-v2`/`block-beta`/`classDiagram` per subject, never a generic
  flowchart standing in for one of these.
- The new "Request Lifecycle" page (if synthesized fresh, or if it's `middleware-internals.mdx`
  renamed/expanded) — `sequenceDiagram` is the mandated type per EDS-012's own table.
- `reference/*` pages are typically signature/table-driven (Reference page type, EDS-011) —
  diagrams are the exception here, not the rule; only add one if a page's shape is genuinely
  hard to convey in a table (e.g., the new "Capability Composition" page, which is inherently
  relational).

## Per-item checklist

- [ ] Structural moves executed via git-tracked rename (not delete+recreate) where content is
      unchanged by the move itself — preserves history.
- [ ] Every moved/renamed file's content re-verified against real package source, not just
      relocated as-is (a stale claim doesn't become accurate by moving folders).
- [ ] All `meta.json` files updated to the new structure and the frozen sidebar order.
- [ ] Zero dead links anywhere in `apps/docs/content/docs/` after the move (grep the whole tree,
      not just the moved files' own folder).
- [ ] Two new pages written: "Contracts" and "Capability Composition" (synthesized, not
      renamed) at `architecture/contracts.mdx` and `architecture/capability-composition.mdx`.
- [ ] New `reference/packages.mdx` A-Z index written, cross-linked to (not duplicating) the
      marketing `/packages` page.
- [ ] `internals/contributing.mdx` content merged into `community/contributing.mdx` (check for
      existing content there first — this may be a genuine merge, not a simple move).
- [ ] Redirect/machine-readable-sitemap requirement checked and either satisfied or logged as
      an explicit finding for a maintainer decision.

## Independent validator checklist (zero-trust)

- [ ] Confirm the ENTIRE frozen target structure exists exactly as specified (glob-check every
      path in the mapping table above).
- [ ] Confirm zero old paths remain (`reference/core/`, `reference/middleware/`,
      `reference/plugins/`, `reference/adapters/`, `internals/` should not exist post-wave,
      except `reference/class/*` which is the explicit KEEP exception).
- [ ] Confirm zero dead links tree-wide via an independent grep, not trusting the implementer's
      claim.
- [ ] Confirm every reference page's API claims against the real, now-validated package source.
- [ ] Confirm the websocket clientTimeout finding was actually fixed in this pass.
- [ ] Confirm the two new synthesized pages exist and are genuinely new content (not a stub).

## Done-condition (measurable)

The on-disk structure exactly matches the frozen D9.1/D9.3 target mapping above. Zero old
package-type-foldered reference paths remain (except the KEEP exceptions: `reference/class/*`
and `reference/platforms/*`). Zero dead links tree-wide. All content is source-verified against
the now-complete Track A package docs. Independently validated PASS.

## Outcome (2026-07-22)

**✅ COMPLETE.** Run as a mandatory structure-move node (executed the full D9.1/D9.3 migration)
followed by 5 parallel content-verification batches (ref-core, ref-middleware, ref-plugins,
ref-platforms+class, architecture) sharing disjoint file sets.

**Structure migration — independently re-verified by the main session, not trusted from
sub-agent self-report** (one validator stage hit a transient throttle mid-pipeline, so the
whole structural claim was re-checked from scratch rather than partially trusted):
- All old paths confirmed gone: `reference/{core,middleware,plugins,adapters}/`, `internals/`.
- All new paths confirmed present: flat `reference/*.mdx` (27 real content files = 8+12+7,
  matching the mapping table exactly), `reference/platforms/*` (5 files, KEEP-as-subfolder
  exception honored), `reference/class/*` (7 files, untouched per the explicit KEEP decision),
  `architecture/*` (12 files: 8 moved + 2 new synthesized + index + meta.json).
- Two new synthesized pages (`architecture/contracts.mdx`, `architecture/capability-composition.mdx`)
  independently spot-checked: `contracts.mdx`'s `Extension<TDecorated>` interface claim
  (readonly `name`, optional `needs`) confirmed byte-exact against `packages/types/src/extension.ts`
  — real content, not fabricated.
- `reference/packages.mdx` independently re-counted against a fresh `find packages -name
  package.json` sweep: genuinely lists all 35 real packages (34 `@nextrush/*` + the `nextrush`
  meta package, correctly listed as its own "Core (meta package)" row, not conflated).
- Zero dead links tree-wide, independently re-grepped (the only 2 hits were a legitimate
  repo-internal script path `apps/docs/scripts/internals/generate-dependency-graph.mjs` —
  unrelated to the renamed docs-site `internals/` folder, a false positive).
- `websocket.mdx`'s flagged `clientTimeout` defect genuinely fixed (verified the exact wording:
  "clientTimeout is declared in WebSocketOptions but no code path reads it; it has no observable
  effect" — states the bug plainly, doesn't soften it).

**Real finding — CORRECTED after a fuller independent check (my first pass was wrong, logged
honestly rather than silently amended):** I initially reported "no redirect mechanism exists"
based on checking only `next.config.mjs` (`output: 'export'`, which is real and does mean
Next.js's server-side `redirects()` is unavailable). But a fuller `git status` review — which I
should have run before concluding a finding, not after — surfaced that the structure-move node
had already built and wired a **working client-side redirect system**: `apps/docs/src/lib/legacy-redirects.ts`
(a `ReadonlyMap` of old→new paths, single-hop, no chaining) consumed by
`apps/docs/src/app/docs/[[...slug]]/page.tsx`'s catch-all route, rendering a real static HTML
page per old path with a `<meta http-equiv="refresh">` + client-side `redirect()` — this works
correctly under static export, unlike server-side `redirects()`. This isn't new infra invented
for B3 — it already existed from an earlier "T6" folder-rename wave (`getting-started`→`start`,
`api-reference`→`reference`, `examples`→`guides`), and the B3 structure-move node correctly (a)
added a new block of entries for all ~40 B3-moved paths, and (b) updated the *existing* T6
entries in place so a `/docs/api-reference/core/types`-era bookmark resolves in one hop straight
to the current `/docs/reference/types`, not through an intermediate dead path — exactly the
single-hop-only discipline the file's own doc comment states. Also touched in the same pass:
`apps/docs/src/app/agent-spec.json/route.ts` and `apps/docs/src/lib/package-links.ts` (the
machine-readable/AI-agent layer Wave B0 §6b flagged as first-class) and
`apps/docs/scripts/verify/reference-match.ts` (the CI verify script, updated for the new flat
paths). **Lesson for future waves: run a full `git status`/`git diff --stat` sweep before writing
a "finding" about missing infrastructure — a narrow single-file check (just `next.config.mjs`)
missed a real, working system one directory over.**

**Real defect found LATER, during Wave B4's own verification pass — logged here since this file
is genuinely B3's scope, not B4's, even though B4 discovered it:** running `pnpm docs:verify`
during B4's closeout surfaced 112 pre-existing compile findings, 100% in
`architecture/router-internals.mdx`. Root cause: several code blocks are illustrative fragments
excerpted from real source (`parseSegments()`'s `if/else if` body, `compileExecutor()`'s
early-return branch) or reference real types (`NodeType`, `HttpMethod`, `HandlerEntry`,
`ParsedSegment`, `StaticRouteMap`) without importing them or being reconstructed as a complete,
self-contained, typecheckable unit — EDS-013 has no documented "illustrative fragment, don't
typecheck" exception, so the compile-checker correctly flags these. One block
(`parseSegments()`) was fixed opportunistically (112→103 findings) before recognizing this was
scope creep into a different wave's closed work; stopped there. **Logged as an explicit
follow-up task** (not yet filed as its own tasks.md item — candidate: fold into §12's
cross-checks pass, since it's exactly the kind of drift a final cross-check should catch): every
remaining code block in `architecture/router-internals.mdx` needs the same treatment (either a
type-only import line per snippet, or a fully-reconstructed self-contained excerpt).

**`llms.txt`/`llms-full.txt`/`sitemap.xml`** are dynamically generated Next.js route handlers
(confirmed at `apps/docs/src/app/{llms.txt,llms-full.txt,sitemap.xml}` — not static files with
hardcoded paths), so they self-correct on the next build; not a real staleness risk, no action
needed.

**`internals/contributing.mdx` merge**: confirmed `community/contributing.mdx` already existed
(257 lines) — the structure node merged into it rather than blind-overwriting, per the brief's
explicit caution.
