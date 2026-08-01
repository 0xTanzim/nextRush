# ADR-0021 — Fast-property request containers derived from a shared null-prototype base

- **Status:** `Accepted · Shipped`
- **Date:** `2026-07`
- **Deciders:** Framework maintainer
- **Governing RFC:** `—` <!-- measured optimization of an existing requirement, not a new capability -->
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0017` (canonical request path)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Shipped** — 3 / 3

---

## Context

Every per-request key/value container the framework hands to application code — `ctx.params`,
`ctx.query`, `ctx.headers` — was built with `Object.create(null)`. The requirement driving that
choice is prototype-pollution safety: a key named `__proto__`, `constructor` or `prototype` must
bind as an own key, and no inherited `Object.prototype` member may be visible. That requirement is
about the **prototype chain**.

`Object.create(null)` also, as a side effect nobody was watching, puts the object into V8
**dictionary (slow) property** mode. Dictionary-mode property loads cannot be inline-cached, so the
cost is not just construction — **every `ctx.params.id` and `ctx.query.q` read in every handler,
forever, is a dictionary lookup**. The framework was exporting a permanent deoptimization to
application code, which inverts AGENTS.md §4.

Measured with `%HasFastProperties` **[M]**: `ctx.params` and `ctx.query` both reported `false`.
Route-params was one of only three benchmark scenarios losing to Fastify at both @1 and @256
concurrency, and 64% of a one-param match's allocation was the container alone.

The trigger was `reports/investigations/2026-07-31-measured-floor-params-compliance/`.

---

## Decision

**Derive every per-request container from a shared, module-level null-prototype base object —
`Object.create(NULL_PROTO)` — instead of `Object.create(null)`.**

Because it satisfies both halves of the requirement at once. `Object.prototype` stays unreachable
(identical pollution safety, proven by the same tests), while instances keep **fast properties** so
handler reads stay inline-cacheable. Measured on the router allocation harness, paired within one
session: **param-route match 293.4 → 162.0 B/op (−44.8%)**, static path unchanged at 64.2 B/op
(cv 0.01%).

The consequence to accept explicitly: `Object.getPrototypeOf(ctx.params)` is no longer `null` — the
chain terminates in `null` one hop later. The router capability spec previously mandated the
mechanism ("SHALL be a null-prototype object"); it now mandates the invariant
("SHALL have a prototype chain that excludes `Object.prototype`") plus the fast-property property.

---

## Options considered

- **`Object.create(NULL_PROTO)` (shared base)** — ✅ chosen: fast properties, identical safety, and a
  one-token diff at each site.
- **`Object.create(null)` (status quo)** — ❌ rejected: dictionary mode; ~2.2–3.9× slower reads and
  ~3.3× the allocation.
- **A null-prototype constructor (`new NullBag()`)** — ❌ rejected: measured equivalent
  (42.4 vs 43.7 ns, within noise) but needs a constructor function and awkward `this` typing for no gain.
- **`Object.setPrototypeOf({}, null)`** — ❌ rejected: preserves `getPrototypeOf() === null` and fixes
  dictionary mode, but **2.4× slower to build** (138.0 vs 58.1 ns) — a net time regression.
- **Plain `{}`** — ❌ rejected: `__proto__` hits the setter instead of binding as an own key. A real
  pollution vector.
- **`{ __proto__: null }` literal** — ❌ rejected: measured **worse than the status quo** (197.8 B/op,
  71.4 ns) and still dictionary mode. Recorded so nobody "modernises" into a regression.
- **Validate param names at registration, then use `{}`** — ❌ rejected: works for params (names are
  static) but not for query (keys are attacker-controlled), and leaves `ctx.params.toString` returning
  a function.
- **Do nothing** — ❌ rejected: the cost is permanent and paid by user code, not framework code.

---

## Consequences

- **Positive:** param-route match allocates 44.8% less; params/query/headers reads become
  inline-cacheable in application code; one primitive fixes all three containers.
- **Negative / cost:** `Object.getPrototypeOf(ctx.params) === null` is no longer true. Any consumer
  asserting that exact identity breaks — the pollution-safety guarantee it was standing in for does
  not. This required amending a ratified capability requirement and two documentation claims.
- **Negative / cost:** the base constant is duplicated across `@nextrush/router` and
  `@nextrush/runtime`. They are sibling packages that may not import each other, and
  `@nextrush/types` carries no runtime code, so two lines in two packages is the price of the
  boundary.
- **Neutral:** `NULL_PROTO` is now exported from `@nextrush/runtime` so adapters share one instance.
- **Follow-up:** the same defect exists in `@nextrush/body-parser`, `@nextrush/cookies` and
  `@nextrush/form-data`, which were out of scope here and are logged as Findings.

---

## Compliance / enforcement

`apps/benchmark/scripts/alloc/params-shape-gate.mjs` — asserts `%HasFastProperties` **and**
`Object.prototype` unreachability on real `ctx.params`, `ctx.query`, `EMPTY_PARAMS` and
`EMPTY_QUERY`, and exits non-zero on violation. This is the gate whose absence allowed the original
choice: `%HasFastProperties` requires `--allow-natives-syntax`, which vitest's `threads` pool cannot
enable, so it cannot live in the unit suites. The unit suites pin the behavioural half — pollution
safety, no inherited members, and enumeration parity (`JSON.stringify`, spread, `Object.keys`,
`for...in`, `structuredClone`).

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked (or "—" justified).
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
