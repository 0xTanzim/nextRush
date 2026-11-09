# ADR-0039 — First-class Vercel Serverless Function adapter with dual-protocol invocation and standalone runner

- **Status:** `Accepted`
- **Date:** `2026-11`
- **Deciders:** Tanzim Hossain
- **Governing RFC:** `—` (OpenSpec change: `vercel-serverless-adapter`, GitHub issue #71)
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0007`, `ADR-0014`, `ADR-0037`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

NextRush developers deploying to Vercel's Node.js Serverless environment (such as LunaMission in `apps/api/src/index.mts`) were forced to maintain ~100 lines of brittle boilerplate. `@nextrush/adapter-edge`'s `createVercelHandler` only targets Vercel Edge (`runtime: 'edge'`) with Web standard `Request`/`Response`.

In contrast, Vercel Serverless Functions default to Node.js Fluid Compute, where invocations arrive either as Web Fetch requests or Node.js `(IncomingMessage, ServerResponse)` streams depending on file convention (`api/index.ts` vs route handlers). Developers had to manually parse forwarded headers, construct duplex readable streams, implement chunk writing and `drain` backpressure, handle premature client disconnection, polyfill HTTP verb exports, and wrap standalone runners with environment guards (`if (!process.env.VERCEL)`).

---

## Decision

We will add a first-class `createVercelHandler` and standalone runner utilities (`isServerlessEnvironment`, `isStandaloneEnvironment`, `listenIfStandalone`) directly to `@nextrush/adapter-serverless`.

1. **Universal Dual-Protocol Dispatch**:
   The returned handler is a function that inspects incoming arguments:
   - `handler(request: Request)`: dispatches directly to the Web Fetch pipeline.
   - `handler(req: VercelIncomingMessageLike, res: VercelServerResponseLike)`: bridges Node HTTP streams to Web standard `Request`, runs the application, and streams the Web `Response` back with backpressured chunk writes (`drain`), multi-cookie preservation via `getSetCookie()`, and client disconnect cancellation (`res.on('close')` → `reader.cancel()`).

2. **Callable Handler Set**:
   The handler carries named HTTP verb methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `fetch`) and a `.listenIfStandalone(options?)` method, allowing both universal default export and destructuring for Vercel Web Route Handlers.

3. **Zero Dependencies & Sealed Surface**:
   Platform shapes use structural duck-typed interfaces (`VercelIncomingMessageLike`, `VercelServerResponseLike`), ensuring zero runtime and peer dependencies on `@vercel/node`.

4. **Context & Identity**:
   Requests declare `ctx.platform === 'vercel'` and `ctx.runtime === 'edge'`, harmonizing with NextRush serverless architecture.

---

## Options considered

- **Universal dual-protocol handler in `@nextrush/adapter-serverless`** — ✅ chosen: completely eliminates user boilerplate, supports all Vercel conventions (Node & Web route handlers), and enables one-file hybrid standalone deployment.
- **Instruct users to use `@nextrush/adapter-edge`** — ❌ rejected: Vercel Edge has strict execution and memory limits, lacks Node.js ecosystem libraries, and fails on Node.js Serverless invocations.
- **Introduce a separate `@nextrush/adapter-vercel` package** — ❌ rejected: Vercel Functions are serverless functions; adding a sixth adapter package increases package surface without architectural divergence from serverless models.
- **Do nothing** — ❌ rejected: developers must copy-paste 100+ lines of custom stream bridging and maintenance burdens.

---

## Consequences

- **Positive:** LunaMission and Vercel Node users reduce 120 lines of brittle boilerplate to 10 lines of clean code; zero new runtime dependencies; seamless local development via `listenIfStandalone`.
- **Negative / cost:** `packages/adapters/serverless` exports additional symbols (`createVercelHandler`, `isServerlessEnvironment`, etc.); requires keeping Web/Node bridging logic maintained and tested.
- **Neutral:** `@nextrush/adapter-edge`'s `createVercelHandler` remains untouched for edge workloads.

---

## Compliance / enforcement

- `packages/adapters/serverless/src/__tests__/vercel.test.ts` validates dual invocation, chunk streaming backpressure, multi-cookie preservation, verb destructuring, and standalone environment switching.
- `packages/adapters/serverless/src/__tests__/public-surface.test.ts` locks the sealed runtime and type surface.
- Conformance suite `packages/adapters/conformance` verifies behavioral parity.

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
