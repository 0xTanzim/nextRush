# Proposal

## Why

`handle(app)` currently returns a plain object, so `export const GET = handle(app)` hands Next.js an
object where it expects a callable route handler. Destructuring works, but the direct-assignment
form is what Hono migrants and Next.js users naturally write, and it fails (as a build type error in
TypeScript projects, a `Function.prototype.apply` runtime error in JavaScript projects). Fixing it
also exposes a latent defect: every `handle()` call builds its own engine, so a route module that
calls `handle()` once per method silently initializes seven engines.

## What Changes

- `handle(app, options?)` returns a **callable** value that also exposes the seven named
  method handlers. `typeof handle(app) === 'function'`; each named property is a function.
- All eight slots (the callable plus `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`HEAD`/`OPTIONS`) point at
  the same dispatcher, because the adapter's dispatch is already method-agnostic (it routes on
  `request.method`). One function reference, no per-method closures.
- Repeated `handle()` calls with the same app source and equivalent options return the **same**
  handler object and share one engine, so `export const GET = handle(app)` ×7 initializes once.
  Options are matched by value (`timeout`) and identity (`onError`); a differing option set gets
  its own engine.
- The new public type `NextRouteHandlerSet = NextRouteHandler & NextRouteHandlers` is exported from
  `@nextrush/adapter-nextjs` and re-exported from `nextrush/nextjs`.
- The existing destructuring contract is unchanged; this is an additive, backward-compatible API
  change (**not BREAKING**).
- Documentation states both styles and the shared-initialization guarantee.

## Capabilities

### New Capabilities

<!-- none: this extends an existing durable capability, it does not create one -->

### Modified Capabilities

- `web-adapters`: the Next.js App Router mount requirement now specifies a callable-and-destructurable
  return value and shared engine initialization across `handle()` calls, replacing the
  "returns an object" contract.

## Impact

- Code: `packages/adapters/nextjs/src/index.ts` (return value, shared-init cache, new type),
  `packages/nextrush/src/nextjs.ts` (type re-export), adapter tests, conformance Next.js fixtures.
- Public API: adds `NextRouteHandlerSet`; widens the `handle()` return type. Existing destructured
  consumers compile and run unchanged.
- Dependencies: none. Runtime boundaries unchanged (still Web-standard, no `node:*`).
- Durable decision to record before archive: RFC-049 (`docs/RFC/runtime-adapters/`) and an ADR
  (`docs/adr/`) covering "callable handler set + shared engine keyed by app source and option
  identity".
