# Design

## Context

See `proposal.md` for motivation. Current state that shapes the approach:

- `packages/adapters/nextjs/src/index.ts` builds, per `handle()` call, its own
  `memoizeAppSource`, its own lazy `enginePromise`, and seven per-method closures whose `method`
  loop variable is never read — every closure calls the same `dispatch(request, context)`.
- `boot.ts` memoizes the app source per call only; `resolveAfter()` is the sole module-level cache
  and is a capability probe, not request state.
- The Next.js App Router requires each exported HTTP method to be callable; TypeScript projects
  fail this at `next build` via the generated route-type validator, JavaScript projects fail at
  request time with `Function.prototype.apply was called on … not a function`.
- Governing decision to be recorded in `docs/RFC/runtime-adapters/049-nextjs-callable-handler.md`
  and a new ADR before archive.

## Goals / Non-Goals

**Goals:**

- One returned value usable both as a Next.js route handler and as a source of named handlers.
- One engine per `(app source, effective options)` regardless of how many times `handle()` is
  called in a module.
- No behavior change to request dispatch, error handling, timeout, `after()`, or the dev 404
  diagnostic.

**Non-Goals:**

- Changing routing, middleware, or the edge engine.
- Introducing a second public factory (e.g. `createHandler`) or a global object cache.
- Changing HEAD/OPTIONS semantics; they remain whatever the engine already produces.

## Decisions

### D1 — Return a callable function object, not a new factory

`handle()` returns a function with the seven method names attached via `Object.assign`.
Alternatives: keep the object and document `handle(app).GET` (rejected — Hono parity is the point,
and direct assignment stays a footgun); add `createHandler(app)` (rejected — a second public entry
point for the same dispatcher).

### D2 — One dispatcher reference for all eight slots

Because `dispatch` is method-agnostic (the engine routes on `request.method`), the callable and
`GET`/`POST`/…/`OPTIONS` are the same function object. This removes seven identical closures and
dissolves any "generic vs method-specific handler" ambiguity. `handler === handler.GET`.

### D3 — Share one handler set per app source and effective options

`handle()` is backed by a module-level
`WeakMap<AppSource, SharedEntry[]>`, each entry `{ timeout, onError, handlerSet }`. On call, scan
the (tiny) entry list for `timeout === entry.timeout && onError === entry.onError`; reuse on match,
otherwise create and push.

- `WeakMap` keyed on the app source (object or function) → no retention leak, and HMR (new app
  identity) yields a new entry while the old one is collected.
- Options are matched by value (`timeout`) and identity (`onError`) because `onError` is a
  function and cannot be serialized; a differing option set correctly gets its own engine.
- Rejected alternatives: a single `Map` keyed by stringified options (functions don't serialize);
  a global cache keyed by app only (merges incompatible option sets); no cache with a documented
  warning (leaves the silent 7-engine footgun the issue exposes).

### D4 — Keep the retry contract inside the shared entry

The shared entry owns the lazy `enginePromise` with the existing reset-on-rejection `catch`, so a
failed boot is retried on the next request and never cached as failure. Sharing moves this from
per-`handle()` to per-`(app, options)`, which is the intended "one app per route module" semantics.

### D5 — Public type

Export `type NextRouteHandlerSet = NextRouteHandler & NextRouteHandlers`; `handle` returns it.
Keep `NextRouteHandlers` so consumers annotating destructured results still compile. `Object.assign`
returns `T & U`, so the type falls out without casts. Re-export the new type from
`packages/nextrush/src/nextjs.ts`.

### D6 — Verify against real Next.js builds, not just unit types

Change the three `packages/adapters/conformance/deploy-verification/nextjs-app-{14,15,16}` route
fixtures to the direct-assignment form and run `next build` in each. This is the only proof that
the generated validator accepts a function-with-extra-properties. Keep one fixture on
destructuring to guard that path.

## Risks / Trade-offs

- [Shared set is observable] → `handle(app) === handle(app)` becomes true and a factory runs once
  across calls instead of once per call. Additive and matches documented intent; document it.
- [Option identity matching] → callers passing a fresh inline `onError` each call won't share;
  correct semantics, documented.
- [Module-level mutable state] → bounded to a `WeakMap` with tiny value arrays; no unbounded
  growth; justified in the RFC/ADR per AGENTS.md.
- [Next validator rejects extra properties] → proven by the 14/15/16 `next build` matrix; if any
  version rejects, fall back to documenting destructuring and drop the additive surface (spec's
  direct-assignment scenarios become the tripwire).
- [Missing surface lock] → `@nextrush/adapter-nextjs` has no `public-surface.test.ts` though
  `public-surface-lock` requires one; add it (value + type tuple) as part of this change so the new
  type export is locked.

## Migration Plan

Additive minor release; no consumer change required. Add a `.changeset` entry for
`@nextrush/adapter-nextjs` and `nextrush` (both minor). Rollback is reverting the adapter return
value; the shared cache is internal and removable without API change.

## Open Questions

- Whether to wire the three `next build` fixtures into CI (currently manual). Deferrable; does not
  change specs or the approach.
