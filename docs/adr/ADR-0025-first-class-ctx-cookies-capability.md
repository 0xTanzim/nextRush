# ADR-0025 — First-class `ctx.cookies` context capability

- **Status:** `Accepted`
- **Date:** `2026-08`
- **Deciders:** `Tanzim Hossain`
- **Governing RFC:** `docs/RFC/request-data/034-cookies-first-class-context-capability.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0019` (context-bound signatures), `ADR-0021` (fast-property request containers)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[██████████████░░░░░░░░]` **Accepted** — 2 / 3

---

## Context

Cookies reached handlers as `ctx.state.cookies` / `ctx.state.signedCookies`, attached at runtime
by middleware. `ContextState` is `Record<string | symbol, unknown>`, so the API was `unknown`-typed
— every consumer cast (`ctx.state.cookies as CookieContext`), and a missing middleware produced an
opaque `TypeError: Cannot read properties of undefined`. The same namespace held application state
and framework capabilities, so the two could not be distinguished or typed separately.

---

## Decision

We will **promote cookies to a first-class `Context` capability**: `ctx.cookies`
(`get`/`set`/`delete`/`all`/`has`) with a nested `ctx.cookies.signed`, activated by the
`cookies()` / `signedCookies()` middleware. `ctx.state` returns to open-ended application data.

Because a capability is a framework contract, `ctx.cookies` always exists: contexts construct with
a frozen, process-shared uninitialized stub (`@nextrush/runtime`), and operations on it throw
`CapabilityNotInitializedError` (`COOKIES_NOT_INITIALIZED` / `SIGNED_COOKIES_NOT_INITIALIZED`) with
a WHAT/WHY/HOW/WHERE diagnostic — property access never throws. `ctx.state.cookies` remains a
deprecated alias with a once-per-process warning, removed next major. The cookie data contracts
(`CookieOptions` et al.) moved to `@nextrush/types`, re-exported unchanged from `@nextrush/cookies`.

---

## Options considered

- **`ctx.cookies` first-class capability** — ✅ chosen: typed without casts, capability/state
  separation, and an actionable "middleware not installed" failure mode.
- **Keep `ctx.state.cookies` + module augmentation** — ❌ rejected: fixes only the typing, keeps
  `ctx.state` as a dependency bucket.
- **Optional `cookies?: CookieCapability`** — ❌ rejected: forces `?.`/guards everywhere; `undefined`
  carries no diagnostic for *why*.
- **Do nothing** — ❌ rejected: the cast tax is permanent and the "forgot middleware" failure stays
  an opaque TypeError.

---

## Consequences

- **Positive:** fully typed cookie API (no casts); a reusable diagnostic pattern for all future
  middleware-provided capabilities; `ctx.state` is application data only.
- **Negative / cost:** a new mandatory `Context` member every context implementation must wire; one
  release cycle of dual maintenance for the deprecated alias; `@nextrush/cookies` gains
  `@nextrush/errors` + `@nextrush/runtime` runtime dependencies (zero external deps preserved).
- **Neutral:** the uninitialized stub is process-shared, so the non-cookie hot path allocates
  nothing (verified by the `cookie-stub-alloc` bench).
- **Follow-up:** remove the `ctx.state.cookies` aliases in the next major; consider graduating
  `CapabilityNotInitializedError` to its own package if ≥2 more capabilities adopt the pattern.

---

## Compliance / enforcement

- Conformance suite: `defineCookieConformance` runs uninitialized + activated behavior against
  every adapter driver (`packages/adapters/conformance`).
- Type contract: `packages/types/src/__tests__/cookies-contract.test.ts` pins `Context.cookies` as
  required and non-optional.
- Public-surface locks in `@nextrush/errors` and `@nextrush/runtime` pin the new exports.
- Allocation gate: `apps/benchmark/scripts/alloc/cookie-stub-alloc.js` proves the shared stub
  allocates strictly less than a per-request store.

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
