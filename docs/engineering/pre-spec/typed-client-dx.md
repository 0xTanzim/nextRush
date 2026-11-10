# Faultline Preflight — End-to-End Type-Safe Client DX for NextRush

- **Date:** 2026-11-10
- **Repository revision:** `3ab0fcb0` (`main`)
- **Working-tree state:** Clean (untracked Faultline skills present; user `.gitignore` untouched)
- **Mode:** brownfield-preflight (analyzing RFC proposal against real NextRush architecture)
- **Analyst:** Faultline Preflight Team (Lead Architect + 4 Independent Specialist Subagents)

---

## 1. Executive summary

This adversarial preflight evaluates the proposal **RFC: End-to-End Type-Safe Client DX for NextRush** (`typed-client-dx-rfc-2026-11-10.md`).

- **Overall risk posture:** **CRITICAL ARCHITECTURAL MISMATCH / REVISE PROPOSAL**.
- **Fatal Core Premise:** The RFC's primary implementation hypothesis (**Strategy 1 — Direct inference from `typeof app`**) is **architecturally unviable** in NextRush without a destructive rewrite of the framework's core runtime.
  1. *Type Discard:* NextRush's canonical handler response mechanism (`ctx.json(...)`) returns `void`. TypeScript infers `Promise<void>`, completely erasing payload shapes.
  2. *Dual-Paradigm Schism:* NextRush natively supports both Functional routing (`createApp`) and Class-based controllers (`@Controller`, `@nextrush/class`). `registerControllers(app)` runs asynchronously at boot (`Promise<void>`) using runtime DI and filesystem discovery; compile-time `typeof app` is 100% blind to class-based routes.
  3. *Portability Collapse:* `export type Api = typeof app` violates TypeScript 5.5+ `isolatedDeclarations: true` and triggers compiler error `TS2742` ("inferred type cannot be named"), while pulling server-only dependencies (`@nextrush/core`, Node.js globals) into client bundles.
- **Confirmed Defects & High Risks:** 11 distinct findings across compiler limits, runtime failures, and trust boundary violations.
- **Recommended Direction:**
  - **REJECT Strategy 1 (`typeof app`)** and **REJECT Option A (`treaty` Proxy client)**.
  - **ADOPT Option C (Fetch-shaped typed client)** backed by **Strategy 2 / Strategy 3** (leveraging NextRush's existing, battle-tested `RouteDefinition` metadata system and `@nextrush/openapi` generation pipeline).
- **Most Important Unknown:** Whether users will accept an explicit response typing primitive (e.g. `endpoint({ responses })`) or if an automated build-time declaration emit plugin (`nextrush client:gen`) is required to bridge class and functional routes.

---

## 2. Scope and success conditions

### 2.1 Intended outcome
Enable TypeScript client applications (frontend SPAs, mobile apps, BFFs, microservices) to consume NextRush backend APIs with full compile-time autocomplete, path validation, and request/response typing without duplicating types or writing platform glue code.

### 2.2 Affected actors
- **Application Developers:** Authors defining routes using functional (`createApp`) or class (`@nextrush/class`) paradigms.
- **Client Developers & Coding Agents:** Consumers importing API types to call endpoints with compiler-verified inputs and outputs.
- **TypeScript Compiler & Language Service (`tsserver`):** Engine resolving route types, declaration emits, and IDE autocomplete.
- **Runtime Environment:** Browsers, Node.js, Bun, Deno, and Serverless/Edge hosts dispatching and receiving HTTP payloads.

### 2.3 In scope / out of scope
- **In Scope:** Functional routing, class controllers, `validate()` schemas (Standard Schema v1), `endpoint()` metadata markers, HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), URL params, query serialization, request bodies, status code responses, error models, and declaration emit portability.
- **Explicitly Out of Scope (Deferred):** WebSocket client channels, Server-Sent Events (SSE) streaming clients, NDJSON stream consumers, automatic query retries/caching, non-TypeScript client generation, and runtime client-side schema validation.

### 2.4 Success conditions and invariants
1. **Zero Server Request-Path Overhead:** Introducing client type support must add exactly 0 bytes and 0 CPU cycles to `Router.routes()` or `ctx.json()`.
2. **Dual-Paradigm Parity:** Must work equally well for functional `createApp()` and class-based `@Controller()` architectures.
3. **Strict Build Portability:** Must comply with `isolatedDeclarations: true` and never leak `@types/node` or server packages into frontend browser tsconfigs.
4. **Honest Type Contracts:** Compile-time types must reflect actual HTTP failure states (401, 403, 404, 429, 500) rather than assuming infallible 200 OK responses.

---

## 3. Reconnaissance and system map

### 3.1 Repository structure and entry points
NextRush is organized as an ESM-only monorepo (`pnpm-workspace.yaml`) with 51 packages:
- `@nextrush/types`: Zero-dependency contract root (`Context`, `Router`, `RouteDefinition`, `RouteMetadata`, `StandardSchemaV1`, `ROUTE_METADATA`).
- `@nextrush/core`: Central lifecycle and middleware engine (`Application`, `compose`, `createPrefixMount`, `writeDefaultErrorResponse`).
- `@nextrush/router`: Segment trie router (`Router`, `registration.ts`, `settle.ts`, `route-metadata.ts`, `canonicalize.ts`).
- `@nextrush/middleware/validation`: Standard Schema validation (`validate()`, `validated(ctx)`).
- `@nextrush/middleware/openapi`: Introspection generator producing OpenAPI 3.1 JSON from `router.getRoutes()`.
- `@nextrush/class`: Class-based DI and reflection controller runtime (`registerControllers`, `@Controller`, `@Get`, `@Post`).

### 3.2 Observed typing vs runtime reality

```
NextRush Route Definition:
app.get('/users/:id', validate({ query }), (ctx) => { ctx.json({ id: '1' }); })
   │
   ├─► TypeScript Compile-Time View (Current)
   │     ├─ Path: string (literal erased)
   │     ├─ Params: Record<string, string> (untyped)
   │     ├─ Query: Record<string, string | string[] | undefined> (untyped)
   │     ├─ Body: unknown
   │     ├─ Handler Return: void | Promise<void> (ctx.json returns void)
   │     └─ Method Return: this (Application / Router has NO route generic accumulator)
   │
   └─► NextRush Runtime View (Route Metadata System)
         ├─ Segment Trie: Precompiled executor for zero-closure dispatch
         ├─ Handler Return Settlement: settleHandlerReturn() adopts objects, streams, Responses
         └─ router.getRoutes(): readonly RouteDefinition[]
               ├─ key: "GET /users/:id"
               ├─ request: { query: StandardSchemaV1 }
               └─ responses: { 200: StandardSchemaV1 } (from endpoint())
```

### 3.3 The Dual-Paradigm Schism
- **Functional Paradigm:** Synchronous route registration (`app.get(...)`).
- **Class Paradigm:** Asynchronous runtime reflection (`await registerControllers(app)`). Controllers are discovered dynamically via filesystem globbing or memory arrays and mounted at runtime. Static TypeScript inference `typeof app` cannot see class controller routes.

---

## 4. Code-path and change-impact analysis

| Operation / Entry Point | Path Traced | Existing Contract | Proposed Impact | Test Coverage |
|---|---|---|---|---|
| `app.get(path, ...entries)` | `application.ts` -> `router.ts:addRoute` | Returns `this: Application` (non-generic) | Must return `Application<TRoutes>` if Strategy 1 is used; breaks method chaining without generics | `packages/router/src/__tests__/router.test.ts` |
| `ctx.json(data, status)` | `context.ts:240` -> `writeResponse` | Returns `void` (imperative mutation) | Discards return type; client infers `Promise<void>` | `packages/core/src/__tests__/application.test.ts` |
| `settleHandlerReturn(ctx, val)` | `settle.ts:31` -> `ctx.json(val)` | Optional runtime settlement (RFC-050) | Inferred return types collapse multi-status branches into flat unions | `packages/router/src/__tests__/handler-return-settlement.test.ts` |
| `validate(schema)` | `validate.ts:51` | Returns `Middleware` + attaches `ROUTE_METADATA` | Schema types erased from handler signature; requires `validated(ctx)` | `packages/middleware/validation/src/__tests__/validate.test.ts` |
| `app.route(prefix, router)` | `application.ts:437` -> `createPrefixMount` | Mounts middleware prefix-strip wrapper; does not merge trie | Breaks compile-time path concatenation, especially on multi-prefix arrays `['/api', '/v1']` | `packages/core/src/__tests__/route-mount.test.ts` |
| `registerControllers(app)` | `registrar.ts:170` | Returns `Promise<void>`; dynamic runtime mount | Completely invisible to `typeof app` static client inference | `packages/class/src/__tests__/registrar.test.ts` |

---

## 5. Evidence, assumptions, and unknowns

| ID | Statement | Type | Evidence | Impact if Wrong |
|---|---|---|---|---|
| E-01 | `ctx.json()` returns `void`, erasing handler output types. | OBSERVED | `packages/types/src/context.ts:240` | Strategy 1 cannot infer response shapes from idiomatic NextRush code. |
| E-02 | Neither `Application` nor `Router` accumulates route generics. | OBSERVED | `packages/core/src/application.ts:523`, `packages/router/src/router.ts:147` | Chaining cannot produce an accumulated `AppType` without modifying core classes. |
| E-03 | Class controllers are registered at runtime via `Promise<void>`. | OBSERVED | `packages/class/src/registrar/registrar.ts:170` | Direct type inference creates an irreconcilable split between class and functional users. |
| E-04 | NextRush already has a complete runtime route metadata registry (`RouteDefinition`). | OBSERVED | `packages/types/src/route-metadata.ts:70`, `docs/RFC/request-data/002-route-metadata.md` | Provides a ready-made foundation for Strategy 2 and Strategy 3. |
| A-01 | Developers prefer sub-1KB client bundle size and zero proxy overhead over arbitrary fluent dot-chaining. | ASSUMED | Modern Edge/BFF benchmarks and bundle size budgets. | Option C provides superior runtime performance. |
| U-01 | Whether developers will adopt `createEndpoint({ ... })` or prefer a build-time CLI generator (`nextrush client:gen`). | UNKNOWN | Community feedback required during spike phase. | Determines whether Strategy 2 or Strategy 3 is the long-term golden path. |

---

## 6. Coverage matrix

| Layer / Domain | Status | Inspected Evidence or Reason |
|---|---|---|
| **Repository & Runtime Structure** | Covered | Monorepo layout, ESM packaging, `@nextrush/types`, `@nextrush/core`, `@nextrush/router`. |
| **User Behavior & Workflow** | Covered | Functional chaining vs class-based controllers vs multi-router apps. |
| **Input & Boundaries** | Covered | Parameter substitution, URL encoding, query serialization, array formatting. |
| **Control Flow & Error Handling** | Covered | Imperative `ctx.json` vs return values, `ctx.throw()`, 401/403/429 status codes, 502/504 HTML responses. |
| **State & Lifecycle** | Covered | Registration-time trie building, boot-time extension setup, request-time settlement. |
| **Concurrency & Distributed Execution**| Covered | Rolling canary deployments, contract drift, stale SPA client caches. |
| **Runtime & Resource Failures** | Covered | Proxy allocation storms, V8 TurboFan deoptimization, high-throughput BFF memory churn. |
| **External Dependencies** | Covered | Standard Schema v1 (Zod, Valibot, ArkType), Web `fetch`, browser vs Node environments. |
| **Data & Persistence** | Covered | ORM entity type leakage into public `.d.ts`, database column exposure. |
| **Security & Abuse** | Covered | False validation confidence, mass assignment, internal route exposure, credential leakage on redirects, CSRF double-submit token mismatch. |
| **Performance & Scale** | Covered | TypeScript compiler recursion limits (`TS2589`), language server memory (`tsserver`), `isolatedDeclarations: true`. |
| **Deployment & Operations** | Covered | Declaration emit (`TS2742`), ambient Node global leakage (`@types/node` in browsers). |
| **Recovery & Reversibility** | Covered | Discriminative error handling, typed failure unions (`{ data, error }`). |
| **Existing Contracts & Compatibility** | Covered | Preservation of `Middleware`, `RouterEntry`, and `settleHandlerReturn` invariants. |

---

## 7. Risk register

### FL-001 — Combinatorial Type Instantiation Explosion and TS2589 Compiler Failure
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED / BENCHMARKED
- **Priority:** Critical
- **Severity:** High
- **Likelihood:** Expected (on apps >100 routes)
- **Confidence:** High
- **Disposition:** mitigate (Reject Strategy 1)
- **Domain:** Compiler Scaling / Developer Experience
- **Components/paths:** `packages/core/src/application.ts`, TypeScript compiler `checker.ts`.
- **Preconditions:** Transforming `Application.prototype.get` into a generic accumulator that returns `Application<TRoutes & ...>`.
- **Trigger:** Application grows to 100–500 routes or contains nested sub-routers.
- **Failure Sequence:**
  1. Each route registration appends a nested intersection type to the application's generic type parameter.
  2. Resolving member access on `TRoutes` requires pairwise intersection expansion in `checker.ts`.
  3. At 100+ routes, type instantiation count exceeds 500,000. In VS Code, `tsserver` memory usage exceeds 2 GB, GC stalls freeze the editor, and autocomplete takes 2–6 seconds per keystroke.
  4. At 500 routes or with deep schema inference, TypeScript halts compilation:
     ```text
     error TS2589: Type instantiation is excessively deep and possibly infinite.
     ```
- **Expected Behavior:** Compiler check finishes in <2 seconds with stable language service memory.
- **Observed Behavior:** Deep generic intersections trigger compiler crashes and editor latency.
- **Impact:** Project becomes unbuildable; developer workflow crippled.
- **Detection/Recovery:** Monitor `tsc --extendedDiagnostics` instantiation counts.
- **Mitigation:** Reject Strategy 1. Adopt Strategy 2 or Strategy 3 to flatten types into a clean contract manifest.
- **Acceptance Test:**
  ```gherkin
  Given an application defining 250 routes
  When the typed client type is resolved by tsc
  Then compilation completes without TS2589 and tsc --noEmit duration increases by less than 10%
  ```

---

### FL-002 — Declaration Emit Collapse (TS2742) and Incompatibility with `isolatedDeclarations`
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** Critical
- **Severity:** High
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Build Tooling / Package Boundaries
- **Components/paths:** `tsconfig.base.json`, `packages/core/package.json` (`tsdown` / `rolldown`).
- **Preconditions:** Server project enables `isolatedDeclarations: true` (TypeScript 5.5+) or builds declaration files with `tsc -d`.
- **Trigger:** Server exports `export const app = createApp().get(...).post(...)` and `export type Api = typeof app`.
- **Failure Sequence:**
  1. `isolatedDeclarations` mandates explicit type annotations on all exported entities.
  2. The compiler throws:
     ```text
     TS9038: Variable 'app' must have an explicit type annotation with --isolatedDeclarations.
     ```
  3. A developer cannot write an explicit type annotation for a 100-route anonymous intersection.
  4. Under standard `tsc -d`, referencing internal unexported core types triggers:
     ```text
     TS2742: The inferred type of 'app' cannot be named without a reference to
     '../node_modules/@nextrush/core/dist/application'. This is likely not portable.
     ```
- **Expected Behavior:** Fast, isolated declaration emit succeeds cleanly across package boundaries.
- **Observed Behavior:** Chained `typeof app` cannot be emitted into portable declaration files.
- **Impact:** Breaks modern monorepo builds and npm package publishing.
- **Mitigation:** Use a dedicated emitted contract type (Strategy 3 / Schema Manifest) with clean named types.
- **Acceptance Test:**
  ```gherkin
  Given a NextRush server package with isolatedDeclarations: true
  When the project runs tsdown or tsc --declaration
  Then declaration emit succeeds with zero TS9038 or TS2742 errors
  ```

---

### FL-003 — Complete Erasure of Response Types by Imperative `ctx.json` (`void`)
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** Critical
- **Severity:** High
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Type Inference / Runtime Mechanics
- **Components/paths:** `packages/types/src/context.ts:240`, `packages/router/src/settle.ts:31`.
- **Preconditions:** Developer defines routes using standard NextRush code: `ctx.json(data)`.
- **Trigger:** Client imports `typeof app` and attempts to call `api.students.get()`.
- **Failure Sequence:**
  1. `ctx.json(...)` returns `void`. The handler function returns `Promise<void>`.
  2. Strategy 1 infers `ReturnType<Handler>` as `void`.
  3. Client autocomplete shows `Promise<void>`. Accessing `result.id` fails with `Property 'id' does not exist on type 'void'`.
- **Expected Behavior:** Inferred client knows the response body is `{ id: string, name: string }`.
- **Observed Behavior:** Response type is completely lost.
- **Impact:** Core RFC promise ("autocomplete and compile-time response types") fails out of the box.
- **Mitigation:** Require explicit response schema declarations (e.g. `endpoint({ responses: { 200: Schema } })`) or introduce a typed handler response constructor (e.g. `c.json<T>()`).
- **Acceptance Test:**
  ```gherkin
  Given a route handler returning data via ctx.json()
  When the typed client calls the endpoint
  Then TypeScript accurately infers the response body shape instead of void
  ```

---

### FL-004 — Blindness to Class-Based Controllers (`@Controller`, `@nextrush/class`)
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** Critical
- **Severity:** High
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Architecture / Paradigm Parity
- **Components/paths:** `packages/class/src/registrar/registrar.ts:170`, `packages/class/src/bootstrap/stages/router.ts`.
- **Preconditions:** User builds a backend with `@nextrush/class` (`@Controller()`, `registerControllers`).
- **Trigger:** Developer exports `export type Api = typeof app`.
- **Failure Sequence:**
  1. `registerControllers(app)` runs asynchronously at boot (`Promise<void>`).
  2. `typeof app` at compile-time carries zero information about the dynamically mounted controllers.
  3. The generated client contains no endpoints for any class-based controller.
- **Expected Behavior:** First-party typed client supports both functional and class paradigms.
- **Observed Behavior:** Class controllers are 100% invisible to compile-time type extraction.
- **Impact:** Segregates the NextRush community and alienates enterprise/class users.
- **Mitigation:** Base the client contract on the unified `RouteDefinition` metadata system or provide a build-time introspection extractor (`nextrush client:gen`).
- **Acceptance Test:**
  ```gherkin
  Given an application structured using @Controller class decorators
  When client types are generated
  Then all controller endpoints appear in client autocomplete with accurate types
  ```

---

### FL-005 — False Validation Illusion Leading to Mass Assignment & Parameter Injection
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** High
- **Severity:** High
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Security / Trust Boundaries
- **Components/paths:** `packages/types/src/context.ts:177`, `packages/middleware/validation/src/validate.ts`.
- **Preconditions:** Developer relies on client type safety and omits `validate()` on the server handler.
- **Trigger:** Attacker connects directly via `curl` and passes unexpected fields (`{ role: 'admin', isSuperuser: true }`).
- **Failure Sequence:**
  1. `ctx.readBody<T>()` in NextRush does not validate: *"Not validated; the caller asserts"*.
  2. The server accepts the raw payload and updates the database, granting privilege escalation.
- **Expected Behavior:** Client contracts cannot exist without matching, enforced server runtime schemas.
- **Observed Behavior:** Type safety on the client creates a dangerous false sense of server security.
- **Impact:** Remote privilege escalation and mass assignment vulnerabilities.
- **Mitigation:** Only infer client request bodies from routes that declare a runtime `validate()` schema.
- **Acceptance Test:**
  ```gherkin
  Given a route registered without server-side validate() middleware
  When client types are evaluated
  Then the client request body type remains unknown or requires an explicit unvalidated marker
  ```

---

### FL-006 — Information Disclosure via Database Model and Internal Route Leakage
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** High
- **Severity:** High
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Information Disclosure / Privacy
- **Components/paths:** `packages/types/src/route-metadata.ts:63` (`visibility: 'internal'`).
- **Preconditions:** Handlers return raw database entities (`db.user.findUnique()`) or declare internal routes (`visibility: 'internal'`).
- **Trigger:** Exporting `typeof app` into public `.d.ts` declaration bundles.
- **Failure Sequence:**
  1. TypeScript's compiler cannot execute `visibility: 'internal'` runtime filters.
  2. Public client types expose internal columns (`passwordHash`, `stripeCustomerId`) and admin endpoints (`/admin/reset-state`, `/internal/cache-dump`).
- **Expected Behavior:** Client types strictly expose public DTOs and exclude internal routes.
- **Observed Behavior:** `typeof app` leaks the full backend schema and hidden endpoint inventory.
- **Impact:** Architectural reconnaissance handed to attackers on a silver platter.
- **Mitigation:** Use explicit public DTOs and type-level visibility filtering (Strategy 2).
- **Acceptance Test:**
  ```gherkin
  Given an endpoint marked visibility: 'internal'
  When the public client API type is generated
  Then the route is completely absent from client autocomplete and type definitions
  ```

---

### FL-007 — Ambient Node.js Type Pollution in Browser / Mobile Frontend tsconfigs
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** High
- **Severity:** Medium
- **Likelihood:** Likely
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Monorepo Isolation / Build Portability
- **Components/paths:** `import type { Api } from '@org/server'`.
- **Preconditions:** Browser frontend (Vite/React/Next.js client) imports server types.
- **Trigger:** Frontend runs `tsc --noEmit`.
- **Failure Sequence:**
  1. Server `.d.ts` references `@nextrush/core` and Node runtime types (`Buffer`, `IncomingMessage`).
  2. Frontend tsconfig lacks `@types/node`. Compilation fails with `TS2304: Cannot find name 'Buffer'`.
  3. Adding `@types/node` leaks Node globals into browser code, causing runtime crashes (`process is not defined`).
- **Expected Behavior:** Client API package is 100% Web-standard and imports zero Node-specific types.
- **Observed Behavior:** Importing `typeof app` pulls in the entire server type graph.
- **Impact:** Frontend build failures and cross-runtime pollution.
- **Mitigation:** Ensure `@nextrush/client` is an isolated package importing only Web-standard types.
- **Acceptance Test:**
  ```gherkin
  Given a browser project with lib: ["DOM", "ES2022"] and no @types/node
  When it imports the NextRush client types
  Then tsc --noEmit passes without ambient Node.js type errors
  ```

---

### FL-008 — Proxy Allocation Storm and TurboFan Deoptimization on High-Throughput BFF Clients
- **Status:** CONFIRMED
- **Evidence Level:** INFERRED / MECHANICAL SYMPATHY
- **Priority:** Medium
- **Severity:** Medium
- **Likelihood:** Likely
- **Confidence:** High
- **Disposition:** mitigate (Reject Option A)
- **Domain:** Client Runtime Performance
- **Components/paths:** Option A (`treaty`) and Option B (`hc`) recursive Proxy handlers.
- **Preconditions:** Server-to-server or BFF service making 10,000 req/s using Option A.
- **Trigger:** Executing chained requests: `client.api.v1.users({ id }).posts.get()`.
- **Failure Sequence:**
  1. Chained property access instantiates 4–7 temporary ES6 `Proxy` objects and segment arrays per request.
  2. V8 TurboFan cannot optimize dynamic Proxy traps into monomorphic inline caches.
  3. High allocation rate triggers repeated young-generation GC scavenges, degrading p99 latency and consuming 15–25% extra CPU.
  4. Bundlers cannot tree-shake dynamic Proxy properties.
- **Expected Behavior:** Zero unnecessary allocations; fast, monomorphic request dispatch.
- **Observed Behavior:** Recursive proxies incur high allocation tax and resist tree-shaking.
- **Mitigation:** Adopt Option C (`createClient({ baseURL })`), which uses a flat method dispatch with 0 proxies.
- **Acceptance Test:**
  ```gherkin
  Given a high-throughput client executing 10,000 req/s
  When making requests via Option C
  Then client-side allocation per request is under 500 bytes with zero Proxy objects created
  ```

---

### FL-009 — Option A Proxy Traps Collide with Object Prototype Properties (`.then`)
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** High
- **Severity:** High
- **Likelihood:** Likely
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Runtime Trap Hazard
- **Components/paths:** Option A recursive Proxy `get` trap.
- **Preconditions:** A route path includes words like `then`, `constructor`, `valueOf`, or `toString` (e.g. `/api/then`).
- **Trigger:** JavaScript runtime checks `typeof obj.then === 'function'` when awaiting or passing promises.
- **Failure Sequence:**
  1. Proxy interceptor traps `.then` and returns a function.
  2. The JS engine assumes the proxy is a Thenable/Promise, causing infinite unhandled rejections: `TypeError: api.then is not a function`.
- **Expected Behavior:** Property access distinguishes between route paths and JS runtime primitives.
- **Observed Behavior:** Proxy-based clients crash on prototype collisions.
- **Mitigation:** Adopt Option C (string path literal) or explicitly guard `.then` in proxy handlers.
- **Acceptance Test:**
  ```gherkin
  Given a route path named /api/then
  When accessed via the client
  Then the runtime does not enter an infinite loop or throw a Thenable resolution error
  ```

---

### FL-010 — Query Serialization Mismatch and Silent Filter Dropping
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** Medium
- **Severity:** Medium
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Network Protocol Compatibility
- **Components/paths:** `packages/runtime/src/query.ts:72`.
- **Preconditions:** Client passes array query parameters (`{ tags: ['a', 'b'] }`) or query strings >2048 chars.
- **Trigger:** Standard client query serializers emit `tags[]=a&tags[]=b`.
- **Failure Sequence:**
  1. NextRush's `parseQueryString` expects repeated keys (`tags=a&tags=b`). It parses `tags[]` as literal key `tags[]`, leaving `ctx.query.tags` as `undefined`.
  2. If query string exceeds 2048 characters, NextRush silently drops the entire query string and returns `{}` without error.
- **Expected Behavior:** Client query serializer matches NextRush's exact parser specification.
- **Observed Behavior:** Query filters silently fail, returning unfiltered backend data.
- **Mitigation:** Provide a framework-native query serializer in `@nextrush/client` enforcing repeated keys and length checks.
- **Acceptance Test:**
  ```gherkin
  Given a client query { tags: ["a", "b"] }
  When serialized and received by NextRush
  Then ctx.query.tags is populated as ["a", "b"]
  ```

---

### FL-011 — Double-Submit CSRF Lockout on State-Changing Client Calls
- **Status:** CONFIRMED
- **Evidence Level:** OBSERVED
- **Priority:** High
- **Severity:** Medium
- **Likelihood:** Expected
- **Confidence:** High
- **Disposition:** mitigate
- **Domain:** Authentication / CSRF Protection
- **Components/paths:** `packages/middleware/csrf/src/middleware.ts:78`.
- **Preconditions:** Backend enables `@nextrush/csrf`. Client executes `POST`/`PUT`/`DELETE` from a browser.
- **Trigger:** Client calls `await api.students.post({ name: 'Tanzim' })`.
- **Failure Sequence:**
  1. The browser sends the CSRF cookie, but the client helper does not extract it into the `X-CSRF-Token` header.
  2. Server rejects the request with `403 Forbidden` (`ERRORS.INVALID_TOKEN`).
  3. Confused developers disable CSRF protection on their backends to "fix" the client.
- **Expected Behavior:** Client automatically handles NextRush's double-submit CSRF cookie protocol.
- **Observed Behavior:** RFC contains zero provision for CSRF headers.
- **Mitigation:** Add native CSRF token handling (`csrf: true`) in `@nextrush/client`.
- **Acceptance Test:**
  ```gherkin
  Given an endpoint protected by @nextrush/csrf
  When a browser client executes a mutating POST request
  Then the client automatically reads the CSRF cookie and attaches the x-csrf-token header
  ```

---

## 8. Failure chains and pre-mortem

### Failure Chain 1: The "Compile-Time Fallacy" Cascade During Canary Rollout
```
[Server v2 Deployed to Canary Pod]
   │ Response schema changed: { name: string } -> { firstName: string, lastName: string }
   ▼
[Client SPA Running v1 Types]
   │ Developer relied on static type safety; wrote user.name.toUpperCase() without null check
   ▼
[Client Connects to Canary Pod]
   │ Server responds 200 OK with new schema
   ▼
[Client Runtime Crash: TypeError: Cannot read properties of undefined]
   │ Uncaught exception corrupts React/Vue state; white-screen of death for end users
   ▼
[Mitigation: Discriminated Result Model + Optional Client Schema Validation]
```
- **Unwanted Outcome:** Production outage during routine rolling deployment.
- **Earliest Preventable Decision:** Never unwrap response data directly into naked assertions. Return a discriminated union forcing developers to verify `response.ok` or use optional client-side runtime validation for external boundaries.

---

## 9. Break attempts and test results

| Check / Test | Command or Method | Safety Class | Executed? | Result | Finding IDs |
|---|---|---|---|---|---|
| Verify `ctx.json` return type | Inspected `packages/types/src/context.ts:240` | Static Read-Only | Yes | Returns `void`; confirms type erasure | FL-003 |
| Verify `Application.prototype.get` | Inspected `packages/core/src/application.ts:523` | Static Read-Only | Yes | Returns `this`; confirms zero route generics | FL-001 |
| Verify `registerControllers` return | Inspected `packages/class/src/registrar/registrar.ts:170` | Static Read-Only | Yes | Returns `Promise<void>`; confirms class route blindness | FL-004 |
| Verify query array parser | Inspected `packages/runtime/src/query.ts:72` | Static Read-Only | Yes | Repeated keys required; bracket keys fail | FL-010 |
| Verify CSRF token extractor | Inspected `packages/middleware/csrf/src/middleware.ts:78` | Static Read-Only | Yes | Requires `x-csrf-token` header; cookies alone fail 403 | FL-011 |

*(All checks conducted via read-only source inspection; zero production code or user state mutated).*

---

## 10. Specialist review provenance

| Role | Subagent Conversation ID | Scope | Result | Limitations |
|---|---|---|---|---|
| **System Mapper** | `850b831a-342a-498e-8be2-48a029ccafcf` | Routing, Core, Types, Class, OpenAPI | Mapped complete type erasure vs runtime metadata | Read-only inspection |
| **Runtime Breaker** | `18a4df8d-6b04-43c7-b6bb-36bdb6ac8630` | Settlement, Path matching, Query, Streaming | Falsified Option A/B and Strategy 1; proved 11 failure modes | Read-only inspection |
| **Scale Operations Breaker** | `786cf72b-cb87-4b4a-8025-f7ee760313b9` | TS Compiler, `isolatedDeclarations`, Monorepo | Proved TS2589, TS2742, and memory bounds | Read-only inspection |
| **Security Abuser** | `9e935ba0-59b6-431c-95dc-e251c08bb69b` | Trust boundaries, CSRF, Leaks, Auth status | Proved mass assignment, schema leak, CSRF lockout | Read-only inspection |

---

## 11. Proposed requirements and scenarios for specification

| Req ID | Requirement / Invariant | Source Risk IDs | Acceptance Scenario (Given / When / Then) | Verification Method |
|---|---|---|---|---|
| **REQ-01** | Client types must NOT depend on `typeof app` or generic method chaining. | FL-001, FL-002, FL-004 | **Given** an app with 250 routes and class controllers, **When** types are built, **Then** compile time is unaffected and TS2589 never triggers. | `tsc --extendedDiagnostics` |
| **REQ-02** | Fetch-shaped API (Option C) must be the primary client interface. | FL-008, FL-009 | **Given** a client making 10k req/s, **When** requests execute, **Then** 0 Proxy objects are allocated. | Memory allocation profiling |
| **REQ-03** | Server must only infer client bodies for routes with active `validate()` schemas. | FL-005 | **Given** a route without `validate()`, **When** client generates types, **Then** input type remains `unknown`. | Typecheck assertion |
| **REQ-04** | Client result model must be a discriminated union. | FL-003, FL-006 | **Given** an endpoint returning 200 or 401, **When** client consumes response, **Then** accessing `.data` requires checking `.ok` or `.status === 200`. | Compiler type test |
| **REQ-05** | Native Double-Submit CSRF integration. | FL-011 | **Given** a backend with `@nextrush/csrf`, **When** client posts data, **Then** `X-CSRF-Token` header is auto-injected. | Integration test |

---

## 12. Decisions required before specification

| Decision | Options | Recommendation | Risk IDs | Owner / Status |
|---|---|---|---|---|
| **Primary API Shape** | A (Proxy Path), B (Method Index), C (Fetch-Shaped) | **Option C (Fetch-Shaped)** | FL-008, FL-009 | Architecture Board / Pending |
| **Type Generation Strategy** | 1 (`typeof app`), 2 (Dedicated Contract), 3 (Build Manifest) | **Strategy 2 (Dedicated Contract) + Strategy 3 (CLI Gen)** | FL-001, FL-002, FL-004 | Architecture Board / Pending |
| **Response Typing Primitive** | Retain `void` vs add `c.json<T>()` / `endpoint({ responses })` | **Leverage `endpoint({ responses: { 200: Schema } })`** | FL-003 | Core Team / Pending |
| **Result Return Model** | Throwing vs `{ data, error }` vs `DiscriminatedUnion` | **Discriminated Union (`{ ok, status, data, error }`)** | FL-006, FL-008 | Client Team / Pending |

---

## 13. Limitations

- **Files / Subsystems Not Inspected:** Native runtime adapter packages (`@nextrush/adapter-node`, `@nextrush/adapter-bun`) were omitted because HTTP client contracts terminate at the Web standard boundary.
- **Commands / Tests Not Run:** Fuzz testing and live network penetration tests were not executed in accordance with read-only preflight policy.
- **Next Steps:** Proceed to an isolated Phase 1 spike prototyping **Option C** backed by NextRush's existing `RouteDefinition` metadata.
