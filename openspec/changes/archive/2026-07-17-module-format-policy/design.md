## Context

Current state (source-verified intent): all NextRush packages are `type: module` with ESM-only `exports` — no `require` condition anywhere. Three repo facts materially shape this decision:

1. **Node engine floor is ≥22** (gap-checklist T057). Node unflagged `require()` of a **synchronous** ESM graph in v22.12.0 (LTS backport) and v23.0.0. So a CommonJS consumer on a current Node 22 LTS can already `require()` NextRush's ESM *today* — provided the imported graph has no top-level `await`. This shrinks the classic "CJS can't consume ESM" pain that dual-publishing exists to solve.
2. **The class/DI path relies on a global side effect** (`reflect-metadata` patches global `Reflect`) plus `tsyringe` singletons. This is the exact shape that the ESM/CJS **dual-package hazard** punishes: if both an ESM copy and a CJS copy of a stateful package load in one process, you can end up with two metadata registries or two DI containers and silent, hard-to-debug breakage.
3. **v1.0 freezes packaging across ~35 packages** (T060), guarded by public-surface snapshots (T005) and a bundle budget (T012). Whatever is chosen becomes a long-lived contract, so it must be deliberate.

## Goals / Non-Goals

**Goals:**
- Produce an explicit, documented module-format policy with rationale, ratified by the maintainer, before the v1.0 freeze.
- Keep current ESM consumers unaffected regardless of the outcome.
- Give CJS consumers a clear, documented path (either native `require`, or documented interop).

**Non-Goals:**
- Changing the Node engine floor (owned by T057).
- Widening the public surface (T005 snapshots must stay equivalent across any added condition).
- Committing to dual-publish before the tradeoffs below are weighed — this change may legitimately conclude "ESM-only, documented."

## Decisions

### D1 — RATIFIED: NextRush is ESM-only, permanently
**Status: Decided (2026-07-17). Not open. Not "current default." Not revisited absent a hard external forcing function.**

NextRush publishes ESM only. No package's `exports` map will ever declare a `require` condition. CommonJS output is intentionally not published, is not a roadmap item, and is not a "later" — it is rejected as an architectural direction for this framework. This is the same weight as any other locked architectural invariant (e.g. the zero-dependency functional-core rule) and is enforced in CI (§2), not left to convention.

### D2 — Why: the case for ESM-only, weighed against dual-publish
Rationale, given the three context facts above:
- The Node ≥22 floor already gives current-LTS CJS consumers native `require(esm)` for synchronous graphs — the biggest reason to dual-publish is largely covered by the runtime NextRush already mandates.
- The dual-package hazard is not theoretical here: the `reflect-metadata` global + `tsyringe` container are precisely the state that duplicates badly. A CJS-loaded copy and an ESM-loaded copy of `@nextrush/di` are not the same container — `@Injectable()` can register into one instance while `resolve()` reads from the other, silently, with no exception. Dual-publishing the class/DI path would reintroduce exactly the class of bug ESM-only eliminates by construction.
- Dual output doubles the build/test matrix and `exports` complexity across ~35 packages, forever, not once — every release would need to verify exports map, import condition, require condition, types, declaration maps, source maps, runtime behavior, singleton behavior, and bundler compatibility, twice, on every package, in perpetuity.
- Ecosystem momentum (Hono, modern tooling) is ESM-first; ESM-only is a defensible, forward-looking, already-adopted-by-peers stance, not an outlier position.
- NextRush's target audience is modern Node ≥22 + TypeScript-first applications — not a framework trying to support every Node project ever written. Once that audience is fixed, ESM-only follows from it directly.

**Alternative considered and rejected: dual-publish (ESM + CJS).** Would let `require('nextrush')` work directly, at the cost of a doubled, permanent publishing pipeline and a real dual-package-hazard risk on the DI/decorator-metadata path. The value delivered (avoiding a one-line `await import()` or a documented `require(esm)` note for CJS consumers on Node ≥22.12) does not justify that standing cost. **Rejected.**

### D3 — Comparison of the two options (kept for the historical record)

| Dimension | ESM-only (ratified, D1) | Dual-publish ESM+CJS (rejected) |
|---|---|---|
| CJS `require()` reach | Native on Node ≥22.12 (sync graphs); dynamic `import()` otherwise | Works everywhere, including older setups |
| Dual-package hazard | None | Real — dangerous for reflect-metadata/tsyringe class path |
| Maintenance (≈35 pkgs) | Status quo | Doubled build/test + `exports` complexity, forever |
| Bundle/tree-shaking story (T012) | Clean | Must budget + validate both conditions |
| Surface lock (T005) | One condition to snapshot | Both conditions must stay equivalent |
| Ecosystem alignment | ESM-first momentum | Broadest but against the grain |

### D4 — Dual-publish design: retired, kept only as a record of what was evaluated
The prior draft of this design sketched a conditional dual-publish path (functional core dual-published, `class`/`di` kept ESM-only to sidestep the hazard). That path is **not being built**. It is preserved below, struck through, solely so a future reader understands what was considered and explicitly rejected — not as a deferred TODO.

~~Emit CJS via `tsup` (dual `format: ['esm','cjs']`) and add a `require` condition to `exports`; keep `type: module`. Guard the dual-package hazard by keeping the `class`/`di` path ESM-only. Validate T005 snapshots and T012 budget under both conditions before freeze.~~

## Risks / Trade-offs

- **[ESM-only excludes some CJS consumers]** → document dynamic `import()` interop and the Node 22.12+ `require(esm)` path; state the engine-floor rationale (link T057). Revisit if concrete adopter demand appears.
- **[Recommendation assumes no top-level `await` in the consumable graph]** → verify the core entry graph is TLA-free before publishing the "CJS can `require()` it on 22.12+" guidance; if TLA exists, that guidance is narrower.
- **[Dual-publish dual-package hazard]** (only if D4 taken) → narrow dual-publish to the stateless functional core; never dual-publish the reflect-metadata/tsyringe path without a single-instance guarantee.
- **[Decision drift after freeze]** → the policy is enforced by a packaging-conformance check (spec scenario) so packaging can't silently diverge from the stated policy.

## Migration Plan

- ESM-only outcome: docs-only; no consumer migration. No changeset beyond docs.
- Dual-publish outcome: additive (`require` condition added) — existing ESM consumers unaffected; ship changesets for the packages that gain CJS output; announce the new supported consumption method.

## Open Questions

None. All three were open questions in the original draft; all are now closed:
- ~~The ratification itself: ESM-only vs dual-publish~~ — **Closed. RATIFIED: ESM-only, permanent (D1).**
- ~~If dual-publish: full functional-core-only, or all packages?~~ — **Closed, moot.** No dual-publish is happening.
- ~~Confirm the core entry graph is free of top-level `await`~~ — **Closed, confirmed** (tasks.md 1.2): no top-level `await` in `packages/core/src`, `packages/router/src`, or `packages/nextrush/src`.
