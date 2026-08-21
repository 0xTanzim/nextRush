## Why

NextRush ships first-party middleware for CORS, Helmet, cookies, compression, body parsing, multipart, rate limiting, CSRF, logging, and more — but it does **not** provide a way to reuse the remaining Express/Connect `(req, res, next)` execution contract for packages the framework does not own (Passport, Morgan, Connect utilities, community auth strategies). Today a developer who needs Passport has three bad options: reimplement it, drop NextRush, or reach through `ctx.raw` and break the middleware onion. This change introduces the opt-in, Node-shaped `@nextrush/express-bridge` so those packages can be reused without putting Express in core.

This is the first implementation of RFC-035 (`docs/RFC/ecosystem-interop/035-express-bridge.md`), which establishes ecosystem interoperability as a durable architecture: **bridge the contract, not the framework**.

## What Changes

- Introduce `@nextrush/express-bridge` at `packages/interop/express-bridge/`, whose entire public runtime API is `compat(middleware)` plus four `NextRushError` subclasses.
- Wrap Connect/Express 3-arity middleware `(req, res, next)` as a NextRush `Middleware`; translate `next()`, `next(err)`, terminal `res.send`/`res.json`/`res.end`/`res.redirect`, thrown errors, thenables, and double-`next` into `compose()`'s continuation and error pipeline.
- Present a measured Express-like `req`/`res` as a four-bucket Proxy over the real Node `IncomingMessage`/`ServerResponse` (overlay / known-unsupported Express / Node pass-through / ad-hoc `ctx.state`).
- Gate on duck-typed Node-shaped `ctx.raw` and refuse Web-shaped raw HTTP with an actionable error.
- Add the `packages/interop/*` workspace glob and a `Public — interop` package tier (ADR-002x).
- Add a test-backed living compatibility registry; every `Full`/`Partial` claim requires a real-package test.
- Establish the new durable OpenSpec capability `ecosystem-interop`.

No change to `@nextrush/core`, `@nextrush/router`, `@nextrush/types`, `@nextrush/runtime`, adapters, the `nextrush` meta-package, or native middleware behavior. Additive and non-breaking.

## Capabilities

### New Capabilities

- `ecosystem-interop`: Optional, opt-in adapters that wrap a stable *external* execution contract into NextRush `Middleware`, without reversing the dependency arrow into core, without claiming Edge portability, and with a test-backed compatibility registry.

**Justification (why this is a new capability, not requirements on an existing one):** none of the existing 20 capabilities owns "adapt a foreign HTTP middleware execution contract." `core-middleware` is `compose()`; `portable-middleware` is NextRush middleware staying edge-portable — the *opposite* of this package; `runtime-adapter-contract` is `ServerAdapter`/`FetchAdapter`; `framework-composition` is the meta-package install graph. This is a durable external-ecosystem concern, and Express is only its first implementation (future Fastify/Connect adapters would extend the same capability). This mirrors the justification already recorded in RFC-035 §8.9.

### Modified Capabilities

None. No existing capability's requirements change at the spec level; the bridge is a new package that consumes existing `Context`/`ctx.raw` contracts without modifying them.

## Impact

- **New package:** `@nextrush/express-bridge` (depends on `@nextrush/types`, `@nextrush/errors`, `@nextrush/runtime` only).
- **Workspace:** `pnpm-workspace.yaml` gains `packages/interop/*`.
- **Governance:** new ADR-002x adds the `Public — interop` tier; new RFC group + capability `ecosystem-interop`.
- **Explicitly not affected:** existing applications, the `nextrush` meta-package, `@nextrush/core` `compose()`/`Application.use`, `@nextrush/router`, all adapters' request path, native middleware behavior and performance, Edge/serverless fetch handlers (they refuse the bridge), `@nextrush/types` `Context`/`RuntimeCapabilities`, and the adapter conformance suite.
