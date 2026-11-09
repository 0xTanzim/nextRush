# ADR-0037 — Callable Next.js route-handler set with a shared engine per app and options

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** Tanzim Hossain
- **Governing RFC:** `docs/RFC/runtime-adapters/049-nextjs-callable-handler.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0014`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

`@nextrush/adapter-nextjs`'s `handle(app)` returned a plain object of seven route handlers. The
direct-assignment form Next.js users naturally write (`export const GET = handle(app)`) therefore
exported an object where Next requires a function, failing the generated route-type check or at
request time. Making that form work with the existing implementation would also multiply engines,
because each `handle()` call builds its own lazy engine — turning a loud failure into silent waste.

---

## Decision

We will return a **callable handler set** — one function carrying the seven method handlers as
properties — and **share one handler set per `(app source, effective options)`** through a
module-level `WeakMap`.

Because dispatch is already method-agnostic (the edge engine routes on `request.method`), the
callable and every named property can be the same function reference. Sharing the set by
`(app, timeout value, onError identity)` makes repeated `handle()` calls free while keeping
incompatible option sets isolated.

---

## Options considered

- **Callable set + `WeakMap` sharing** — ✅ chosen: makes the reported form work and removes the
  silent multi-engine defect in one coherent change.
- **Keep the object and document `handle(app).GET`** — ❌ rejected: leaves the reported problem.
- **Separate `createHandler(app)` factory** — ❌ rejected: second public entry for the same dispatcher.
- **Global cache keyed only by app** — ❌ rejected: merges incompatible options; ignores factories.
- **Do nothing** — ❌ rejected: direct assignment stays broken; the engine defect stays latent.

---

## Consequences

- **Positive:** both idiomatic export styles work; one engine per route module; fewer closures.
- **Negative / cost:** a function-with-properties is less conventional; shared identity and
  option-identity matching need documentation.
- **Neutral:** factory apps resolve once across calls instead of once per call.
- **Follow-up:** wire the `next build` fixtures into CI. The fixtures are pinned to real releases
  (`next@14.2.35` with React 18.3.1, `next@15.5.28`, `next@16.4.2`) and all three pass
  `next build` in both export styles.

---

## Compliance / enforcement

How this is kept true: the adapter's `public-surface.test.ts` locks the value and type exports
(including `NextRouteHandlerSet`); unit tests pin callable shape, shared identity, option matching,
retry, and direct/destructured parity; the `web-adapters` capability spec holds the requirement.

---

## Checklist

- [x] One decision only (if it's really two, split into two ADRs).
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism (or explicit "by review").
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked (or "—" justified for a small/process decision).
- [x] All guidance blocks deleted; document is terse (fits on ~1 screen-plus).
- [x] Registered in docs/adr/INDEX.md.
