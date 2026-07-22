---
wave: A3
track: A
tasks_md_item: 5
depends_on: [A1, A2]
status: complete
---

# Wave A3 — Tier-3 adapters & tooling (8 packages) — COMPLETE 2026-07-22

## Objective

Author/re-align `README.md` + `ARCHITECTURE.md` for the 8 Tier-3 packages, from the frozen
templates, to the same source-verified bar established across A1 (7 packages) and A2 (19
packages). This is the **last Track A wave** — after this, all 34 publishable packages minus
the meta `nextrush` package (task 6, separate) have compliant docs.

## Scope — exact paths (verified before dispatch, do not assume)

**Path correction found before dispatch** (same class of error as A2's `packages/middleware/`
correction): adapters live at `packages/adapters/<name>/`, **not** `packages/adapter-<name>/`.

| Package | Real path | README | ARCHITECTURE |
| ------- | --------- | :----: | :-----------: |
| `@nextrush/adapter-node` | `packages/adapters/node/` | exists, needs re-align check | missing — create |
| `@nextrush/adapter-bun` | `packages/adapters/bun/` | exists, needs re-align check | missing — create |
| `@nextrush/adapter-deno` | `packages/adapters/deno/` | exists, needs re-align check | missing — create |
| `@nextrush/adapter-edge` | `packages/adapters/edge/` | exists, needs re-align check | missing — create |
| `@nextrush/adapter-serverless` | `packages/adapters/serverless/` | exists, needs re-align check | missing — create |
| `@nextrush/dev` | `packages/dev/` | exists, needs re-align check | exists, needs re-align check |
| `@nextrush/testing` | `packages/testing/` | exists, needs re-align check | missing — create |
| `create-nextrush` | `packages/create-nextrush/` | exists, needs re-align check | missing — create |

**Explicitly out of scope**: `packages/adapters/conformance` — `private: true` in its
`package.json`, internal test-only infrastructure, not one of the 35 publishable packages. Do
not author docs for it.

## Depth (per `documentation.instructions.md`'s Tier 3 definition)

Purpose → install → minimal usage → reference → one example. Lighter than Tier 1/2 — these are
either thin platform-glue packages (adapters) or standalone dev tools, not core framework
surface most users read deeply.

## Per-package known risk areas (extra scrutiny for validators — from architecture.instructions.md
and this session's established patterns)

- **`adapter-node`**: `listen()`/`serve()` genuinely live here (Wave A1 finding — `runtime`
  does NOT have them, corrected in local steering already). Confirm `GracefulShutdownOptions`
  shape (cited by A2's `health` package) against real source here, not assumed.
- **`adapter-bun`**: A2's Wave B1 finding — this package is Stable/1.0.0 per the compatibility
  matrix, NOT "Internal tier" (that claim was found and fixed in `bun.mdx` this session — verify
  the package's OWN README doesn't repeat the same stale claim). Body-size-limit default (1MB)
  should match Node's, per the same B1 finding.
  Do NOT introduce a new "Internal tier" claim in this package's own docs.
- **`adapter-deno`**: verify actual Deno API usage (`Deno.serve` vs a compat shim) against src,
  not assumption.
- **`adapter-edge`**: covers BOTH Cloudflare Workers and Vercel Edge per the frozen IA split
  (confirmed in Wave B0's final review) — verify the package's own scope matches that, or if
  it's narrower/broader than the docs-site onboarding pages assumed, log it as a finding.
- **`adapter-serverless`**: B1 found `ctx.runtime` reports `'edge'` on Lambda (built on
  `adapter-edge`'s engine, whose `detectEdgeRuntime()` has zero AWS branches) — confirm this
  package's own docs don't repeat the pre-existing wrong claim (`'node'`) that B1 fixed
  elsewhere.
- **`dev`**: already has both files — this is a re-align/re-verify pass, not a from-scratch
  write. Confirm CLI command surface (`nextrush dev`/`build`/`generate ...`) against real
  `bin`/`src` entry points, not the root README's possibly-stale CLI section.
- **`testing`**: verify the `createTestModule().override().compile()` API (cited in root
  README) against real source — confirm exact chainable method names, don't assume the shape.
- **`create-nextrush`**: verify the 3 scaffold styles (functional/class-based/full) and the
  generated-output claims — Wave B1 already found and fixed 2 real defects in the *docs-site's*
  `create-nextrush.mdx` onboarding page (missing `uptime` field, fabricated `not-found.ts`) —
  do NOT re-introduce either defect in this package's own README/ARCHITECTURE if it shares
  source text with that page.

## Diagram conventions (same house style, EDS-012)

- Adapter packages: `sequenceDiagram` for the request-handling/listen flow (each adapter's own
  entry-to-response path), `block-beta` for position in the package hierarchy — NOT flowchart.
- `dev`: `sequenceDiagram` for the CLI command execution flow if genuinely sequential/time-ordered.
- `testing`: `sequenceDiagram` for the test-module compile/override/resolve flow.
- `create-nextrush`: `sequenceDiagram` for the scaffold generation flow (prompt → template
  selection → file generation).
- README.md is always ASCII-only (no Mermaid renders on npm).

## Per-item checklist (each package)

- [ ] Read real `src/` (or `bin/`) directly — Tier 3 packages are typically small enough for a
      full direct read, codebase-memory-mcp search only if the package is large.
- [ ] README.md rewritten to `docs/templates/package-readme.template.md`, ASCII-only.
- [ ] ARCHITECTURE.md created/rewritten to `docs/templates/package-architecture.template.md`
      at Tier-3 depth (lighter than Tier 1/2 — purpose/install/usage/reference/example, still
      diagram-compliant).
- [ ] Every factual claim (API signature, default, CLI command, generated file) verified
      against source, not assumed or carried over from the root README/docs-site pages.
- [ ] No `{{ }}` / `<PLACEHOLDER>` remnants.
- [ ] No forbidden marketing words, no "radix tree".
- [ ] Diagram types per the table above — no basic flowchart standing in for a genuine
      sequence/lifecycle.
- [ ] Any real engineering finding (bug, inconsistency, dead code) logged honestly in the docs
      and in this brief — never silently patched in a docs-only wave.

## Independent validator checklist (zero-trust, different context from the implementer)

- [ ] Re-derive every claim from real source directly — do not trust the implementer's summary.
- [ ] Confirm the path-correction table above was actually followed (no `adapter-<name>` typo
      paths created).
- [ ] Confirm `conformance` was NOT touched.
- [ ] Confirm each of the 8 packages' specific known-risk-area claim (table above) against source.
- [ ] Confirm README ASCII-only, diagram types correct, no placeholders/forbidden words.
- [ ] Glob-confirm all 8 packages have both files present at wave close.

## Done-condition (measurable)

All 8 packages under the corrected paths have `README.md` + `ARCHITECTURE.md`, each
independently validated PASS, `conformance` untouched, zero known fabrications outstanding.

## Outcome (2026-07-22)

**✅ COMPLETE — all 8/8 packages done, all 16 files present, source-verified.**

Run as 8 parallel implementer/validator pairs (adapters are independent of each other, unlike
A1/A2's sequential batches — this cut wall-clock time significantly). One sub-agent stage
(`serverless-validate`) hit a transient throttling error mid-run — recovered per the
established pattern: verified the implementer's already-landed work against source directly
rather than re-running the pair.

**Risk-area claims, all independently confirmed correct:**
- `adapter-bun`: correctly documents Stable/1.0.0 throughout — no stale "Internal tier"
  language reintroduced (re-verified via grep after the sub-agent pipeline finished).
- `adapter-edge`: correctly scopes to Cloudflare Workers + Vercel Edge + Netlify Edge (any
  Fetch-API edge runtime) — broader than the brief's stated minimum (Workers+Vercel), which is
  accurate to the real "any Fetch API runtime" design, not an overclaim.
- `adapter-serverless`: correctly documents `ctx.runtime === 'edge'` (never `'node'`) on every
  provider, with the exact mechanism cited (`createLambdaHandler` imports
  `createFetchHandler as createEdgeFetchHandler` from `@nextrush/adapter-edge` — confirmed via
  direct grep of `adapter.ts`/`lambda-streaming.ts`, not assumed).
- `create-nextrush`: no fabricated generated-file claims found (the `{{ }}` grep hit in
  ARCHITECTURE.md was a false positive — legitimate prose describing the real template-
  substitution engine, not a leftover placeholder; confirmed by reading the surrounding text).

**Real defect found and fixed post-pipeline (main session, not sub-agent):** `packages/dev/README.md`
(a re-align pass on an already-existing file, not a from-scratch write) had 48 lines with
non-ASCII characters — em-dashes, emoji (⚡🐢✅❌🧪), arrows, box-drawing directory-tree
characters (├──│└──) — violating the hard "README.md is ASCII-only" rule (npm renders no
Mermaid/Unicode-art reliably). The `dev-impl` sub-agent's own self-check evidently didn't run
a byte-level ASCII grep despite claiming a re-align pass. Fixed directly: emoji/em-dash/arrow
replaced with plain ASCII equivalents, the box-drawing directory tree rebuilt with `|--`/`` `-- ``
ASCII tree characters. Re-verified: 0 non-ASCII bytes remain, tables still render sensibly.

**Process lesson (parallels the A2/stream lesson):** a sub-agent's own "ASCII-only confirmed"
self-report is not sufficient — independent re-verification via direct `grep -P '[^\x00-\x7F]'`
against every README caught a real violation in a file the implementer explicitly described as
already re-checked. This reinforces §6's "never trust self-report" rule at the mechanical-check
level, not just the factual-claim level.
