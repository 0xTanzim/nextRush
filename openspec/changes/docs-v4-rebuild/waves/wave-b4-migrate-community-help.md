---
wave: B4
track: B
tasks_md_item: 11
depends_on: [B0, B1, B2, B3]
status: complete
---

# Wave B4 — migrate/ + community/ + help/ (frozen IA migration + content v4 rewrite)

## Objective

Like B3, this is a real structural migration Wave B0 froze but has not executed, plus a content
v4-accuracy pass. `resources/` (7 files) retires and splits into a new top-level `help/` folder
and `community/`; `migrate/` gets 2 new pages; `community/` content gets v4-verified.

## The frozen decisions this wave executes (verified against `wave-b0-ia.md`, not assumed)

1. **`resources/` retires, splits in two** (`wave-b0-ia.md` line 92, lines 289-291):
   - `resources/{faq,troubleshooting,glossary,compatibility-matrix}.mdx` → new `help/*.mdx`
   - `resources/{roadmap,changelog}.mdx` → `community/*.mdx`
   - `resources/index.mdx` → becomes `help/index.mdx` (the hub page moves, not duplicates)
   - `resources/package-catalog.mdx` → **retire entirely, do not move.** Independently confirmed
     before this brief was written: its package list is a near-duplicate of the new
     `reference/packages.mdx` (built fresh in Wave B3, verified against all 35 real packages).
     Redirect its old URL straight to `/docs/reference/packages`, don't carry the duplicate
     content anywhere.
2. **`migrate/` gets 2 new pages** (`wave-b0-ia.md` lines 91, 154, 311): `breaking-changes.mdx`
   and `v3-to-v4-docs.mdx` — both `⊕` (new, no v3 source) per the sitemap. `breaking-changes`
   is a genuine v3→v4 API-break list (verify against real source, e.g. the retired
   `@nextrush/decorators`/`@nextrush/controllers` shims, the reference URL flattening from B3,
   the `internals`→`architecture` rename, `plugins`→`extensions` concept rename — these are all
   real v4 changes a migrating v3 user needs to know about). `v3-to-v4-docs` is specifically
   about the DOCS site's own reorganization (a meta page: "if you had this v3 doc URL bookmarked,
   here's where it moved") — distinct from `breaking-changes`, which is about the framework API.
3. **`community/` gets 2 new files** (`roadmap.mdx`, `changelog.mdd` moved in) plus its existing
   `contributing.mdx` (already merged with `internals/contributing.mdx` in Wave B3 — do not
   re-touch unless a real defect is found) and `index.mdx` (v4-verify, and update its
   `meta.json`'s `pages` array for the 2 new arrivals).
4. **Root `apps/docs/content/docs/meta.json`** — remove `resources` from the top-level `pages`
   array, add `help` in its place (matching position). Leave `performance` as-is — its retirement
   into `production/` is a separate, not-yet-executed decision (`wave-b0-ia.md` line 93) that is
   explicitly OUT OF SCOPE for B4 (not in the frozen mapping table's B4 rows) — do not touch it
   in this wave, just don't let it block B4's own `resources`→`help` swap.

## Exact current-state → target-state mapping (verified via `find` before writing this brief)

| Current path | Target path | Notes |
| ------------- | ----------- | ----- |
| `resources/faq.mdx` | `help/faq.mdx` | v4-verify content |
| `resources/troubleshooting.mdx` | `help/troubleshooting.mdx` | v4-verify content |
| `resources/glossary.mdx` | `help/glossary.mdx` | v4-verify content |
| `resources/compatibility-matrix.mdx` | `help/compatibility-matrix.mdx` | **high-risk file — see below** |
| `resources/index.mdx` | `help/index.mdx` | hub page, rewrite framing for `help/`'s scope |
| `resources/roadmap.mdx` | `community/roadmap.mdx` | v4-verify content |
| `resources/changelog.mdx` | `community/changelog.mdx` | v4-verify content |
| `resources/package-catalog.mdx` | **retire, redirect to `/docs/reference/packages`** | do not move content, it's a duplicate |
| `resources/meta.json` | delete (superseded by new `help/meta.json` + `community/meta.json` updates) | |
| *(new)* | `help/meta.json` | 5 real files: index, faq, troubleshooting, glossary, compatibility-matrix |
| *(new)* | `migrate/breaking-changes.mdx` | new content, real v4 API breaks |
| *(new)* | `migrate/v3-to-v4-docs.mdx` | new content, docs-site reorg map |

## Known risk area — `compatibility-matrix.mdx` (extra scrutiny)

This exact file was the subject of a real, deliberately-unresolved cross-document conflict
found in Wave B1: `docs/adr/ADR-0005` classifies all non-node adapters (bun/deno/edge/serverless)
as "Internal... until GA, may change without a major bump," while this file calls them "Stable."
B1's new onboarding pages followed this matrix (the reader-facing source) and logged the
conflict rather than resolving it. **Do not silently resolve it here either** — but DO verify
the matrix's specific version/tier claims are still accurate against the now-fully-validated
Track A package docs (all 35 packages, done this session) before moving it to `help/`. If the
matrix's claims have drifted further from Track A's validated docs, fix that drift; the
matrix-vs-ADR *policy* conflict itself stays logged, not resolved, per the established pattern.

## Content-accuracy pass

- `help/faq.mdx` — cross-check the "35 publishable packages" / dependency-chain claims against
  the now-complete Track A docs and `.kiro/steering/architecture.instructions.md`'s real
  hierarchy (`types → errors → core → router → di → class → adapters → middleware`).
- `help/troubleshooting.mdx` — verify any error-message/stack-trace examples against real
  `@nextrush/errors` behavior (Track A validated).
- `help/glossary.mdx` — verify terminology matches the canonical terms table in
  `documentation.instructions.md` (segment trie, not radix tree; Context/ctx capitalization).
- `community/roadmap.mdx`, `community/changelog.mdx` — these are project-status pages, not API
  claims; verify they don't contradict the root `CHANGELOG.md` or make a stale "coming soon"
  claim about something already shipped (e.g. anything Track A/B1-B3 just built this session).
- `migrate/breaking-changes.mdx` — every listed break must be a REAL, verifiable v4 change
  (grep git history / CHANGELOG.md / the retired-package removal, not invented examples).

## Diagram conventions

None of these page types typically warrant a diagram (Migration/FAQ/Glossary/Changelog are
list- or table-shaped per their EDS page-type standards) — do not add one unless a specific
page's content is genuinely relational enough to need it (unlikely here).

## Per-item checklist

- [ ] Structural moves executed via `git mv` where content is unchanged by the move itself.
- [ ] `resources/package-catalog.mdx` retired (not moved) with a redirect entry added to
      `apps/docs/src/lib/legacy-redirects.ts` (the real, working redirect system built in Wave
      B3 — extend it, don't invent a second mechanism).
- [ ] All ~9 old `resources/*` paths get redirect entries in the same file, single-hop to final
      `help/*` or `community/*` paths (matching B3's established pattern exactly).
- [ ] `help/meta.json`, `community/meta.json` created/updated; `resources/meta.json` deleted;
      root `apps/docs/content/docs/meta.json` updated (`resources`→`help` swap only).
- [ ] 2 new `migrate/` pages written with real, verifiable content — not fabricated breaking
      changes.
- [ ] Grep the WHOLE `apps/docs/content/docs/` tree for any link pointing at an old
      `resources/*` path and fix every one to its new `help/*` or `community/*` target.
- [ ] `compatibility-matrix.mdx`'s content re-verified against Track A docs; the ADR-0005
      conflict stays logged, not resolved.
- [ ] Zero dead links introduced.

## Independent validator checklist (zero-trust)

- [ ] Glob-confirm the full target structure exists exactly (every path in the mapping table).
- [ ] Glob-confirm zero old `resources/*` paths remain, including `resources/meta.json`.
- [ ] Confirm `package-catalog.mdx` was retired (not silently duplicated into `help/` or
      `community/`) and has a redirect entry.
- [ ] Independently re-grep the whole tree for dead links — do not trust the implementer's list.
- [ ] Confirm the redirect map extension follows the single-hop discipline (no chained old→old→new).
- [ ] Confirm `migrate/breaking-changes.mdx`'s claims are real (spot-check 3 against actual
      source/CHANGELOG.md), not fabricated to sound plausible.
- [ ] Confirm the ADR-0005/compatibility-matrix conflict is still explicitly logged, not quietly
      resolved one way or the other without a maintainer decision.

## Done-condition (measurable)

`help/` (5 files) and updated `community/` (4 files) exist exactly per the mapping table.
`resources/` no longer exists on disk. 2 new `migrate/` pages exist with real content. Zero
dead links tree-wide. Redirect map extended correctly. Independently validated PASS.

## Outcome (2026-07-22)

**✅ COMPLETE.** Run as a mandatory structure node (executed the resources/→help+community split,
retired package-catalog.mdx, wrote the 2 new migrate/ pages, extended legacy-redirects.ts)
followed by a content-verification node, with 3 heal-loop iterations before closing.

**Structure migration — independently re-verified**: `resources/` fully gone (0 files remain,
including `meta.json`); `help/` has exactly the 5 mapped files; `community/` correctly gained
`roadmap.mdx`+`changelog.mdx` alongside the pre-existing `index.mdx`/`contributing.mdx`;
`package-catalog.mdx` retired (not duplicated) with a working redirect straight to
`/docs/reference/packages`; root `meta.json`'s `resources`→`help` swap correct, `performance`
correctly left untouched (separate, not-yet-executed decision, explicitly out of scope).

**Real defects caught and fixed across 3 heal-loop rounds:**
- `help/troubleshooting.mdx`'s error-response-shape callout omitted the `cause` field, which
  `packages/errors/src/base.ts`'s real `toJSON()` conditionally serializes under the same
  `expose` gate as `details` — fixed to disclose both fields and `cause`'s redacted shape.
- `community/roadmap.mdx` had 2 real staleness gaps: `@nextrush/adapter-serverless` was listed
  under "Planned" despite being shipped/Stable (confirmed via Wave A3's validated docs), and
  `@nextrush/health` was missing entirely from the shipped-middleware list.
- `help/compatibility-matrix.mdx`'s package tables claimed "35 total" but only listed 33 rows —
  `adapter-serverless` and `health` were both missing; added, now genuinely 35.
- `help/faq.mdx`'s package-hierarchy chain omitted `runtime` between `router` and `di` —
  corrected to match `architecture.instructions.md`'s real chain exactly.
- **`migrate/breaking-changes.mdx` — the most serious finding, caught 3 times by the validator
  before being fixed**: claimed `ServeOptions.hostname`/`ServerInstance.hostname` was "Removed,"
  replaced by `host`. Independently verified against `packages/adapters/{node,bun,deno}/src/adapter.ts`:
  `hostname` remains a live, currently-documented compat alias in `address()`/`onListen()` —
  never removed. This was a fabricated breaking-change claim. The recurring loop-back kept
  routing this fix to a node whose `files_forbidden` explicitly excluded `migrate/` (an
  orchestration-scoping mistake on my part, not a content problem) — fixed directly by the main
  session by removing the false table row entirely (no "still supported" section exists on this
  page to redirect the claim into, and inventing one for a single field would be scope
  expansion beyond a migration page's job of listing real breaks).

**ADR-0005/compatibility-matrix conflict**: confirmed genuinely NOT previously disclosed
anywhere in the live docs (zero prior mentions found) — the implementer added a new, explicit
warn-Callout naming both documents' conflicting classifications, without resolving the
underlying policy question either direction. This is a disclosure addition, not a resolution;
flagged by the implementer itself as slightly beyond "preserve the existing framing" (since no
existing framing existed to preserve) — judged correct given the brief's explicit instruction
that the conflict "must stay logged, not silently resolved."

**Cross-wave finding surfaced during closeout (logged, not fixed here — genuinely Wave B3's
scope): see `wave-b3-reference-architecture.md`'s outcome section for `architecture/router-internals.mdx`'s
~100 remaining `pnpm docs:verify` compile findings** (illustrative code fragments that don't
typecheck standalone). One block was opportunistically fixed before recognizing this belonged to
a different wave's already-closed scope; the rest logged as a follow-up rather than absorbed
into B4's budget.

**Mechanical sweep**: `pnpm docs:verify` confirms zero findings of any kind touch any B4 file
(help/, community/, migrate/breaking-changes.mdx, migrate/v3-to-v4-docs.mdx) — all 108 remaining
findings (after the one router-internals fix) are pre-existing Wave B3 scope. Zero dead links,
zero `{{ }}` placeholders, zero retired terms across all B4 files.
