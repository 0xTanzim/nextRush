# ADR-0029 — Runtime-scoped budgets and deferred AOT

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/040-resource-budgets-and-request-path-footprint.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0028`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[██████████████░░░░░░]` **Accepted** — 2 / 3

---

## Context

The performance gate compared NextRush with Hono in the same process on Bun and Node, but a rule
could be evaluated on a runtime it was never measured on, or silently skipped. A `bun`-only
in-process rule evaluated on Deno, or a rule for a stage that never ran, could produce a green
summary that proved nothing. Separately, RFC-040's AOT program stayed deferred behind four
re-open criteria; those criteria had no recorded evaluation against the current gate.

## Decision

1. **Every budget rule declares the runtimes and the stage it applies to.** `gate()` refuses a
   rule that does not list the current runtime, and the `stageBookkeeping` finalizer fails the run
   when an applicable rule was never evaluated. A skipped rule is a red gate, not a silent pass.
2. **AOT stays deferred.** The four RFC-040 §17 criteria were checked against this change's
   numbers: `cold.n1000.vs_hono` = 0.48 (bar 1.5), registration ≈2.5 µs/route (bar 25 µs), no
   NextRush schema-compile engine exists (compile cost 0 ms), no deploy-target threshold measured,
   and no application reports >10,000 routes.

Because a ratio without its runtime scope is not a gate, `budgets.json` carries
`runtimes: ["bun"]` or `["bun", "node"]` explicitly, and the Deno leg is opt-in.

## Options considered

- **Runtime-scoped rules + explicit stage coverage** — ✅ chosen: a misapplied rule fails loudly.
- **Global rules with per-runtime opt-outs** — ❌ rejected: an unlisted runtime silently inherits
  a budget it never measured.
- **Do nothing** — ❌ rejected: the summary could pass while a rule was never evaluated.

## Consequences

- **Positive:** the gate's PASS counts now mean "every applicable rule ran and passed"; adding a
  runtime without a rule is a visible gap.
- **Negative / cost:** every new rule needs a `runtimes` list and a stage, and the finalizer adds
  a bookkeeping pass; a rule moved across runtimes must be re-measured.
- **Neutral:** wire ratios stay informational because loopback spread is ±20 %.
- **Follow-up:** a future AOT RFC must re-open the criteria, not inherit a stale verdict.

## Compliance / enforcement

`apps/benchmark/scripts/dev-check/lib/__tests__/budget-rules.test.mjs` covers runtime rejection,
unknown runtimes, empty runtime lists, uncovered rules and stage selection. `check.mjs` prints the
finalizer result, and any uncovered applicable rule makes the run fail.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
