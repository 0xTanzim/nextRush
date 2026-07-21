# @nextrush/health

> Liveness and readiness health check endpoints for NextRush -- /livez and /readyz for orchestrator probes (Kubernetes, PM2, systemd, Docker).

[![npm version](https://img.shields.io/npm/v/@nextrush/health.svg)](https://www.npmjs.com/package/@nextrush/health)
[![downloads](https://img.shields.io/npm/dm/@nextrush/health.svg)](https://www.npmjs.com/package/@nextrush/health)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/health.svg)](https://bundlephobia.com/package/@nextrush/health)
[![types](https://img.shields.io/npm/types/@nextrush/health.svg)](https://www.npmjs.com/package/@nextrush/health)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/health.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Serve `/livez` and `/readyz` endpoints an orchestrator can probe, backed by a registry of bounded-timeout readiness checks |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports; checks are user-supplied functions run under `Promise.race`) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- `/livez` never evaluates registered checks and always reports `200`; `/readyz` recomputes readiness fresh on every request from whichever checks are currently registered -- there is no cached or persisted health state anywhere in this package

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Running a service in an orchestrator without a standard health contract creates real operational risk. Without a liveness/readiness split, an orchestrator either restarts the process for a transient dependency outage it shouldn't (a slow database isn't a reason to kill a healthy process) or keeps routing traffic to an instance that can't actually serve it. And a readiness check that pings a database with no timeout can leave the whole probe hanging indefinitely -- exactly the outage scenario the probe exists to detect.

```ts
// TODAY, without this package -- looks fine, has a real gap:
app.get('/health', async (ctx) => {
  const dbOk = await db.ping();
  // If db.ping() never resolves (network partition, hung connection pool),
  // this handler -- and the orchestrator probe calling it -- hangs forever.
  // There's also no distinction here between "process is alive" and
  // "dependencies are ready," so a slow DB looks identical to a dead process.
  ctx.json({ ok: dbOk });
});
```

## When to use

**Use `@nextrush/health` if:**

- You're deploying to Kubernetes, PM2, systemd, Docker, or any orchestrator that expects a liveness/readiness probe contract
- You want a registered dependency check bounded by a timeout, so a hung database/cache/queue can never make a probe hang indefinitely
- You want liveness and readiness reported on genuinely separate endpoints, so a dependency outage doesn't trigger an unnecessary process restart

**Reach for something else if:**

- You need detailed observability/metrics beyond pass/fail per check -- this package intentionally reports only a boolean per check, never the underlying error or timing (see [Security posture](#security-posture-read-before-deploying))
- You need the endpoints authenticated -- see [Security posture](#security-posture-read-before-deploying) for why that's deliberately not this package's job

---

## Installation

```bash
pnpm add @nextrush/health
# npm i @nextrush/health . yarn add @nextrush/health . bun add @nextrush/health
```

> [!NOTE]
> `@nextrush/health` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { health } from '@nextrush/health';

const app = createApp();
const { middleware, registerCheck } = health();

app.use(middleware);

registerCheck('database', async () => {
  await db.ping();
  return true;
});

listen(app, 8080);
```

`GET /livez` now always returns `200 { "status": "ok" }`. `GET /readyz` runs every registered check (here, just `database`) fresh on that request and returns `200` if all pass, `503` with a per-check breakdown if any fail, throw, or time out.

## Capabilities

**Liveness (`/livez`)**
- Always returns `200 { "status": "ok" }` for any request that reaches this path -- it does not evaluate any registered check, ever; it only reflects that the middleware itself ran, i.e. the process can respond at all

**Readiness (`/readyz`)**
- Runs every currently registered check concurrently (`Promise.all` over the check map) on every request -- there is no caching layer, so an expensive check runs on every probe interval
- Each check is individually bounded by `checkTimeoutMs` (default 5000ms) via `Promise.race` against a timer -- a check that never settles is treated as failed, never left to hang the response
- A check that throws is caught and treated as failed -- the thrown error/stack trace never reaches the response body
- Returns `200 { "status": "ok", "checks": {...} }` if every check passed, `503 { "status": "error", "checks": {...} }` if any failed

**Check functions**
- A check may return `boolean` directly or `Promise<boolean>` -- a trivially synchronous check (e.g. "is this env var set") doesn't need a manual `Promise.resolve()` wrapper
- `registerCheck(name, check)` registering a second check under an already-used name replaces the first, rather than adding a duplicate

**Path handling**
- The returned `middleware` only intercepts exact matches on `livezPath`/`readyzPath` (default `/livez`/`/readyz`); every other path calls `next()` untouched

## Mental model

`health()` returns a middleware and a `registerCheck` function that share one in-memory `Map` -- there is no persisted or cached health status anywhere; every `/readyz` request re-runs every currently registered check from scratch.

```text
GET /livez  --> middleware --> 200 { status: "ok" }                          (never touches checks)

GET /readyz --> middleware --> run every registered check, concurrently, each under checkTimeoutMs
                                        |                       |
                                   all pass                one or more fail/throw/time out
                                        |                       |
                              200 { status: "ok", checks }   503 { status: "error", checks }
```

**Rule:** "readiness" is not a stored state this package tracks between requests -- it is recomputed, from the current set of registered checks, on every single `/readyz` request. Registering or removing a check between two requests changes what the very next `/readyz` call evaluates, with nothing to invalidate.

> [!TIP]
> The full per-check timeout-race sequence, and why there's no persisted state to diagram as a
> state machine, are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Basic liveness + readiness

```ts
import { health } from '@nextrush/health';

const { middleware, registerCheck } = health();
app.use(middleware);

registerCheck('database', async () => {
  await db.ping();
  return true;
});

registerCheck('cache', () => cache.isConnected());
```

### Custom paths and check timeout

```ts
const { middleware, registerCheck } = health({
  livezPath: '/health/live',
  readyzPath: '/health/ready',
  checkTimeoutMs: 2000,
});
```

### A synchronous check with no async work

```ts
registerCheck('feature-flag', () => Boolean(process.env.FEATURE_ENABLED));
```

### Flip readiness during a graceful shutdown drain

```ts
import { serve } from '@nextrush/adapter-node';
import { health } from '@nextrush/health';

let isDraining = false;

const { middleware, registerCheck } = health();
registerCheck('draining', () => !isDraining);
app.use(middleware);

const server = await serve(app, {
  gracefulShutdown: { signals: ['SIGTERM', 'SIGINT'] },
});

// Registered alongside gracefulShutdown's own handler -- Node invokes every
// listener for a signal in registration order; this one only flips the flag.
process.on('SIGTERM', () => { isDraining = true; });
process.on('SIGINT', () => { isDraining = true; });
```

There is no code dependency between `@nextrush/health` and `@nextrush/adapter-node`'s
`gracefulShutdown` -- this is a pattern you wire yourself with a shared flag, not a built-in
integration.

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `health` | `(options?: HealthOptions) => HealthInstance` | 1.0.0 | Stable | Creates the middleware and check registry. Returns `{ middleware, registerCheck }`. |
| `type CheckFn` | `() => boolean \| Promise<boolean>` | 1.0.0 | Stable | The shape of a registered check. |
| `type HealthOptions` | `{ livezPath?, readyzPath?, checkTimeoutMs? }` | 1.0.0 | Stable | Options for `health()`. |
| `type HealthInstance` | `{ middleware: Middleware; registerCheck: (name, check) => void }` | 1.0.0 | Stable | The object returned by `health()`. |
| `type HealthResponseBody` | `{ status: 'ok' \| 'error'; checks?: Record<string, boolean> }` | 1.0.0 | Stable | The JSON body shape for both endpoints (`checks` only present on `/readyz` responses). |
| `DEFAULT_LIVEZ_PATH` / `DEFAULT_READYZ_PATH` | `const string` | 1.0.0 | Stable | `'/livez'` / `'/readyz'`. |
| `DEFAULT_CHECK_TIMEOUT_MS` | `const number` | 1.0.0 | Stable | `5000`. |
| `STATUS_OK` / `STATUS_ERROR` | `const 'ok' \| 'error'` | 1.0.0 | Stable | The two literal status values used in response bodies. |
| `HTTP_OK` / `HTTP_SERVICE_UNAVAILABLE` | `const number` | 1.0.0 | Stable | `200` / `503`. |

## Options

Every default below is read directly from `src/constants.ts` and `src/types.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `livezPath` | `string` | No | `'/livez'` | No | Exact-match path for the liveness endpoint. |
| `readyzPath` | `string` | No | `'/readyz'` | No | Exact-match path for the readiness endpoint. |
| `checkTimeoutMs` | `number` | No | `5000` | No | Per-check bound; exceeding it counts identically to the check returning `false`. Applies independently to each registered check, not to the total `/readyz` request. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js >=22 | Yes | ESM-only |
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- checks run under `Promise.race`/`setTimeout`, both Web-standard; portability of what a *registered check itself* pings (e.g. a database driver) depends on that dependency's own runtime support, not on this package |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** `@nextrush/adapter-node`'s `gracefulShutdown` option, via the shared-flag pattern in [Common tasks](#common-tasks) -- no direct code dependency between the two packages.
- **Incompatible with:** none directly, but see [Security posture](#security-posture-read-before-deploying) -- placing an authentication middleware in front of `/livez`/`/readyz` will make orchestrator probes fail.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Security posture -- read before deploying

**`/livez` and `/readyz` are unauthenticated by default, and this is intentional.** This matches
the standard Kubernetes convention: liveness and readiness probes are conventionally
cluster-internal endpoints, called by the orchestrator's own probe mechanism, not by external
clients. An orchestrator's probe generally can't supply credentials, so adding application-level
auth here is more likely to cause a false-negative outage (the probe itself gets rejected) than
to stop a real attacker.

**If you need to restrict access to these endpoints, do it at the network layer:** a Kubernetes
`NetworkPolicy` restricting ingress to cluster-internal sources, or blocking `/livez`/`/readyz` at
your load balancer/ingress/firewall so they're unreachable from your public listener.

**What the response body never leaks:** per-check pass/fail only -- never the underlying error,
stack trace, or connection details from a failing check. A thrown error inside a check is caught
by `runCheckWithTimeout()` and converted to `false` before it reaches the response, by
construction, not by a separate filtering step that could be bypassed.

> [!WARNING]
> If you mount this middleware behind an authentication layer by mistake, your orchestrator's
> probes will fail and it will believe your instance is unhealthy. Mount `health()`'s middleware
> before any auth middleware in your stack, or route around auth entirely for these two paths.

---

## Troubleshooting

<details>
<summary><strong>The orchestrator reports the pod/instance as unhealthy even though the app is running fine</strong></summary>

**Cause:** most commonly, an authentication or other middleware registered before `health()`'s middleware is intercepting `/livez`/`/readyz` before this package ever sees the request. **Fix:** mount `health()`'s `middleware` earlier in the chain than auth, or explicitly exclude `/livez`/`/readyz` from your auth middleware's scope.

</details>

<details>
<summary><strong>`/readyz` returns `503` and I don't know which check is failing</strong></summary>

**Cause:** this is the intended failure mode -- the `checks` object in the response body names every registered check with its individual pass/fail boolean. **Fix:** read the `checks` field in the `503` response body; it's populated for exactly this purpose. If you need more detail than a boolean (timing, error message), add your own logging inside the check function itself -- this package deliberately doesn't surface that detail in the response (see [Security posture](#security-posture-read-before-deploying)).

</details>

<details>
<summary><strong>A slow but working dependency makes `/readyz` return `503`</strong></summary>

**Cause:** the check exceeded `checkTimeoutMs` (default 5000ms) and was treated as a failure by `Promise.race`, even though it might have eventually succeeded. **Fix:** increase `checkTimeoutMs` if 5 seconds is genuinely too tight for a legitimately slow dependency, or investigate why the dependency is slow -- a check that only just barely passes the timeout is a signal worth acting on, not just raising the limit for.

</details>

## FAQ

**Does `/readyz` cache its result between requests?**
No. Every `/readyz` request re-runs every currently registered check from scratch, concurrently. There is no caching layer in this package -- if a check is expensive, add your own caching inside the check function itself.

**Can `/livez` ever return anything other than `200`?**
Not through this package's own logic -- `respondLive()` unconditionally sets `HTTP_OK` and never evaluates registered checks. It could still fail to respond at all if the process itself is genuinely unresponsive (which is exactly the liveness signal an orchestrator is checking for), but this package never makes `/livez` fail based on check state.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- check execution uses only `Promise.race`/`setTimeout`, available identically on every supported runtime; what a registered check itself pings is a separate concern.

---

## Package relationships

```text
                  depends on            @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/health ------------------->
                  works alongside       @nextrush/adapter-node (gracefulShutdown, via a shared flag)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, types only, erased at build.
- **Works alongside:** `@nextrush/adapter-node`'s `gracefulShutdown` option -- no direct import between the two; the integration is a shared boolean flag you wire yourself, shown in [Common tasks](#common-tasks).
- **Usually mounted early:** before any authentication middleware -- see [Security posture](#security-posture-read-before-deploying).
- **Alternative:** none within NextRush for orchestrator liveness/readiness probes.

## Architecture

Maintaining or contributing to this package? The internal design -- the per-check timeout-race
sequence, why there's no persisted health state, and the decisions and trade-offs behind them
(with diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
