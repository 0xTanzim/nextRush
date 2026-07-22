## Context

`create-nextrush` is the scaffolder every developer runs first. The review
(`report/scaffolding/scaffolding-cli-review.md`, commit `6ab26e9`) found the design clean but the
result non-installable: `npm-version.ts` probes only `nextrush` + `@nextrush/cors` and reuses those two
ranges for ~10 packages, while `.changeset/config.json`'s `fixed` group proves `@nextrush/dev`,
`@nextrush/rate-limit`, `@nextrush/request-id`, `@nextrush/adapter-bun`, `@nextrush/adapter-deno` are
independently versioned (`1.x`, not `3.1.0`). Every generated project therefore pins `@nextrush/dev:
^3.1.0` and fails to install; `execSync(..., { stdio: 'ignore' })` hides the cause.

The generated projects also miss production defaults (`engines`, `packageManager`), ship an SWC-unsafe
`tsconfig` (no `isolatedModules`), hardcode drifting toolchain versions, ignore private registries, and
carry README drift. The Deno class-based path bypasses the toolchain and emits no `deno.json`, so DI
cannot work in dev.

This design records the decisions to fix these under a new `project-scaffolding` capability, and — because
the user's requirement is that this be executed autonomously, one node at a time, by sub-agents — it also
records the execution model (how the task graph maps onto the `software_engineer` planner→implementer→
validator→integrator pipeline with blast-radius gating and a closed-loop verifier).

The governing RFC (`docs/RFC/scaffolding/021-project-scaffolding-capability.md`, RFC-021 — confirmed
next-free; RFC-020 is taken by `framework-composition-integrity`) and its ADR (ADR-0011 — confirmed
next-free; ADR-0010 is taken by `cross-runtime-parity-hardening`) record the durable architecture and
MUST land before archive; this document does not restate them.

## Goals / Non-Goals

**Goals:**
- Make every generated `{style, runtime, middleware}` combination install, build, and run with working DI.
- Replace the two-probe version proxy with per-package resolution + an offline per-package fallback map,
  and prove it with a generate-then-install CI matrix (the verifier that was missing).
- Give generated projects production-ready, framework-consistent config, scripts, docs, and defaults.
- Decompose the work so each fix is an independently-executable node with a measurable done-predicate,
  suitable for autonomous one-at-a-time execution by sub-agents.

**Non-Goals:**
- No change to `create-nextrush`'s public API (exported functions/types stay locked).
- No re-opening of the `dev-tooling` capability. The builder-side metadata guarantee (Deno build
  correctness, Bun `design:paramtypes` emission) is `dev-tooling`'s and is consumed, not restated.
- No new interactive features, template styles, or runtimes — this hardens what exists.
- No move off `@clack/prompts` or the SWC toolchain.

## Decisions

**D1 — New `project-scaffolding` capability, not an extension of an existing one.** No fixed capability
owns `create-nextrush`; `adapter-development-kit` owns only `generate adapter`, and `dev-tooling` is
scoped to `@nextrush/dev`. This is the exact precedent that justified `dev-tooling`. *Alternative
rejected:* folding scaffolder requirements into `dev-tooling` — it would blur two distinct packages/products
and make each capability's scope unanswerable.

**D2 — Per-package version resolution with a build-time per-package fallback map (fixes F-01).** Resolve
every emitted dependency from its own `/{pkg}/latest`, in parallel under one time budget; for
offline/failure, fall back to a map injected at build time by reading each workspace `package.json` in
`tsup.config.ts` (replacing the two `__CORE_RANGE__`/`__MW_RANGE__` scalars). *Alternatives rejected:*
(a) keep two probes but add packages to the changeset `fixed` group — couples release cadence framework-wide
and fights the documented independent-versioning model; (b) hardcode a version table in templates — the
exact staleness the dynamic probe was built to avoid.

**D3 — The verifier lands as a CI matrix, and it is the gate, not a unit test (fixes F-01's root cause).**
Per `loop-engineering.md`, F-01 shipped because the only verifier (`generator.test.ts`) mocked versions and
asserted structure — it never checked "does this install?". The fix is a generate-then-install matrix over
every `style × runtime × middleware` cell, run against publish versions (real install where a runtime is
available in CI, `npm install --dry-run`/`npm view` resolution check otherwise). *Alternative rejected:*
a richer unit test with a mocked registry — it would re-encode the same wrong assumption and still never
touch a real resolver.

**D4 — Deno correctness is generated config + script routing, referencing `dev-tooling` for the builder
(fixes F-02, resolves the conflict).** For `deno` + class-based/full, the generated project routes
`dev`/`build` through the `@nextrush/dev` toolchain (whose `dev-tooling` requirement "Production build is
correct and metadata-emitting on every supported runtime" already guarantees Deno metadata) **or** emits a
`deno.json` with `experimentalDecorators`/`emitDecoratorMetadata` + `nodeModulesDir`. Generated scripts drop
`@latest` and blanket `-A` in favor of pinned toolchain references and a scoped permission set.
*Alternative rejected:* re-implement decorator handling inside the generated Deno dev script — duplicates
`dev-tooling` and re-creates the drift the sibling change just eliminated.

**D5 — Bun is a consumption boundary, not new work here (resolves the F-04 conflict).** The review's F-04
(Bun `Bun.build` metadata) is owned by `dev-tooling`, which already adds a Bun decorator-metadata
conformance test. `project-scaffolding` only asserts that the *generated* Bun project's `tsconfig` carries
the decorator flags and its scripts invoke the toolchain, then relies on the `dev-tooling` guarantee.
*Alternative rejected:* add a second Bun metadata test here — duplicate verification of another capability's
contract.

**D6 — Generated config matches the framework's own standards (fixes F-06, F-07, F-08).** Add
`isolatedModules` (and `verbatimModuleSyntax` where the templates compile clean under it) to the generated
`tsconfig`; add `engines.node` + `packageManager` to the generated `package.json`; resolve + single-source +
engine-align `typescript`/`@types/node` via the same D2 resolver/fallback. *Alternative rejected:* leave the
generated project looser than the framework — holds new users to a weaker bar than the framework holds itself.

**D7 — Registry-aware resolution (fixes F-09).** Read `npm_config_registry` (set by npm/pnpm/yarn under
`npm create`) before defaulting to npmjs, so D2 works behind a proxy/private mirror. *Alternative rejected:*
keep npmjs hardcoded — D2's correctness would silently not apply in the environments that most need it.

**D8 — Generated docs derive from the emitted file map (fixes F-10).** The generated README's structure
section is produced from the actual `FileMap`, not a hardcoded per-style guess, and the package README
lists only files the generator emits (no phantom `not-found.ts`). *Alternative rejected:* hand-fix the two
current drifts — they would drift again on the next template edit.

**D9 — Convention + onboarding fixes are low-blast-radius, batched last (fixes F-11, F-12…F-19).** Scoped
controller glob, a `test` script + example test, consistent app idiom, initial git commit, prompt-skip on
explicit flags, `NextRush` branding, a next-step URL, and install-gated version probing. Each is
independent and reversible.

## Autonomous Execution Model (sub-agents + loop engineering)

This change is written to be executed **one node at a time, autonomously**, by the `software_engineer`
sub-agent pipeline. `tasks.md` is the operational contract; this section is how it is meant to run.

- **Loop type: closed.** Every node has a pinned, measurable done-predicate (a specific test green, a
  specific gate passing) declared before work starts. The whole change's done-condition is: the D3 matrix
  gate is green for every `style × runtime × middleware` cell, plus per-package coverage ≥90%, tsc-strict
  clean, and ESLint clean. No open-ended "make it better."
- **Verifier ≠ generator.** Each implementer node is checked by a separate Validator pass that re-runs the
  node's done-predicate from raw tool output (never the implementer's self-report). The D3 matrix gate is
  the system-of-record verifier for the P0 install claim — it is a *different context* than whatever wrote
  the resolver, by construction.
- **Wave ordering (dependency DAG).** The task groups form waves; within a wave, nodes are parallelizable
  because they touch disjoint files:
  - **Wave 0 — RFC gate (serial, blocking):** author the RFC + ADR (new-capability gate). Nothing else
    merges first.
  - **Wave 1 — Verifier backstop (land FIRST, mirrors dev-tooling D2):** the generate-then-install matrix
    (D3) and the per-package resolver's failing unit tests. These define "done" for Wave 2 and must exist
    (RED) before the resolver is written.
  - **Wave 2 — P0 install integrity (serial on the resolver, then parallel):** D2 resolver + fallback map;
    then F-03 diagnostics. Turns Wave 1's matrix from RED to GREEN.
  - **Wave 3 — P1 runtime honesty (parallel):** D4 Deno config/scripts; D5 Bun consumption assertion. Each
    lands with its own runtime smoke test.
  - **Wave 4 — P2 generated-config correctness (parallel):** D6 (tsconfig, package.json metadata, toolchain
    versions), D7 (registry), D8 (docs-from-FileMap). Disjoint files → parallel implementers.
  - **Wave 5 — P2/P3 conventions & onboarding (parallel):** D9 batch.
  - **Wave 6 — Gates (serial, closing):** coverage ≥90%, tsc/ESLint clean, `openspec validate --strict`,
    and the full matrix green.
- **Isolation.** Each parallel implementer node runs in its own git worktree/branch (per
  `loop-engineering.md` isolation): Wave 4/5 nodes touch disjoint files (`tsconfig` gen vs `prompts.ts` vs
  README gen), so they cannot collide. The Integrator merges 0–3 blast-radius nodes as soon as validated and
  holds any 4+ for its gate.
- **Blast radius.** Most nodes are low blast radius (edit one generator function; `git revert` is a clean
  undo; scaffold output is regenerable). The two that rate higher and get the promotion gate: D2 (touches
  every generated `package.json`) and the D3 CI gate (shared CI). These merge only after their Validator
  pass and the matrix is green.
- **Conflict handling is pre-decided, not discovered mid-run.** The one real cross-capability conflict —
  Deno/Bun build metadata — is resolved in D4/D5 by making `dev-tooling` the owner and `project-scaffolding`
  the consumer. An implementer that finds itself about to edit `packages/dev` has left scope: that is a
  Finding to route back, not a silent cross-capability edit.

## Risks / Trade-offs

- **[Per-package resolution adds N registry calls at scaffold time]** → Mitigation: one `Promise.all` under a
  single shared timeout budget (same 5s ceiling as today); the fallback map covers offline instantly.
- **[The fallback map can go stale if `tsup.config.ts` stops reading a package]** → Mitigation: the D3 matrix
  gate runs against publish versions, so a stale map that produces an unresolvable range fails CI.
- **[CI matrix cost grows with combinations]** → Mitigation: full install only where the runtime is present in
  CI; `--dry-run`/resolution check elsewhere; the combination set is small and bounded.
- **[`verbatimModuleSyntax` may surprise beginners with `import type` errors]** → Mitigation: adopt
  `isolatedModules` as the floor; add `verbatimModuleSyntax` only if the emitted templates compile clean under
  it (verified by the generated-project smoke build).
- **[`packageManager` + Corepack can trip users without Corepack]** → Mitigation: emit it only for an
  explicitly detected/selected non-npm manager, and document it.
- **[Editing generated Deno scripts could diverge from `dev-tooling` again]** → Mitigation: D4 routes through
  the toolchain by default; the generated Deno smoke test asserts DI resolves, catching divergence.

## Migration Plan

Phased, each phase single-concern and revertible, matching the wave order above:
1. **RFC gate** — author RFC + ADR for `project-scaffolding` (blocks archive, not implementation start of the
   backstop).
2. **Verifier backstop** — generate-then-install matrix + failing resolver unit tests (RED).
3. **P0** — per-package resolver + fallback map (D2) → matrix GREEN; then install/git diagnostics (F-03).
4. **P1** — Deno generated config/scripts (D4); Bun consumption assertion (D5), each with a runtime smoke test.
5. **P2** — generated tsconfig/package.json/toolchain versions (D6), registry-aware resolution (D7),
   docs-from-FileMap (D8).
6. **P2/P3** — conventions & onboarding batch (D9).
7. **Gates** — coverage/lint/tsc + `openspec validate --strict` + full matrix green; then archive after the
   RFC/ADR are recorded.

Rollback: every phase reverts independently; the only shared-surface edits (D2, D3) are gated and are pure
additions/replacements with no persisted state.

## Open Questions

- **Real install vs resolution-only per CI runner:** which runtimes are present in the CI image determines
  where the matrix does a full `install` vs a `--dry-run` resolution check. Confirm against the runtime-
  conformance workflow the sibling `dev-tooling-reliability` change added.
- **`verbatimModuleSyntax` vs `isolatedModules` for generated projects:** decide during Wave 4 by building the
  generated templates under each; adopt the stricter one only if the templates compile clean.
- **Exact RFC/ADR numbers:** RFC-021 / ADR-0011, confirmed against the current indexes (RFC-020 and
  ADR-0010 are already taken).
- **`deno.json` vs toolchain-routing for the Deno default:** D4 permits either; pick the one that keeps the
  Deno dev experience closest to Node/Bun (prefer toolchain routing) unless a generated `deno.json` proves
  simpler for users running raw `deno task`.
