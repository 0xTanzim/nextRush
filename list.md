# NextRush v3 — Missing Packages Audit (2026 Ecosystem Gap Analysis)

**Date**: 2026-07-06
**Scope**: Compare NextRush's current package inventory against what Fastify, Hono, and Elysia ship (core + official ecosystem) as of 2026, and flag genuine gaps — not feature-parity for its own sake, but gaps that block real production adoption.

---

## 1. What NextRush Already Has (Baseline)

```
Core:        types, errors, core, router, runtime
DI/Class:    di, decorators, controllers
Adapters:    adapter-node, adapter-bun, adapter-deno, adapter-edge
Middleware:  cors, helmet, body-parser, rate-limit, compression, cookies,
             csrf, multipart, request-id, timer
Plugins:     static, websocket, template, logger, events
Tooling:     dev (CLI/hot-reload/build/generators), create-nextrush
Meta:        nextrush
```

This is a strong, coherent Tier-1/Tier-2 core. The gaps below are **ecosystem-level**, i.e. things every competing framework ships either in core or as an official first-party package, that NextRush has none of.

---

## 2. Confirmed Gaps (researched against Fastify/Hono/Elysia 2026 ecosystems)

### P0 — Adoption blockers (a real API cannot ship without these)

| # | Package (proposed)         | Why it's a gap | What competitors ship |
|---|-----------------------------|-----------------|------------------------|
| 1 | `@nextrush/validation`      | No request/response validation layer at all. Every serious framework standardized on **Standard Schema** (the 2025+ interop spec) so users bring Zod/Valibot/ArkType and the framework validates against whichever they pick — N+M instead of N×M adapters. | Fastify (schema+ajv), Hono (`@hono/standard-validator`, `zValidator`), Elysia (native Standard Schema, is its #1 selling point) |
| 2 | `@nextrush/jwt`             | No first-party auth primitive. Every framework has a JWT middleware in first-party scope even if full auth is left to the user. | Hono (`hono/jwt` builtin), Fastify (`@fastify/jwt`) |
| 3 | `@nextrush/session`         | No session middleware (signed cookies + store abstraction: memory/redis). CSRF middleware already exists but has nothing to protect without sessions. | Express (`express-session`), Fastify (`@fastify/session`) |
| 4 | `@nextrush/openapi`         | No OpenAPI/Swagger generation. This is the single most requested feature in 2026 framework comparisons — API docs generated from route + validation schema. | Fastify (`@fastify/swagger`), Elysia (`elysia-openapi`, "first-class OpenAPI" is its core pitch), Hono (`hono-openapi`) |

### P1 — Production-readiness gaps (needed before "enterprise-ready" claims are credible)

| # | Package (proposed)      | Why it's a gap |
|---|--------------------------|-----------------|
| 5 | `@nextrush/otel` (OpenTelemetry) | No tracing/metrics integration. OTel is the de facto standard for observability in 2026 (CNCF, backed by Datadog/Grafana/Honeycomb). `@nextrush/logger` exists but structured logs alone aren't distributed tracing. |
| 6 | `@nextrush/cache`        | No cache abstraction (in-memory + adapter interface for Redis). Rate-limit package likely has its own store logic duplicated — this should be the shared primitive. |
| 7 | `@nextrush/testing`      | No first-party test-client / supertest-equivalent for hitting routes without a real socket. Every framework has one (`fastify.inject()`, Hono `app.request()`). Needed for the framework's own DX story and for `pnpm create nextrush` scaffolds to ship working tests. |
| 8 | `@nextrush/env`          | No typed environment variable validation/loading package (dotenv + schema validation combo). Small, but a very common first-party utility (`@fastify/env`). |
| 9 | `@nextrush/etag`         | No conditional-request / ETag / Last-Modified support in static or core. Missing HTTP caching semantics is a real correctness gap, not just a nice-to-have. |

### P2 — Ecosystem completeness (expected once the framework matures, not launch-blocking)

| # | Package (proposed)        | Why it's a gap |
|---|-----------------------------|-----------------|
| 11 | `@nextrush/i18n`           | No internationalization/locale plugin. Aligns with your own `engineering-standards.md` accessibility/i18n rule ("never hardcode user-visible strings"). |
| 12 | `@nextrush/health`         | No `/healthz`/`/readyz` plugin (liveness/readiness probes). Trivial to build, universally expected for k8s/container deploys. |
| 13 | `@nextrush/graceful-shutdown` | No SIGTERM/SIGINT drain-and-close helper package (currently, if it exists, it's buried inline in adapters). Worth extracting as its own tiny package since every deployment needs it explicitly. |
| 14 | `@nextrush/cli` API client generator | Not urgent — Elysia's "Eden Treaty" (type-safe RPC client generated from server types) is a differentiator but a v2+ nice-to-have, not a gap that blocks adoption today. |

---

## 2a. `@nextrush/stream` — Promoted to P0 (AI/agentic apps are a 2026 first-class use case)

**Correction from the original pass**: streaming was filed under P2 as `@nextrush/sse`. On closer inspection of the actual source (`adapters/*/src/context.ts`), this undersells both how much groundwork already exists and how serious the remaining gap is. Re-classified as **P0** — a framework positioning itself for 2026 workloads cannot treat LLM/agentic response streaming as an afterthought; it's as central as JSON responses were in 2018.

### What already works (verified against source, not assumed)

- `ctx.send()` on the **Node adapter** (`adapters/node/src/context.ts`) correctly pipes both Node `Readable` streams and Web `ReadableStream`, with:
  - Backpressure handling via `res.write()` return value + `drain` event
  - Stream cleanup (`stream.destroy()` / `reader.cancel()`) when the client disconnects (`res.on('close', ...)`)
  - Error-safe fallback to a 500 JSON response if headers haven't been sent yet
- `ctx.send()` on **Bun, Deno, and Edge adapters** correctly handles `data instanceof ReadableStream` by attaching it as the `Response.body` — correct for their fetch-Response-based model; the runtime itself manages backpressure.

This means the **low-level transport is genuinely solid and consistent across all 4 runtimes.** That part of the framework does not need to be rebuilt.

### What's actually missing

| Gap | Why it matters for agentic apps |
|---|---|
| **No SSE helper** (`ctx.sse()` / `streamSSE()`) | LLM chat UIs stream via `text/event-stream` (the `data: {...}\n\n` wire format, `id:`/`retry:`/keep-alive comments). Today a user must hand-roll this framing on top of `ctx.raw.res.write()`, bypassing the Context API entirely — which defeats the "never touch raw req/res" rule in your own `global-rules.instructions.md` §10. |
| **No async-generator-to-stream helper** | OpenAI/Anthropic/Vercel AI SDK all yield tokens as `AsyncIterable<string>` or `AsyncIterable<Uint8Array>`. There is no `ctx.stream(asyncIterable)` — users must manually wrap it via `ReadableStream.from()` (Node 22+) or a custom adapter, which is exactly the kind of boilerplate a framework should remove. |
| **No cancellation signal reaching the handler** | `AbortSignal`/`AbortController` currently appear only inside body-parsing (reading *incoming* multipart/JSON bodies). There is no `ctx.signal` exposed for the *outgoing* direction. If a user closes an AI chat mid-response, the handler's async generator (and the upstream LLM HTTP call it's driving) has no way to know and keeps running — wasted provider cost, not just a resource leak. `res.on('close', ...)` is used internally in the Node adapter to stop the *pipe*, but that signal never propagates back up to application code. |
| **No streaming JSON / newline-delimited JSON (NDJSON) helper** | Common secondary pattern for agent tool-call streams and structured partial results (`ctx.ndjson(asyncIterable)`), distinct from SSE framing. |

### Proposed shape

```typescript
// @nextrush/stream — zero deps, depends only on @nextrush/types
export interface StreamContext extends Context {
  /** Exposed for handlers to detect client disconnect / cancel upstream work. */
  readonly signal: AbortSignal;

  /** Stream any async iterable of strings/bytes as a chunked response. */
  stream(source: AsyncIterable<string | Uint8Array>, init?: StreamInit): Promise<void>;

  /** Server-Sent Events: correct text/event-stream framing + keep-alive. */
  sse(source: AsyncIterable<SSEEvent>, init?: SSEInit): Promise<void>;

  /** Newline-delimited JSON — one JSON object per line, for structured agent output. */
  ndjson(source: AsyncIterable<unknown>): Promise<void>;
}

interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}
```

`ctx.signal` should be wired to `res.on('close', ...)` (Node) / the adapter's existing request lifecycle (Bun/Deno/Edge already get an `AbortSignal` for free from the platform `Request` object in most cases — worth checking Bun's `req.signal` support specifically before implementation).

### Revised priority roadmap

```
Phase 1 (P0 — ship before calling v3 "production ready"):
  @nextrush/validation → @nextrush/stream → @nextrush/jwt → @nextrush/session → @nextrush/openapi
```

`@nextrush/stream` slots in early because it's additive (no schema/breaking changes to `Context`, just new optional methods) and because it's currently the single biggest gap for the exact audience — AI/agentic app builders — that would differentiate NextRush from "just another Fastify clone" in 2026.

### Explicitly NOT recommended (would violate your own steering rules)

- **A full ORM/database package** — out of scope; NextRush is a "minimal core" framework by its own README positioning (`AdonisJS`-style batteries-included is a different value prop). Do not chase NestJS/AdonisJS feature parity here.
- **A built-in queue/job system** — same reasoning; leave to ecosystem (BullMQ etc.), just document the integration pattern.
- Anything requiring a new *runtime* dependency beyond the 3 already-approved exceptions in `global-rules.instructions.md` §6 — every proposed package above must stay zero-dependency or use only `devDependencies`, except `@nextrush/otel` which will need the OTel SDK as a peer dependency (industry standard, unavoidable, same pattern Fastify/Hono use — declare it as `peerDependencies`, never bundled).

---

## 3. Priority Roadmap (superseded by §2a — see revised Phase 1 below)

```
Phase 1 (P0 — ship before calling v3 "production ready"):
  @nextrush/validation → @nextrush/stream → @nextrush/jwt → @nextrush/session → @nextrush/openapi

Phase 2 (P1 — production hardening):
  @nextrush/testing → @nextrush/env → @nextrush/etag → @nextrush/cache → @nextrush/otel

Phase 3 (P2 — ecosystem completeness):
  @nextrush/health → @nextrush/graceful-shutdown → @nextrush/i18n
```

Dependency ordering respects `global-rules.instructions.md` §1 (package hierarchy): all new middleware/plugin packages sit at the `middleware`/`plugins` tier and depend only on `types`/`errors`/`core`, never on each other laterally except where explicitly noted (e.g. `@nextrush/openapi` depends on `@nextrush/validation`'s schema introspection).

---

## 4. Immediate Next Step

Recommend starting with **`@nextrush/validation`** — it unblocks `@nextrush/openapi` (schema introspection) and is the highest-leverage single package (every route handler benefits immediately). Proposed shape:

```typescript
// @nextrush/validation — Standard Schema adapter, zero deps
import type { StandardSchemaV1 } from '@standard-schema/spec'; // type-only, no runtime dep

export function validate<T extends StandardSchemaV1>(schema: T): Middleware;
// Validates ctx.body / ctx.query / ctx.params against any Standard Schema
// (Zod, Valibot, ArkType, etc.) the *consumer* already has installed.
```

This mirrors Elysia's approach (validation is core to the framework, not bolted on) while staying zero-dependency, since Standard Schema is a TypeScript interface, not a library.


====

 Next steps — prioritized

  1. Run the release now. Both changesets are staged; @nextrush/validation v1 is genuinely done — coded, tested, documented, and now proven end-to-end. @nextrush/errors's fix is a safe, backward-compatible patch that should ship
  promptly since it affects every consumer's error responses.
  2. The ctx.query/ctx.params type-threading spike (RFC §9) — still the open architectural question. Worth timeboxing as an isolated, throwaway-branch experiment before the next major validation work, since it decides whether
  typed query/params ever ship without an accessor.
  3. @nextrush/openapi — now unblocked. Validation's schema-on-route convention is exactly what OpenAPI generation needs to introspect; this is the next highest-leverage P0 package from the original audit.
  4. JWT package reshape — from our earlier discussion: a thin wrapper around jose (peer dep), not a crypto reimplementation. Straightforward, low-risk.
  5. Decorator integration for validation (@Body(schema)) — deliberately deferred; revisit once the middleware API has some real mileage, per the RFC.
  6. Audit other core-lockstep packages for the same errorHandler blind spot — worth a quick check whether any other package throws a NextRushError subclass with custom toJSON() fields that might have had the same silent-drop
  problem before today's fix (likely none, since ValidationError was the only override, but worth a 5-minute grep to confirm).
