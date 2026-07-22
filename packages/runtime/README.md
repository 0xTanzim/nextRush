# @nextrush/runtime

> The shared cross-runtime layer NextRush adapters are built on — runtime detection, capability negotiation, and the Fetch-API request/response primitives every adapter would otherwise re-implement.

[![npm version](https://img.shields.io/npm/v/@nextrush/runtime.svg)](https://www.npmjs.com/package/@nextrush/runtime)
[![downloads](https://img.shields.io/npm/dm/@nextrush/runtime.svg)](https://www.npmjs.com/package/@nextrush/runtime)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/runtime.svg)](https://bundlephobia.com/package/@nextrush/runtime)
[![types](https://img.shields.io/npm/types/@nextrush/runtime.svg)](https://www.npmjs.com/package/@nextrush/runtime)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/runtime.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Detect the JavaScript runtime, negotiate its capabilities, and provide the cross-runtime primitives (body reading, response building, client-IP resolution, startup errors) every NextRush adapter shares |
| **Package type** | Core — cross-runtime foundation |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | Indirectly — the adapter that powers `nextrush` depends on it, so its code ships transitively. Its detection/capability API is **not** re-exported from the meta barrel; install `@nextrush/runtime` directly to call `detectRuntime()` and friends. |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- ✅ **Near-zero dependencies** — depends only on `@nextrush/types` (contracts) and `@nextrush/errors` (the `ServerStartError` base); no third-party runtime deps
- ✅ **One implementation, every runtime** — Node, Bun, Deno, and Edge share one body reader, one response builder, and one client-IP policy instead of four that drift
- ✅ **Capability negotiation, not runtime branching** — features are decided by a probed capability matrix, never by `if (runtime === 'x')`
- ✅ **ESM-only**, tree-shakable, side-effect-free (`"sideEffects": false`)
- ✅ **Fully typed** — strict TypeScript, zero `any`; hardened against prototype pollution, header injection, and parameter flooding

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

NextRush runs the same application on Node, Bun, Deno, and every edge runtime, behind a thin per-platform adapter. Each adapter needs the same handful of things: read a request body within a size limit, build a Fetch `Response` with header-safety checks, resolve the client IP from proxy headers, and turn a bind failure into a useful error. Left to each adapter, those routines drift — and they did.

```ts
// TODAY, without a shared runtime layer — each adapter forks the same logic,
// and the four copies disagree the moment one is patched:

// in the Node adapter
function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress;
} // no format validation — a spoofed header flows straight through

// in the Bun adapter
function clientIp(req) {
  return req.headers.get('x-real-ip') ?? '';
} // different header, different precedence, different result for the same request

// startup failure: Node rejects the raw EADDRINUSE, Bun rewrites the message,
// Deno does neither — three shapes for one failure.
```

`@nextrush/runtime` fixes this by owning those primitives in one place, below the adapters. There is exactly one client-IP precedence, one body-size guard, one response builder, and one `ServerStartError` — so Node, Bun, Deno, and Edge resolve the same request identically. On top of that it answers the question the primitives depend on: *what can this runtime actually do?* — via a capability matrix that is probed, not hardcoded per runtime name.

## When to use

`@nextrush/runtime` is infrastructure. If you are building an application you almost never import it directly — you talk to `createApp()` and an adapter, and this layer works underneath. You reach for it when you are extending the framework across runtimes.

**Use `@nextrush/runtime` if:**

- ✓ You're **authoring an adapter** and need the shared body reader, response builder, client-IP policy, or startup-error normalizer so your adapter matches the others
- ✓ You need to **detect the current runtime** (`detectRuntime()`, `isNode()`, `isEdge()`) or its **capabilities** (`getRuntimeCapabilities()`) to gate a feature
- ✓ You want the **named capability profiles** (`NodeProfile`, `CloudflareProfile`, …) for documentation, defaults, or a diagnostics view
- ✓ You need the shared **timeout / shutdown / keep-alive constants** so your adapter's defaults can't drift from the others

**Reach for something else if:**

- ✗ You want to **start a server** — `listen()` / `serve()` live in the platform adapters, not here → use [`@nextrush/adapter-node`](../adapters/node) (or `bun` / `deno` / `edge`)
- ✗ You want the request/response **contracts** (`Context`, `Runtime`, `BodySource` types) → they're declared in [`@nextrush/types`](../types); this package implements against them
- ✗ You're building an **application** — you get cross-runtime behavior for free through `nextrush` + an adapter

---

## Installation

```bash
pnpm add @nextrush/runtime
# npm i @nextrush/runtime · yarn add @nextrush/runtime · bun add @nextrush/runtime
```

> [!NOTE]
> Already using `nextrush`? This package's code ships transitively (your adapter depends on it), but
> its detection and capability API is not re-exported from the `nextrush` barrel. Install
> `@nextrush/runtime` directly only when you need to call `detectRuntime()`, read capabilities, or
> build an adapter.

## Quick start

```ts
import {
  detectRuntime,
  getRuntimeCapabilities,
} from '@nextrush/runtime';

const runtime = detectRuntime();        // 'node' | 'bun' | 'deno' | 'edge' | ...
const caps = getRuntimeCapabilities();  // capability matrix for THIS runtime

// Decide a feature by capability, never by runtime name:
if (caps.webStreams) {
  // safe to stream the response with a ReadableStream
} else {
  // buffer and send instead
}
```

Detection is memoized after the first call, and the feature decision keys off `caps.webStreams` — not `runtime === 'node'` — so a capable-but-unrecognized runtime still gets the streaming path.

## Capabilities

**Runtime detection**
- **`detectRuntime()` / `getRuntime()`** — identify Node, Bun, Deno, Deno Deploy, Cloudflare Workers, Vercel Edge, generic edge, or `'unknown'`; `getRuntime()` memoizes the result
- **`detectEdgeRuntime()`** — granular edge platform flags (`isCloudflare` / `isVercel` / `isNetlify` / `isGenericEdge`)
- **Predicates** — `isNode()` · `isBun()` · `isDeno()` · `isEdge()` · `isRuntime(r)`
- **`getRuntimeVersion()` / `getRuntimeInfo()`** — version string and the combined `{ runtime, version, capabilities }` view

**Capability negotiation**
- **`capabilitiesFor(runtime)`** — the pure capability matrix for a runtime; unknown/future runtimes are answered by feature-probing, never an all-`false` blank
- **`getRuntimeCapabilities()`** — the matrix for the current runtime
- **Named profiles** — `NodeProfile` · `BunProfile` · `DenoProfile` · `DenoDeployProfile` · `CloudflareProfile` · `VercelEdgeProfile` · `EdgeProfile` · `LambdaProfile`, plus `capabilityProfileFor(runtime)`

**Cross-runtime request/response primitives**
- **Body reading** — `WebBodySource` / `EmptyBodySource` / `AbstractBodySource` and `createWebBodySource()` with a `DEFAULT_BODY_LIMIT`; throws `BodyTooLargeError` / `BodyConsumedError`
- **Response building** — `WebResponseBuilder` for Fetch-API adapters, plus `assertHeaderSafe()`, `isBodylessResponse()`, and `jsonErrorResponse()` for a uniform framework-error `Content-Type` (F-05)
- **Shared Context shell** — `WebContextBase` (F-08): the Bun/Deno/Edge contexts extend this one class for their response methods, lazy `raw`/`signal`, streaming, and `get`/`next`/`throw`/`assert`, instead of triplicating it
- **Client IP** — one policy: `resolveClientIp()` / `getClientIp()` / `getEdgeClientIp()`, with structural `isValidClientIp()`
- **Headers & query** — `headersToRecord()` (prototype-pollution-safe, keeps multi-value `set-cookie`) and `parseQueryString()` (single-pass, DoS-limited)
- **Cancellation** — `combineAbortSignal()` merges client-disconnect and timeout into one `ctx.signal`

**Server startup errors**
- **`ServerStartError` / `normalizeStartupError()`** — one typed error (`EADDRINUSE` / `EACCES` / `EADDRNOTAVAIL` / `UNKNOWN`) so every adapter surfaces bind failures identically

**Shared constants**
- **`DEFAULT_TIMEOUT_MS` · `DEFAULT_SHUTDOWN_TIMEOUT_MS` · `DEFAULT_KEEP_ALIVE_TIMEOUT_MS` · `METHODS_WITHOUT_BODY`** — the single source of truth for adapter defaults

## Mental model

`@nextrush/runtime` answers two questions and provides one toolbox. First, *which runtime is this and what can it do?* Second, *how do I read a body / build a response / resolve an IP the same way everywhere?* Adapters ask both.

```text
                         detectRuntime()  ------->  'node'|'bun'|'deno'|'edge'|...
  adapter startup ---->  capabilitiesFor() ------>  { webStreams, fetch, cryptoSubtle, ... }
  (once, cached)         NodeProfile / ...  ----->  named capability data (defaults & docs)

                         parseQueryString(qs) ---->  safe QueryParams (no proto pollution)
  per request     ---->  WebBodySource / Builder ->  read body (size-limited) / build Response
  (web adapters)         resolveClientIp(headers)->  one IP precedence, all adapters
                         combineAbortSignal(sig) ->  timeout <-> client-disconnect
```

**Rule:** decide features by capability (`caps.webStreams`), never by runtime identity (`runtime === 'node'`). Profiles are data to read, not a license to branch behavior on a name.

> [!TIP]
> The startup sequence (how an adapter uses detection, then the per-request primitives) and the
> internal module map — with Mermaid diagrams — are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Detect the runtime and gate a feature by capability

```ts
import { getRuntime, getRuntimeCapabilities } from '@nextrush/runtime';

const runtime = getRuntime(); // memoized

const { fileSystem, webSocket } = getRuntimeCapabilities();
if (fileSystem) {
  // safe to read/write files on this runtime
}
if (webSocket) {
  // WebSocket upgrade supported
}
```

### Read a request body with a size limit

```ts
import { createWebBodySource, BodyTooLargeError } from '@nextrush/runtime';

const source = createWebBodySource(request.body, { limit: 1_000_000 }); // 1 MB
try {
  const text = await source.text();
} catch (err) {
  if (err instanceof BodyTooLargeError) {
    // respond 413 Payload Too Large
  }
}
```

### Resolve the client IP with one shared policy

```ts
import { resolveClientIp } from '@nextrush/runtime';

const ip = resolveClientIp((name) => request.headers.get(name) ?? undefined, {
  trustProxy: true,       // only trust proxy headers when you sit behind one
  directIp: socketRemote, // the socket address, used when trustProxy is false
});
// precedence when trusted: cf-connecting-ip -> x-forwarded-for[0] -> x-real-ip,
// each format-validated; a malformed header is skipped, not trusted.
```

### Normalize a server startup failure

```ts
import { normalizeStartupError } from '@nextrush/runtime';

try {
  await bindServer({ port: 8080, host: '0.0.0.0' });
} catch (raw) {
  // Same typed error + actionable message on Node, Bun, and Deno:
  throw normalizeStartupError(raw, { port: 8080, host: '0.0.0.0' });
  // -> ServerStartError { code: 'EADDRINUSE', status: 500, expose: false }
}
```

## API overview

The sealed public surface (ADR-0005), guarded by `__tests__/public-surface.test.ts`. Key value exports:

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `detectRuntime` | `() => Runtime` | `3.0.0` | Stable ✅ | Identify the current runtime (uncached). |
| `getRuntime` | `() => Runtime` | `3.0.0` | Stable ✅ | Memoized `detectRuntime()` for the hot path. |
| `getRuntimeCapabilities` | `() => RuntimeCapabilities` | `3.0.0` | Stable ✅ | Capability matrix for the current runtime. |
| `capabilitiesFor` | `(r: Runtime) => RuntimeCapabilities` | `3.0.0` | Stable ✅ | Pure capability matrix; probes for unknown runtimes. |
| `getRuntimeInfo` | `() => RuntimeInfo` | `3.0.0` | Stable ✅ | `{ runtime, version, capabilities }`. |
| `detectEdgeRuntime` | `() => EdgeRuntimeInfo` | `3.0.0` | Stable ✅ | Granular edge-platform flags. |
| `isNode` / `isBun` / `isDeno` / `isEdge` | `() => boolean` | `3.0.0` | Stable ✅ | Runtime predicates (`isEdge` covers CF/Vercel/generic). |
| `isRuntime` | `(r: Runtime) => boolean` | `3.0.0` | Stable ✅ | Predicate for a specific runtime. |
| `parseQueryString` | `(qs: string) => QueryParams` | `3.0.0` | Stable ✅ | Single-pass, DoS-limited, prototype-pollution-safe parser. |
| `createWebBodySource` | `(body, opts?) => WebBodySource` | `3.1.0` | Stable ✅ | Size-limited Fetch-API body reader. |
| `WebResponseBuilder` | `class` | `3.1.0` | Stable ✅ | Shared Fetch-`Response` builder for web adapters. |
| `jsonErrorResponse` | `(status, message) => Response` | `3.1.0` | Stable ✅ | Uniform-charset framework error response (F-05). |
| `WebContextBase` | `class` | `3.1.0` | Stable ✅ | Shared Web Context shell for Bun/Deno/Edge (F-08). |
| `resolveClientIp` | `(get, opts) => string` | `3.1.0` | Stable ✅ | The one client-IP precedence + validation policy. |
| `combineAbortSignal` | `(base: AbortSignal) => CombinedAbort` | `3.1.0` | Stable ✅ | Merge client-disconnect and timeout into one signal. |
| `normalizeStartupError` | `(err, ctx) => ServerStartError` | `3.1.0` | Stable ✅ | Uniform bind-failure error across adapters. |

### Exports by domain

| Domain | Exports |
| ------ | ------- |
| **Detection** (`detection.ts`) | `detectRuntime` · `getRuntime` · `getRuntimeVersion` · `getRuntimeInfo` · `detectEdgeRuntime` · `isNode` · `isBun` · `isDeno` · `isEdge` · `isRuntime` · `resetRuntimeCache` · `capabilitiesFor` · `getRuntimeCapabilities` · type `EdgeRuntimeInfo` |
| **Capability profiles** (`profiles.ts`) | `NodeProfile` · `BunProfile` · `DenoProfile` · `DenoDeployProfile` · `CloudflareProfile` · `VercelEdgeProfile` · `EdgeProfile` · `LambdaProfile` · `capabilityProfileFor` · type `CapabilityProfile` |
| **Body source** (`body-source.ts`) | `AbstractBodySource` · `WebBodySource` · `EmptyBodySource` · `createWebBodySource` · `createEmptyBodySource` · `BodyConsumedError` · `BodyTooLargeError` · `DEFAULT_BODY_LIMIT` |
| **Response builder** (`response-builder.ts`) | `WebResponseBuilder` · `assertHeaderSafe` · `isBodylessResponse` · `jsonErrorResponse` |
| **Web Context base** (`web-context-base.ts`) | `WebContextBase` · types `WebRawHttp` · `WebStreamRunners` |
| **Headers** (`headers.ts`) | `headersToRecord` · `resolveClientIp` · `getClientIp` · `getEdgeClientIp` · `isValidClientIp` · types `ClientIpOptions` · `HeaderLookup` |
| **Query** (`query.ts`) | `parseQueryString` |
| **Request signal** (`request-signal.ts`) | `combineAbortSignal` · type `CombinedAbort` |
| **Startup errors** (`server-error.ts`) | `ServerStartError` · `normalizeStartupError` · type `ServerStartErrorCode` |
| **Constants** (`constants.ts`) | `DEFAULT_TIMEOUT_MS` · `DEFAULT_SHUTDOWN_TIMEOUT_MS` · `DEFAULT_KEEP_ALIVE_TIMEOUT_MS` · `METHODS_WITHOUT_BODY` |
| **Re-exported types** (from `@nextrush/types`) | `Runtime` · `RuntimeInfo` · `RuntimeCapabilities` · `BodySource` · `BodySourceOptions` |

## Options

No configuration object — `@nextrush/runtime` exports functions and classes, not a configurable middleware. There is nothing to instantiate globally; behavior is controlled per call through documented option objects:

| Option object | Used by | Key fields |
| ------------- | ------- | ---------- |
| `ClientIpOptions` | `resolveClientIp` | `trustProxy` (⚠️ security-sensitive) · `directIp` · `cloudflare?` |
| `BodySourceOptions` | `createWebBodySource` | `limit` (bytes; defaults to `DEFAULT_BODY_LIMIT`) |

> [!WARNING]
> `trustProxy` decides whether `x-forwarded-for` / `x-real-ip` are believed. Enable it **only** when
> the process sits behind a proxy you control — otherwise a client can spoof its own IP. This is the
> single security-relevant switch in the package.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | Detected via `process.versions.node`. |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Detected by feature-probing global objects (`Bun`, `Deno`, `navigator.userAgent`, Web `Request`); unknown runtimes fall back to a probed capability matrix, not an all-`false` blank. |

**Integration**
- **Peer dependencies:** none — depends on `@nextrush/types` and `@nextrush/errors` directly.
- **Works with:** every `@nextrush/adapter-*` package (they build on these primitives).
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>detectRuntime()</code> returns <code>'unknown'</code></strong></summary>

**Cause:** the environment exposes none of the probed signals (no `Bun` / `Deno` global, no `process.versions.node`, no Web `Request`). **Fix:** you can still call `getRuntimeCapabilities()` — for `'unknown'` it feature-probes the available globals rather than reporting everything as unsupported, so a capable runtime keeps working. If you expected a known runtime, verify the global your platform sets is present at the point of the call.

</details>

<details>
<summary><strong><code>ctx.ip</code> is empty or wrong behind my proxy</strong></summary>

**Cause:** `trustProxy` is `false` (the safe default), so proxy headers are ignored and `directIp` is returned; behind a proxy the socket address is the proxy, not the client. **Fix:** pass `trustProxy: true` to the adapter/`resolveClientIp` **only** when you actually sit behind a trusted proxy. The precedence is then `cf-connecting-ip` → `x-forwarded-for[0]` → `x-real-ip`, each format-validated.

</details>

<details>
<summary><strong>Reading the request body throws <code>BodyConsumedError</code></strong></summary>

**Cause:** a `BodySource` stream can be consumed once; a second `text()` / `json()` / `arrayBuffer()` call (e.g. two middleware both reading the body) fails. **Fix:** read the body once and share the parsed result via `ctx.state`, or buffer it in a body-parser middleware that later readers reuse.

</details>

<details>
<summary><strong>My test sees a stale runtime after mocking globals</strong></summary>

**Cause:** `getRuntime()` and `detectEdgeRuntime()` cache their result on first call. **Fix:** call `resetRuntimeCache()` between tests that swap the runtime globals. It is exported for exactly this (marked `@internal` — test-only, not an application API).

</details>

## FAQ

**Where is `listen()` / how do I start a server?**
Not here. `@nextrush/runtime` provides the cross-runtime *primitives*; the server lifecycle (`listen` / `serve`) lives in each platform adapter — [`@nextrush/adapter-node`](../adapters/node), `-bun`, `-deno`, `-edge`. Application code gets `listen` through `nextrush`.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes — detecting and serving those runtimes identically is the whole point. Detection probes each platform's globals; the primitives (body, response, IP, query) are written against Web-standard `Request` / `Response` / `ReadableStream`.

**Why detect the runtime at all if I shouldn't branch on it?**
Detection drives *adapter selection* and *diagnostics/defaults*, not feature behavior. Feature decisions go through `getRuntimeCapabilities()` — a probed matrix — so an unrecognized runtime still gets every capability it actually supports.

---

## Package relationships

```text
                    depends on          @nextrush/types  ·  @nextrush/errors
@nextrush/runtime ------------------->
                    depended on by      @nextrush/adapter-{node,bun,deno,edge,serverless}
                    used alongside      @nextrush/adapters/conformance (parity tests)
```

- **Depends on:** [`@nextrush/types`](../types) (the `Runtime` / `RuntimeCapabilities` / `BodySource` contracts) and [`@nextrush/errors`](../errors) (the `NextRushError` base for `ServerStartError`).
- **Depended on by:** the platform adapters — [`adapter-node`](../adapters/node), [`adapter-bun`](../adapters/bun), [`adapter-deno`](../adapters/deno), [`adapter-edge`](../adapters/edge), and `adapter-serverless` — which build their request/response handling on these primitives.
- **Usually used next:** an adapter — you rarely use `@nextrush/runtime` without one.
- **Alternative:** none — this is the framework's cross-runtime layer.

## Architecture

Maintaining or contributing to this package? The internal design — how detection is cached, why
capability decisions are separated from runtime identity, how the Fetch-API primitives keep the
four adapters in parity, the invariants, and the trade-offs (with diagrams) — is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history: the cross-runtime capability-negotiation
contract (RFC/ADR-R6) and the adapter-parity audit fixes (F-08, F-11, F-15, F-16, R-2..R-10).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
