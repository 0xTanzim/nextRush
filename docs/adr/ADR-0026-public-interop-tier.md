# ADR-0026 — Public `interop` package tier

- **Status:** `Accepted`
- **Date:** `2026-08`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/ecosystem-interop/035-express-bridge.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0005`, `ADR-0002`, `ADR-0007`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[██████████████░░░░░░░░]` **Accepted** — 2 / 3

---

## Context

ADR-0005 classifies NextRush packages into `Public — core`, `Public — middleware/registrar`,
`Public — extensions`, `Public — tooling`, and `Internal`. RFC-035 introduces a genuinely new
kind of package: an **interop bridge** that adapts a stable *external* execution contract
(Connect/Express 3-arity middleware) into NextRush `Middleware`.

That package is not portable middleware (`app.use(fn())` on every adapter), so it does not belong
in `Public — middleware`. It is also not a `ServerAdapter`, so it does not belong in the adapter
tiers. Putting it in an existing tier would mis-state its support contract and its runtime scope.

---

## Decision

We will introduce a **`Public — interop`** tier.

Because it is the honest classification for packages that are stable and semver-guarded but are
**Node-shaped raw-HTTP only** — explicitly not portable across Bun/Deno/Edge — and whose support
contract is "adapts a foreign contract," not "is native NextRush middleware."

This is an **additive amendment to ADR-0005 by reference**; the shipped ADR-0005 table is not
rewritten in place. A future reader follows the link here.

---

## Options considered

- **`Public — interop`** — ✅ chosen: names the support contract honestly (stable, Node-only, contract adapter).
- **Fold into `Public — middleware/registrar`** — ❌ rejected: implies cross-adapter portability the bridge does not have.
- **Fold into `Internal`** — ❌ rejected: the bridge is a public, semver-guarded package, not plumbing.
- **Do nothing** — ❌ rejected: leaves a public package with no tier, eroding ADR-0005's "supported vs plumbing" signal.

---

## Consequences

- **Positive:** the support tier is explicit; contributors and users see at a glance that interop packages are stable but not portable.
- **Negative / cost:** one more tier to track; a reader must follow two ADRs (0005 + this one) to see the full table.
- **Neutral:** the existing tiers are unchanged.
- **Follow-up:** if a second interop adapter emerges, revisit whether `@nextrush/compat-core` and a shared interop surface are justified (RFC-035 §17).

---

## Compliance / enforcement

Enforced by the package `README.md` identity block (`Package type: Interop`, `Runtime: Node-shaped raw HTTP only`) and by the workspace import-graph test forbidding core/router/types/runtime/adapters/`nextrush` → `@nextrush/express-bridge`.

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
