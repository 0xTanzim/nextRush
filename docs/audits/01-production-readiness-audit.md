# NextRush — Production Readiness Audit

> **Audit type:** Independent, evidence-based engineering review for a public v1 release.
> **Method:** Source inspection of the monorepo at `packages/**`, `apps/**`, `.github/**`, and build/release config. Every finding cites the file it came from. Claims I could not verify from the repository are marked **[UNVERIFIED]**; nothing here is inferred from marketing copy.
> **Snapshot:** Core packages at `3.1.0` (source `package.json`). npm registry metadata in `packages.json` still shows `3.0.7`/`3.0.5` — a publish lag, noted below.
> **Auditor stance:** Adversarial. Strengths are only recorded where they materially change a deployment verdict.

---

## 1. Executive Summary

NextRush is a **modular, ESM-only, TypeScript HTTP stack** organized as a Turborepo/pnpm monorepo of ~35 publishable packages. The engineering quality of the **core** is materially higher than typical pre-1.0 frameworks: the request core is genuinely runtime-agnostic, the type posture is strict with a real zero-`any` discipline in shipping code, and there is evidence of prior hardening passes (audit tags `H-*`, `C-*`, `F-*`, `RT-*` scattered through the source).

The framework is **not one product; it is two**:

1. A **functional core** (`nextrush` → `@nextrush/core` + `@nextrush/router` + `@nextrush/adapter-node`) that is lean, dependency-free, and runtime-portable.
2. A **class/DI paradigm** (`nextrush/class` → `@nextrush/class` + `@nextrush/di`) that pulls `tsyringe` + `reflect-metadata` and uses the **legacy** TypeScript decorator dialect.

What blocks a credible, broad "v1 across all targets" claim is **not** core correctness. It is:

- **Multi-runtime support is asserted but not continuously proven.** Bun/Deno/Edge adapters are real code with tests, but CI runs on **Node/`ubuntu-latest` only** — no job executes them on real Bun, Deno, or Workers (`.github/workflows/ci.yml`).
- **Operational/observability surface is thin.** No OpenTelemetry, no metrics, no health-check package, no auto graceful-shutdown-on-signal.
- **Enterprise ecosystem gaps.** No first-party auth/authz/JWT/session/cache/config-validation/serverless-adapter packages.
- **Accuracy debt in public messaging.** "Zero Dependencies" is false for the class/DI path; the router is a segment trie shipped in files named `radix-tree.ts`/`RadixNode`.

**Bottom line:** production-ready **today** for Node.js single-service JSON/REST APIs by teams comfortable supplying their own auth and observability. Beta for edge/Bun/Deno. Not yet ready for classic serverless (Lambda/GCF/Azure) or turnkey enterprise adoption.

---

## 2. Overall Score

| Dimension | Score (/10) | Basis |
|---|---|---|
| Core engineering quality | **8.5** | Runtime-agnostic core (0 `node:` imports in `core/router/runtime/di/stream/errors/types`), strict TS, 145 test files, prior hardening audits |
| Node.js production readiness | **8.0** | Real graceful shutdown + timeouts in `adapter-node`; missing signal wiring, observability |
| Edge readiness | **6.5** | Real fetch-native adapter; unproven on real runtimes in CI |
| Bun readiness | **7.0** | Real adapter + tests; not run on real Bun in CI |
| Deno / Deno Deploy readiness | **6.5** | Real adapter + `deno.d.ts` + tests; not run on real Deno in CI |
| Classic serverless (Lambda/GCF/Azure) | **3.5** | No event-signature adapter exists |
| Observability & operations | **4.0** | No OTel/metrics/health; request-id + logger only |
| Ecosystem breadth | **5.0** | Strong middleware set; no auth/session/cache/queue/etc. |
| Documentation accuracy | **6.5** | Extensive docs, but material drift (deps, router naming, versions) |
| Release & supply-chain hygiene | **7.5** | Changesets + provenance; single maintainer; open-range devDeps |

**Composite v1-readiness (all stated targets): ≈ 6.8 / 10 — "Beta / Release-Candidate for Node; Experimental-to-Beta elsewhere."**

---

## 3. Deployment Matrix

Legend: 🟢 Production-capable · 🟡 Beta (implemented, not fully proven) · 🟠 Works only via a bridge/caveat · 🔴 Not supported first-party.

| Target | Status | Score | Evidence | Blocking caveat |
|---|---|---|---|---|
| **Node.js (long-running server)** | 🟢 | 8.0 | `packages/adapters/node/src/adapter.ts` — `serve()` graceful drain, `server.timeout`, `keepAliveTimeout`, `normalizeStartupError` | No signal auto-wiring; no health/metrics |
| **Bun (native)** | 🟡 | 7.0 | `packages/adapters/bun/src/adapter.ts` (12.4KB) + tests | Not executed on real Bun in CI |
| **Deno (native)** | 🟡 | 6.5 | `packages/adapters/deno/src/adapter.ts` (9.9KB) + `deno.d.ts` + tests | Not executed on real Deno in CI |
| **Deno Deploy** | 🟡 | 6.5 | Detected as `deno-deploy`; capability matrix disables `fileSystem` | Same CI gap; no deploy example verified |
| **Cloudflare Workers** | 🟡 | 6.5 | `createCloudflareHandler` in `packages/adapters/edge/src/adapter.ts`; adapter documents the 1 MB bundle limit | Bundle size **[UNVERIFIED]**; `reflect-metadata` if class API used |
| **Vercel Edge** | 🟡 | 6.5 | `createVercelHandler`; `detectRuntime()` handles `VERCEL_REGION` | Not proven on-platform in CI |
| **Netlify Edge** | 🟡 | 6.0 | `createNetlifyHandler`; runs on Deno underneath | Detection nuance documented but untested on-platform |
| **WinterCG runtimes (generic)** | 🟡 | 7.5 | Core uses Web APIs (`Request`/`Response`/`AbortSignal`/`ReadableStream`); `probeCapabilities()` fallback | No explicit WinterCG conformance suite |
| **AWS Lambda (classic event/context)** | 🔴 | 3.5 | No `APIGatewayProxyEvent`/`handler(event,context)` adapter (search returned 0 hits) | Requires Lambda Web Adapter or a custom bridge |
| **Vercel Functions (Node serverless)** | 🟠 | 5.0 | Node adapter can run, but no request-listener export or documented recipe | Cold-start cost **[UNVERIFIED]** |
| **Google Cloud Functions** | 🔴 | 3.5 | No adapter | Not supported first-party |
| **Azure Functions** | 🔴 | 3.5 | No adapter | Not supported first-party |

---

## 4. Runtime Audit

### 4.1 Request / Response abstraction — 🟢 Strong
- **Evidence:** `packages/types/src/context.ts` defines a single `Context` interface with `ctx.raw: RawHttp` as a typed escape hatch (Node `{req,res}` **or** Web `{req: Request, res}`). Response helpers (`json`/`send`/`html`/`redirect`) and error helpers (`throw`/`assert`) are on `ctx`, not raw objects.
- **Finding:** The public type surface does **not** hard-couple to Node. The one `Buffer` reference in `context.ts` is inside a JSDoc `@example`, not the type (`send(data: ResponseBody)`). Good.

### 4.2 Headers, Cookies, Body parsing, Multipart — 🟢 Present, security-aware
- **Evidence:** `packages/runtime/src/headers.ts` (`getClientIp`, `resolveClientIp`, `getEdgeClientIp`, `isValidClientIp`); `@nextrush/cookies` ships signing + a dedicated `security.test.ts`; `@nextrush/body-parser` enforces a default size limit (`DEFAULT_BODY_LIMIT` in `packages/runtime/src/body-source.ts`) and has `json-depth-default.test.ts` (prototype-pollution/depth guard); `@nextrush/multipart` is streaming with disk storage (`storage/disk.ts`, Node-coupled by design).
- **Risk:** Multipart disk storage, `@nextrush/static`, and template file adapters import `node:*` — those middleware are **Node/Bun-only**, not edge-portable. Expected, but must be documented per-package.

### 4.3 Streaming / SSE / NDJSON — 🟢 First-class
- **Evidence:** `@nextrush/stream` (`sse-format.ts`, `writers.ts`, `stream-controller.ts`); `ctx.stream()/ctx.sse()/ctx.ndjson()` in `context.ts`; `ctx.sendStream(ReadableStream<Uint8Array>)` is web-stream based. This is a genuine differentiator for AI/agentic workloads.

### 4.4 WebSockets — 🟡 Node-coupled
- **Evidence:** `packages/extensions/websocket/src/{connection,server,types}.ts` import `node:*`. **Finding:** WebSockets do **not** run on edge/Deno-Deploy. The "realtime" story is Node/Bun-only.

### 4.5 Middleware pipeline — 🟢 Correct & allocation-conscious
- **Evidence:** `packages/core/src/middleware.ts` — index-based `dispatch`, `next() called multiple times` guard, fast path for empty stack, synchronous-throw→rejected-promise normalization. Router mirrors this in `compileExecutor` (`packages/router/src/radix-tree.ts`) and pre-compiles executors at registration (no per-request closure).

### 4.6 Router — 🟢 Fast / 🟡 mislabeled
- **Evidence:** `packages/router/src/router.ts` header: *"segment trie… not a compressed radix tree"*; static routes in a `Map` for O(1) fast path; `EMPTY_PARAMS` frozen to avoid per-request allocation; param-conflict detection fails fast at registration (`addRoute`, audit `RT-5`).
- **Finding (naming drift):** the implementation file is `radix-tree.ts`, the node type is `RadixNode`, and its own JSDoc says "Radix tree node" / "compressed trie," while `@nextrush/router` npm keywords include `radix-tree`. The code is correct; the labels are not.

### 4.7 Plugin / Extension lifecycle — 🟢 Well-modeled
- **Evidence:** `packages/core/src/application.ts` — `extend()` queues, `ready()` runs `setup()` once (memoized boot, `H-1`), config freezes after `ready()`/`start()` (`assertConfigurable`), `close()` destroys in reverse order via `Promise.allSettled` (memoized, `H-3`). Extension taxonomy (middleware / registrar / extension) is documented and enforced.

### 4.8 DI & Context propagation — 🟡 tsyringe-backed; explicit ctx
- **Evidence:** `packages/di/src/container.ts` — *"Lightweight wrapper around tsyringe"*, `import { container as tsyContainer, Lifecycle } from 'tsyringe'`. Request scope via per-request child container (README + `container.scope.test.ts`).
- **Finding:** **No `AsyncLocalStorage` anywhere** in shipping source (verified). Context is passed explicitly. This is *edge-positive* (no ALS assumption) but means there is **no ambient request context** and no built-in trace-context propagation — a gap for cross-cutting concerns and distributed tracing.

### 4.9 Error propagation — 🟢 Safe defaults
- **Evidence:** `packages/errors/src/middleware.ts` — production hides stack/message unless `error.expose` is true; `application.ts` `handleError` swallows-and-logs handler failures (`H-2`) so a failing error handler never escapes into the adapter. `writeDefaultErrorResponse` is the single serializer shared by core and `@nextrush/errors` (`C-1`).

### 4.10 Startup cost / allocation / tree-shaking — 🟢 designed for it / **[UNVERIFIED]** at runtime
- **Evidence:** `sideEffects: false` on nearly all packages (`false` for `@nextrush/di`, `@nextrush/class`; the `nextrush` meta marks only `./dist/class.js` as side-effectful); ESM-only; per-middleware packages enable fine-grained tree-shaking.
- **Not verified:** actual cold-start ms, bundle KB, and RSS. The README explicitly **withdrew** its published benchmark numbers pending re-measurement, so no throughput figure is asserted here.

### 4.11 ESM / CJS — 🟠 ESM-only (deliberate)
- **Evidence:** every `package.json` uses `"type": "module"` and an `exports` map with **only** an `import` condition (e.g. `@nextrush/di`, `nextrush`, `@nextrush/class`) — **no `require` export**.
- **Impact:** CommonJS consumers (`require('nextrush')`) cannot use it. Defensible in 2026, but it excludes a still-large slice of the Node ecosystem and must be stated as a hard compatibility boundary.

---

## 5. Architecture Review

| Area | Assessment | Evidence |
|---|---|---|
| **Layering** | 🟢 Clean, enforced | `types → errors → core → router → di → class → adapters → middleware`; core has 0 `node:` imports; `global-rules.instructions.md` codifies the ban and source complies |
| **Runtime coupling** | 🟢 Isolated to adapters | `node:` imports confined to `adapters/node`, `middleware/{static,multipart/disk,template}`, `extensions/websocket`, `class/discovery` |
| **Node assumptions in core** | 🟢 None active | `process.` in `core/middleware.ts`, `errors/middleware.ts`, `di/service-decorators.ts` are **JSDoc/comments only**; `core/middleware.ts` explicitly forbids reading `process.env` (`C-4`) |
| **Tight coupling** | 🟡 DI→tsyringe | `@nextrush/di` is a thin wrapper; swapping the DI engine later is a breaking change for anyone importing tsyringe-specific behavior |
| **Technical debt** | 🟡 Naming/versioning/docs | `radix-tree.ts`/`RadixNode` vs "segment trie"; deprecated shim packages (`@nextrush/controllers`, `@nextrush/decorators`); mixed independent versions |
| **Scalability risk** | 🟡 Single maintainer | One author/maintainer across ~35 packages (`package.json` author; every `packages.json` entry same publisher) — bus-factor risk for a v1 |
| **Public API risk** | 🟡 Large surface, pre-frozen | Broad exported surface across many packages; `nextrush/class` re-exports ~40 symbols. Freezing this for v1 is a large commitment |
| **Plugin/extension limits** | 🟡 `exports` not enforced | `@Module` `exports` is *recorded but not enforced* (README + `docs/RFC/class-runtime/012-modules.md`) — modules group but do not encapsulate |
| **Release risk** | 🟡 Already at 3.x | Published at `3.x` on npm while positioned as "preparing v1" — the semver story is confusing for adopters |

---

## 6. Edge Compatibility

**Verdict: architecturally sound and functionally implemented; not yet proven on real edge platforms in CI.**

Node-only API scan of `core/router/runtime/di/class/stream/errors/types` (the request path):

| API | In core request path? | Evidence |
|---|---|---|
| `fs` / `node:fs` | ❌ | Only in `adapters/node`, `middleware/static`, `class/discovery` |
| `path` | ❌ | Same non-core locations |
| `process` | ⚠️ Detection only, guarded | `runtime/src/detection.ts` guards with `typeof process !== 'undefined'`; core middleware forbids `process.env` |
| `Buffer` | ⚠️ Type/JSDoc only in core | `types/src/context.ts` (example), `runtime/src/body-source.ts` |
| `crypto` (node) | ❌ in core | Web `crypto.subtle` probed via `probeCapabilities()` |
| `net`/`tls`/`http`/`https` | ❌ in core | Only `adapters/node` uses `node:http` |
| `worker_threads` | ❌ | Not used |
| `AsyncLocalStorage` | ❌ | Not used anywhere (verified) |
| `reflect-metadata` | ⚠️ class path only | `nextrush/src/class.ts` does `import 'reflect-metadata'`; functional `createApp` does not |
| Node streams | ❌ in core | Core uses Web `ReadableStream`; Node streams only in `adapter-node` |
| Timers/`globalThis` | 🟢 standard | `AbortSignal.any`, `AbortController` (Web-standard) |

**Edge-specific strengths (verified):**
- `packages/runtime/src/detection.ts` distinguishes `cloudflare-workers`, `vercel-edge`, `deno-deploy`, generic `edge`, with a per-runtime `capabilitiesFor()` matrix that correctly disables `fileSystem` on edge and a `probeCapabilities()` fallback for unknown runtimes.
- `packages/adapters/edge/src/adapter.ts` is fetch-native (`(Request) => Response`), supports a per-request `timeout` that returns **504**, and its own docs warn about the Cloudflare 1 MB bundle limit and advise avoiding `@nextrush/di`.

**Edge blockers / caveats:**
1. **No CI job runs on Cloudflare/Vercel/Deno.** `.github/workflows/ci.yml` runs `pnpm verify` on `ubuntu-latest` only. Edge conformance is *simulated* under vitest, not executed on `workerd`/V8-isolate. **This is the single biggest reason edge cannot be called production-ready.**
2. **Bundle size unmeasured [UNVERIFIED].** No size budget/CI check found; the 1 MB Workers limit is a real risk if the class API + middleware are bundled.
3. **`reflect-metadata` global mutation** on the class path adds weight and a global side effect on cold isolates.
4. **WebSockets, static files, multipart-disk, templates** are Node-coupled and unavailable on edge.

---

## 7. Serverless Compatibility

**Verdict: works on *fetch-based* serverless (Vercel Edge / CF / Netlify Edge); not supported first-party on *classic event-based* FaaS.**

- **Evidence of absence:** a source search for `APIGateway`, `lambdaHandler`, `handler(event`, `CloudFrontRequest`, `azureFunction` returned **zero** results. There is no `@nextrush/adapter-lambda`, `-gcf`, or `-azure`.
- **What works:** `createFetchHandler(app)` produces a Web-standard `fetch` handler usable on Vercel Edge and Cloudflare. On **AWS Lambda** this only works behind **AWS Lambda Web Adapter** or a Function URL with response streaming — i.e. a bridge the user must set up. There is no example verifying this.
- **Cold start / bundle / lazy-loading: [UNVERIFIED].** No measurements exist in-repo. The DI-free functional path *should* cold-start well (no reflect-metadata), but this is unproven.
- **Stateless execution:** ✅ the model is stateless per request (no module-level mutable request state; extension state is app-scoped and booted at `ready()`), which fits FaaS — but `ready()` must be awaited before the first request, and there is no documented "warm the app once per container" recipe for FaaS.

**Recommendation:** ship a `@nextrush/adapter-serverless` (event→`Request` mappers for APIGW v1/v2, Lambda Function URL, GCF, Azure) with a container-reuse pattern (`let app; app ??= await build()`).

---

## 8. TypeScript Audit

| Item | Assessment | Evidence |
|---|---|---|
| Strict mode | 🟢 Full | `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `verbatimModuleSyntax`, `isolatedModules` |
| Zero `any` | 🟢 Holds in shipping code | Every `: any`/`as any` match is under `__tests__` — no shipping-source hits |
| Declaration files + maps | 🟢 | `declaration`, `declarationMap`, `sourceMap` all true; packages ship `dist/*.d.ts` |
| Public typing quality | 🟢 | `Context`, `Middleware`, `Extension<TDecorated>` are precise; `extend()` returns `this & TDecorated` (typed decoration, no `declare module` needed) |
| Decorator dialect | 🔴 **Legacy** | `experimentalDecorators: true` + `emitDecoratorMetadata: true` — **not** TC39 Stage-3 standard decorators. Ties the class API to `reflect-metadata` and to TS-specific emit |
| `unknown` at boundaries | 🟢 | `ctx.body: unknown`, boundary inputs typed `unknown` then narrowed |
| Breaking-change risk | 🟡 | ESM-only + legacy decorators + large exported surface = high cost to change post-v1 |
| Toolchain pinning | 🟡 | Dev deps on open ranges: `typescript ^6.0.2`, `@types/node ^25`, `eslint ^10` (`package.json`). Reproducibility risk (dev-only, but affects contributors/CI) |

**Key TS finding:** the **legacy decorator dialect** is the most consequential long-term type decision. Standard decorators (TS 5.0+, now default in TC39) do **not** support `emitDecoratorMetadata`-style parameter reflection, which is exactly what tsyringe/`@nextrush/di` depends on. Migrating later is a **breaking change** for every class-based consumer.

---

## 9. Package Audit

**Present and substantive (verified via source + tests):**

| Package | Role | Notes |
|---|---|---|
| `@nextrush/types`, `@nextrush/errors`, `@nextrush/core`, `@nextrush/router`, `@nextrush/runtime` | Core | 0 `node:` imports; strict TS |
| `@nextrush/adapter-node` | Node transport | Real graceful shutdown + timeouts |
| `@nextrush/adapter-bun`, `-deno`, `-edge` | Multi-runtime | Real impls + `conformance` suite |
| `@nextrush/di`, `@nextrush/class` | DI + decorators | tsyringe + reflect-metadata; legacy decorators |
| `@nextrush/stream` | SSE/NDJSON | AI-oriented streaming |
| Middleware | `body-parser, multipart, cors, csrf, helmet, rate-limit, compression, cookies, validation, request-id, timer, static, template, logger, openapi` | Broad; validation = Standard Schema (Zod/Valibot/ArkType) |
| Extensions | `events`, `websocket` | websocket Node-coupled |
| Tooling | `dev` (CLI/dev-server/codemods), `create-nextrush` (scaffolder), `testing` (`createTestModule`) | |
| Deprecated shims | `@nextrush/controllers`, `@nextrush/decorators` | Redirect to `@nextrush/class` |

**Package-level risks:**
- `packages/router/src/router.ts` is **28 KB** in one file — near/over the project's own 1,000-LOC router budget (`v3-architecture.instructions.md`); a maintainability hotspot.
- `di.resolve` is the #1 fan-in hotspot (fan-in 99 per graph analysis) — central dependency; regressions here are high-blast-radius.
- Deprecated shim packages still published at `3.x` add adopter confusion.

---

## 10. Missing Features (verified absent)

**Security / identity (highest-impact gaps):**
- ❌ Authentication (no `@nextrush/auth`)
- ❌ Authorization / RBAC / policies
- ❌ JWT (issue/verify/rotate)
- ❌ Sessions (store abstraction)
- ✅ CSRF exists · ✅ CORS · ✅ Helmet · ✅ Rate limiting · ✅ Cookies (signed)

**Data / infra:**
- ❌ Cache abstraction · ❌ Redis/KV driver · ❌ Queue · ❌ Cron/scheduler · ❌ Webhooks

**Observability / ops (verified absent):**
- ❌ OpenTelemetry · ❌ Metrics (Prometheus/OpenMetrics) · ❌ Health-check package · ❌ Built-in distributed tracing / correlation propagation (only `@nextrush/request-id` + `@nextrush/logger`)
- ❌ Auto graceful-shutdown-on-signal (SIGTERM/SIGINT) — machinery exists (`server.close()`), wiring does not (only in `packages/dev` + benchmark harness)
- ❌ Environment validation / secret management (DI has a `@Config()` decorator but no schema-validated env layer)

**Protocols / APIs:**
- ❌ GraphQL · ❌ RPC/tRPC-style · ✅ OpenAPI 3.1 generation exists (`@nextrush/openapi`)

**Adapters:**
- ❌ AWS Lambda / GCF / Azure / Netlify-Functions (non-edge) · ✅ Node/Bun/Deno/Edge exist

---

## 10a. Ecosystem Comparison

NextRush's standing **per capability, relative to each framework** (from NextRush's perspective): 🟢 Better · ⚪ Equal · 🟡 Behind · 🔴 Missing. Competitor characteristics are well-established general knowledge; NextRush cells reflect only what was verified in-repo.

| Capability | vs Express | vs Fastify | vs Hono | vs Nitro | vs NestJS | vs Elysia |
|---|---|---|---|---|---|---|
| Runtime portability (Node/Bun/Deno/Edge) | 🟢 Better | 🟢 Better | 🟡 Behind (Hono is proven on all) | 🟡 Behind (Nitro deploy presets) | 🟢 Better | ⚪ Equal (Elysia Bun-centric) |
| Router performance | 🟢 Better | ⚪ Equal | ⚪ Equal | ⚪ Equal | 🟢 Better | ⚪ Equal |
| TypeScript-first / strictness | 🟢 Better | 🟢 Better | ⚪ Equal | ⚪ Equal | ⚪ Equal | 🟡 Behind (Elysia e2e inference) |
| End-to-end type inference / RPC | 🟡 Behind | 🟡 Behind | 🟡 Behind (Hono RPC) | 🟡 Behind | 🟡 Behind | 🟡 Behind (Eden) |
| Middleware model | 🟢 Better (async) | ⚪ Equal | ⚪ Equal | ⚪ Equal | ⚪ Equal | ⚪ Equal |
| DI / decorators / modules | 🟢 Better | 🟢 Better | 🟢 Better | 🟢 Better | 🟡 Behind (Nest is the standard) | 🟢 Better |
| Streaming / SSE / NDJSON | 🟢 Better | 🟢 Better | ⚪ Equal | ⚪ Equal | 🟢 Better | ⚪ Equal |
| Validation | ⚪ Equal (Standard Schema) | 🟡 Behind (JSON-schema native) | ⚪ Equal | ⚪ Equal | ⚪ Equal | 🟡 Behind (TypeBox-native) |
| OpenAPI generation | 🟢 Better | ⚪ Equal | ⚪ Equal | ⚪ Equal | 🟡 Behind (Nest Swagger) | ⚪ Equal |
| Auth / session (official) | 🔴 Missing | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind (Nest ecosystem) | 🟡 Behind |
| Observability (OTel/metrics) | 🔴 Missing | 🟡 Behind (rich ecosystem) | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind |
| Serverless deploy presets | 🔴 Missing | 🟡 Behind | 🟡 Behind | 🟡 Behind (Nitro's core strength) | 🟡 Behind | 🟡 Behind |
| Zero-dependency core | 🟢 Better | 🟢 Better | ⚪ Equal (Hono also lean) | 🟢 Better | 🟢 Better | ⚪ Equal |
| CommonJS support | 🟡 Behind (ESM-only) | 🟡 Behind | ⚪ Equal | ⚪ Equal | 🟡 Behind | ⚪ Equal |
| Ecosystem breadth / plugins | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind |
| Maturity / adoption / community | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind | 🟡 Behind |
| Proven multi-runtime in CI | 🟢 Better | 🟢 Better | 🟡 Behind | 🟡 Behind | 🟢 Better | 🟡 Behind |

**Reading of the matrix:** NextRush's **differentiators** are a genuinely runtime-agnostic core, a lean/dependency-free functional path, first-class DI+decorators *without* Nest's weight, and AI-oriented streaming. Its **structural disadvantages** are all breadth/proof/maturity: no auth/observability/serverless presets, ESM-only, a single maintainer, and — critically — multi-runtime that is *architected* better than most but *proven* less than Hono/Nitro because CI never runs on the target runtimes (R-1). Against **Hono** and **Nitro** specifically (its closest positioning rivals), NextRush is behind precisely where they are strongest: proven edge/serverless deployment.

---

## 11. Production Risks

Each risk uses: **Evidence → Problem → Impact → Recommendation → Priority → Effort → Benefit.**

### R-1 — Multi-runtime support is not exercised in CI on real runtimes
- **Evidence:** `.github/workflows/ci.yml` runs a single `ci` job on `ubuntu-latest`, one Node version, `pnpm verify`. Bun/Deno/Edge tests run under vitest (Node), not on `bun`/`deno`/`workerd`.
- **Problem:** "Runs on Bun/Deno/Cloudflare" is validated by simulation, not execution. Runtime-specific breakage (e.g. `Bun.serve` semantics, Deno permissions, Workers isolate limits) would ship undetected.
- **Impact:** Edge/Bun/Deno readiness claims are unbacked; regressions reach users.
- **Recommendation:** Add CI jobs on real Bun, Deno, and `workerd` (`wrangler dev`/miniflare), plus a Node version matrix (20 LTS + 22 + 24).
- **Priority:** **P0** · **Effort:** Medium · **Benefit:** Converts three Beta targets toward Production.

### R-2 — "Zero Dependencies" is inaccurate for the class/DI path
- **Evidence:** `@nextrush/di` `dependencies: { tsyringe ^4.10.0, reflect-metadata ^0.2.2 }`; `container.ts` = "wrapper around tsyringe"; `nextrush` meta declares `reflect-metadata`. README states "Zero Dependencies."
- **Problem:** A headline correctness claim is false for a major usage path; also a supply-chain surface (tsyringe is maintenance-mode).
- **Impact:** Erodes trust in evaluation; misleads security review.
- **Recommendation:** Reword to "zero-dependency functional core; DI path depends on tsyringe + reflect-metadata." Longer term, evaluate replacing tsyringe with an in-house container to reclaim the claim.
- **Priority:** **P0 (docs) / P2 (de-tsyringe)** · **Effort:** Small (docs) / Large (replace) · **Benefit:** Accuracy; smaller trusted dependency tree.

### R-3 — No auto graceful-shutdown-on-signal
- **Evidence:** `serve()` returns `{ close() }` with real drain logic, but no `process.on('SIGTERM'/'SIGINT')` anywhere in the framework (only `packages/dev` + `apps/benchmark`). `listen(app, port)` takes only a port.
- **Problem:** In Kubernetes/PM2/systemd, a SIGTERM kills the process mid-request unless the user manually wires `close()`.
- **Impact:** Dropped in-flight requests, 502s on rollout — a classic production incident.
- **Recommendation:** Add an opt-in `serve(app, { gracefulShutdown: true })` (or a `handleShutdown(server)` helper) that wires SIGTERM/SIGINT → `server.close()`; document the manual pattern prominently.
- **Priority:** **P1** · **Effort:** Small · **Benefit:** Zero-downtime deploys out of the box.

### R-4 — No observability primitives (OTel / metrics / health)
- **Evidence:** search for `opentelemetry`/`metrics`/`healthCheck` → only docs + logger; no package.
- **Problem:** Enterprises require traces, RED/USE metrics, and health/readiness endpoints. None ship.
- **Impact:** Not adoptable in regulated/observability-mandated environments without significant glue.
- **Recommendation:** Ship `@nextrush/otel` (spans + W3C `traceparent` propagation), `@nextrush/metrics` (Prometheus), `@nextrush/health` (liveness/readiness). No `AsyncLocalStorage` today means trace-context needs an explicit or ALS-based design decision.
- **Priority:** **P1** · **Effort:** Large · **Benefit:** Unlocks enterprise adoption.

### R-5 — No first-party auth/authz/JWT/session
- **Evidence:** package inventory; no such packages.
- **Problem:** The most common "day one" needs for an API framework are absent.
- **Impact:** Every adopter reinvents auth; inconsistent, error-prone security.
- **Recommendation:** `@nextrush/auth` (strategy abstraction + JWT + session store) with secure defaults and guard integration for the class API.
- **Priority:** **P1** · **Effort:** Large · **Benefit:** Major adoption + security consistency.

### R-6 — No classic serverless adapter
- **Evidence:** zero hits for Lambda/GCF/Azure signatures.
- **Problem:** "Serverless-ready" is only true for fetch-based edge, not classic FaaS.
- **Impact:** Lambda/GCF/Azure users are blocked or must hand-roll bridges.
- **Recommendation:** `@nextrush/adapter-serverless` with event mappers + container-reuse guidance; add a cold-start benchmark.
- **Priority:** **P2** · **Effort:** Medium · **Benefit:** Opens the largest serverless market.

### R-7 — Router naming drift (segment trie shipped as "radix")
- **Evidence:** `router.ts` says "segment trie, not a radix tree"; file `radix-tree.ts`, type `RadixNode`, JSDoc "Radix tree node/compressed trie"; npm keyword `radix-tree`.
- **Problem:** Internal inconsistency + misleading external metadata; confuses contributors and evaluators comparing routing algorithms.
- **Impact:** Credibility; onboarding friction.
- **Recommendation:** Rename to `segment-trie.ts`/`TrieNode`, fix JSDoc + npm keywords/description.
- **Priority:** **P2** · **Effort:** Small · **Benefit:** Accuracy; cleaner mental model.

### R-8 — Legacy decorator dialect locks the class API
- **Evidence:** `tsconfig.base.json` `experimentalDecorators`/`emitDecoratorMetadata`; tsyringe requires it.
- **Problem:** Diverges from TC39 standard decorators; migration is breaking and blocked by tsyringe.
- **Impact:** Future TS toolchains may deprecate legacy emit; a forced migration would break all class users.
- **Recommendation:** Publish an ADR committing to a dialect for v1 (they have `ADR-0001-decorator-dialect.md` — ensure it states the long-term exit plan), and isolate reflection behind an internal boundary (`ADR-0004`) so a future swap is contained.
- **Priority:** **P2** · **Effort:** Medium–Large · **Benefit:** Reduces long-term breaking-change exposure.

### R-9 — ESM-only excludes CommonJS consumers
- **Evidence:** every `exports` map has only an `import` condition; `"type": "module"`.
- **Problem:** `require()` users cannot consume NextRush.
- **Impact:** Excludes legacy Node codebases.
- **Recommendation:** Decide explicitly for v1 (ESM-only is defensible); document it as a supported boundary. Optionally dual-publish core packages.
- **Priority:** **P3** · **Effort:** Medium · **Benefit:** Broader reach (if pursued).

### R-10 — Single-maintainer / bus-factor & version-story confusion
- **Evidence:** one author across all packages; published at `3.x` while "preparing v1"; mixed independent versions (core `3.1.0`, some middleware `3.0.5`); deprecated shims still published.
- **Problem:** Sustainability and semver-clarity risks for public adoption.
- **Impact:** Adopters can't reason about stability; bus-factor of 1.
- **Recommendation:** Publish a compatibility matrix + support policy; recruit maintainers/governance; resolve the "3.x vs v1" narrative (e.g. treat the API-freeze release as the marketed "stable" line with a clear support statement).
- **Priority:** **P2** · **Effort:** Medium · **Benefit:** Adoption confidence.

### R-11 — Coverage/quality-gate enforcement not confirmed in CI
- **Evidence:** `pnpm verify` = build/test/typecheck/lint; steering targets 90% coverage but the CI step does not visibly run/gate `test:coverage`. **[Partially UNVERIFIED]**
- **Problem:** Coverage may regress silently despite a stated 90% target.
- **Impact:** Erosion of the test discipline that is currently a strength.
- **Recommendation:** Add a coverage gate to CI with per-package thresholds.
- **Priority:** **P2** · **Effort:** Small · **Benefit:** Locks in test quality.

---

## 12. Risk Register

| ID | Risk | Severity | Likelihood | Detectability | Priority |
|---|---|---|---|---|---|
| R-1 | Multi-runtime unproven in CI | High | High | Low (silent) | **P0** |
| R-2 | "Zero deps" inaccurate | Medium | Certain | High | **P0** (docs) |
| R-3 | No signal graceful shutdown | High | High | Medium | **P1** |
| R-4 | No observability (OTel/metrics/health) | High | High | High | **P1** |
| R-5 | No auth/authz/JWT/session | High | High | High | **P1** |
| R-6 | No classic serverless adapter | Medium | Medium | High | **P2** |
| R-7 | Router naming drift | Low | Certain | High | **P2** |
| R-8 | Legacy decorator lock-in | Medium | Medium | Medium | **P2** |
| R-9 | ESM-only excludes CJS | Medium | Medium | High | **P3** |
| R-10 | Bus-factor / version story | High | Medium | Medium | **P2** |
| R-11 | Coverage gate unconfirmed | Medium | Medium | Low | **P2** |
| R-12 | Bundle size vs CF 1MB unmeasured | Medium | Medium | Low | **P1** |
| R-13 | WebSocket/static/multipart Node-only (edge gap) | Medium | Certain | High | **P2** |
| R-14 | Node ≥22 engine floor (drops Node 20 LTS) | Low | Certain | High | **P3** |

---

## 13. Recommendations (prioritized)

1. **Prove the runtimes you ship (R-1).** Real Bun/Deno/`workerd` CI jobs + Node version matrix. Nothing else moves edge/Bun/Deno off Beta.
2. **Fix the accuracy debt now (R-2, R-7).** Correct "Zero Dependencies," and the radix/segment-trie naming. Cheap; disproportionately improves credibility.
3. **Ship operational baseline (R-3, R-4, R-12).** Signal-wired graceful shutdown, a health package, OTel + metrics, and a bundle-size CI budget.
4. **Close the identity gap (R-5).** `@nextrush/auth` (+ JWT, sessions) with secure defaults.
5. **Serverless story (R-6).** Event adapter + cold-start benchmark + container-reuse docs.
6. **Commit the hard boundaries for v1 (R-8, R-9, R-10).** ADRs for decorator dialect, ESM-only, Node floor; a public support/compat matrix and governance plan.

---

## 14. Final Verdict

**NextRush is a genuinely well-engineered core wrapped in an incomplete product.** The request pipeline, router, middleware model, error handling, and Node lifecycle are production-grade and demonstrably hardened; the runtime-agnostic core is real, not aspirational; the TypeScript discipline is excellent. This is **not** a hobby framework.

However, for the stated ambition — *enterprise workloads, public OSS adoption, edge, serverless, and traditional Node* — it is **Beta**, gated by three categories of gap that are about **proof and breadth, not core correctness**:

- **Proof:** multi-runtime and edge support is implemented but not continuously validated on the runtimes it targets (R-1); bundle size and cold-start are unmeasured (R-12).
- **Operations:** no observability, no signal-based graceful shutdown, no health checks (R-3, R-4).
- **Breadth:** no auth/authz/session/cache/classic-serverless; accuracy debt in public claims (R-2, R-5, R-6).

**Recommended release posture:**
- **Node.js functional API → v1-ready** after R-3 and the R-2/R-7 accuracy fixes.
- **Edge / Bun / Deno → keep labeled Beta/experimental** until R-1 lands.
- **Classic serverless → not supported; say so** until R-6 ships.
- **Enterprise → not yet**, pending R-4 and R-5.

The distance to a credible v1 is **modest and well-scoped** precisely because the foundation is sound. The roadmap in `02-production-roadmap.md` sequences the work.
