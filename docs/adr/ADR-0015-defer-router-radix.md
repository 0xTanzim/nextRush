# ADR-0015 — Defer `@nextrush/router-radix` on evidence-negative T017

- **Status:** `Accepted`
- **Date:** `2026-07`
- **Deciders:** `0xTanzim`
- **Governing RFC:** `docs/RFC/runtime-adapters/015-router-radix.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0007` (adapter contract precedent this RFC's conformance-suite pattern models)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[█████████████░░░░░░░]` **Accepted** — 2 / 3
(no "Shipped" state applies — the decision is to not build the package)

---

## Context

RFC-015 specified a future, opt-in `@nextrush/router-radix` package implementing the shared
`Router` contract, gated on two possible drivers: (a) Fastify-migrant familiarity with
`find-my-way`-style radix routing, or (b) a benchmarked performance win over the shipped
segment-trie router. The RFC deliberately did not pick a driver and set the performance leg as
gated on the T017 route-params benchmark (`report/route-params-profile.md`).

T017 has since run. It found the param path is not allocation-bound (~98% of param allocation is
escape-analysis-eligible), the whole matcher is ~4% of request CPU, and the specific operation
radix would replace (`matchNodeIndexed`'s per-segment `Map.get` walk) is ~1.44% of CPU. The
measured −7.4% RPS gap vs Fastify is dominated by response `writev` (~33%) and JSON serialization
(~4.8%), not routing. This is a concrete result requiring a decision, not a status quo that can
silently continue as "deferred, pending benchmark."

## Decision

We will **not build `@nextrush/router-radix`**, and reclassify RFC-015 from "deferred, gated on
T017" to "deferred, evidence-negative."

Because the performance driver — the only driver with a measurable bar — failed on its own gate:
radix would target 1.44% of CPU to close a 7.4% gap that lives elsewhere in the request path. That
leaves only the familiarity driver, and familiarity alone does not clear RFC-015 §8's dominant
cost: a second matching engine to maintain against a single-maintainer bus factor.

## Options considered

- **Defer, evidence-negative (chosen)** — ✅ the measured data does not support the performance
  driver on this workload shape; building anyway would be optimizing without measurement
  (`AGENTS.md` §11), and familiarity alone is too weak a driver against the §8 maintenance cost.
- **Build `@nextrush/router-radix` from scratch** — ❌ rejected: no confirmed driver clears the
  bar; would add a second engine, its own edge cases, and a docs "which router?" split with no
  demonstrated payoff.
- **Wrap `find-my-way`** — ❌ rejected: CJS-only (`"type": "commonjs"`, no `exports` map), three
  runtime dependencies (`fast-deep-equal`, `fast-querystring`, `safe-regex2`), `engines.node >=
  20`. Violates the zero-dependency rule (`project-rules.instructions.md` §6), the ESM-only policy
  (README, CI-enforced), and runtime independence (`AGENTS.md` §7 — a Node-only router behind a
  cross-runtime contract).
- **Build the conformance harness now anyway, as a hedge** — ❌ rejected for now: with exactly one
  router implementation, `@nextrush/router-conformance` mostly re-labels the 18 test files already
  in `packages/router/src/__tests__/` (including differential goldens) into a driver abstraction
  that has nothing to drive against yet. Revisit only when a second implementation is actually
  greenlit.

## Consequences

- **Positive:** closes an open architectural question with cited evidence instead of leaving it
  "deferred" indefinitely; the router package's public surface and default stay unchanged; no
  second engine added to the single-maintainer surface.
- **Negative / cost:** any future Fastify-migrant who specifically wants `find-my-way`-shaped
  routing has no opt-in path today. If sustained demand materializes, this decision is revisited
  (see reopening conditions below) rather than permanently foreclosed.
- **Neutral:** the T017 measurement work and the RFC's design (contract floor, composition-surface
  gap, conformance-suite shape) remain valid reference material if a second router is ever
  greenlit on different evidence.
- **Follow-up:** none scheduled. Reopens only on (a) a benchmarked win on a route-table shape T017
  did not test (large tables, deep shared prefixes), or (b) sustained, actual Fastify-migrant
  demand — either would warrant a new RFC revision or a superseding ADR, not a silent reversal.

## Compliance / enforcement

By review: RFC-015's status header now states "Deferred — evidence-negative" and points here.
Any future PR adding a second router package is a new-package decision under `AGENTS.md` §20 (RFC-
gated) and must either supersede this ADR or cite a new driver this ADR didn't have.

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing" (here: build anyway).
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism (review + status-header pointer).
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
