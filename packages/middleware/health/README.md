# @nextrush/health

> Liveness and readiness health check endpoints for orchestrator probes — Kubernetes, PM2, systemd, Docker.

**Support tier:** Public — middleware/registrar (stable). See [ADR-0005](../../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## The Problem

Running a Node.js service in an orchestrator without a standard health contract creates real
operational risk:

**No signal to distinguish "alive" from "ready."** Without a liveness/readiness split, an
orchestrator either restarts pods for transient dependency outages it shouldn't (a slow DB isn't
a reason to kill the process) or keeps routing traffic to a pod that can't serve it.

**A hung dependency check can hang the whole probe.** A readiness check that pings a database
with no timeout can leave `/readyz` hanging indefinitely if that database is unreachable —
exactly the outage scenario the probe exists to detect.

**Ad-hoc health routes drift from orchestrator conventions.** Every team reinvents its own
`/health` shape, and it rarely matches what Kubernetes, PM2, or systemd actually expect.

## What NextRush Does Differently

- **Standard liveness/readiness separation** — `/livez` reflects only whether the process can
  respond at all; `/readyz` reflects whether registered checks currently pass. Conflating them
  causes unnecessary pod restarts for transient outages.
- **Bounded check execution** — every registered check runs under a configurable timeout. A
  hung check is treated as a failure, never an indefinite hang.
- **Sync and async checks** — a check may return `boolean` directly or `Promise<boolean>`; a
  trivially synchronous check doesn't need a manual `Promise.resolve()` wrapper.
- **One clear registration API** — `registerCheck(name, check)`, nothing more configurable than
  that until a real need for it is demonstrated.

## Runtime Support

**Edge-safe.** Zero `node:` imports — probes are user-supplied functions run under a
`Promise.race` timeout. Safe on Node, Bun, Deno, Cloudflare Workers, Vercel Edge, and Netlify Edge
(portability of what a registered check itself pings — e.g. a database client — depends on that
client's own runtime support).

## Installation

```bash
pnpm add @nextrush/health
```

## Quick Start

```typescript
import { createApp, listen } from 'nextrush';
import { health } from '@nextrush/health';

const app = createApp();
const { middleware, registerCheck } = health();

app.use(middleware);

registerCheck('database', async () => {
  await db.ping();
  return true;
});

registerCheck('cache', () => cache.isConnected());

listen(app, 8080);
```

```
GET /livez  → 200 { "status": "ok" }
GET /readyz → 200 { "status": "ok", "checks": { "database": true, "cache": true } }
```

If `database`'s check fails, throws, or times out:

```
GET /readyz → 503 { "status": "error", "checks": { "database": false, "cache": true } }
```

`/livez` is unaffected — it stays `200` regardless of what any registered check reports.

## Security Posture — Read Before Deploying

**`/livez` and `/readyz` are unauthenticated by default, and this is intentional.** This matches
the standard Kubernetes convention: liveness and readiness probes are conventionally
cluster-internal endpoints, called by the orchestrator's kubelet/health-check agent, not by
external clients. Requiring authentication on these endpoints is unusual and typically
counterproductive — an orchestrator's probe mechanism generally can't supply credentials, so
adding auth here is more likely to cause a false-negative outage (the probe itself gets
rejected) than to stop a real attacker.

**If your deployment needs to restrict access to these endpoints, do it at the network layer,
not the application layer:**

- **Kubernetes** — probes are called from the kubelet on the same node; a `NetworkPolicy`
  restricting ingress to cluster-internal sources is the standard control, not
  application-level auth.
- **Any other orchestrator/reverse proxy** — block `/livez` and `/readyz` at the load
  balancer/ingress/firewall so they're only reachable from inside the cluster or from the
  orchestrator's own health-check mechanism, and never exposed on your public listener.

**What these endpoints intentionally do *not* leak:** the JSON body reports pass/fail per check
name (e.g. `"database": false`) but never the underlying error, stack trace, connection string,
or any other check-internal detail — a failed check is opaque beyond its boolean outcome, both
by design and because a thrown error inside a check is caught and converted to `false` before it
ever reaches the response.

If you mount this middleware behind an authentication layer by mistake, your orchestrator's
probes will fail and it will believe your pods are unhealthy — this is the most common
misconfiguration for this kind of package. Mount `health()`'s middleware early, before any
auth middleware in your stack, or route around auth entirely for these two paths.

## API

### `health(options?)`

Creates the health middleware and its check registry.

```typescript
const { middleware, registerCheck } = health({
  livezPath: '/livez',      // default
  readyzPath: '/readyz',    // default
  checkTimeoutMs: 5000,     // default
});
```

| Option           | Type     | Default    | Description                                        |
| ---------------- | -------- | ---------- | --------------------------------------------------- |
| `livezPath`      | `string` | `/livez`   | Path for the liveness endpoint.                      |
| `readyzPath`     | `string` | `/readyz`  | Path for the readiness endpoint.                     |
| `checkTimeoutMs` | `number` | `5000`     | Max time a single check may take before it's treated as failing. |

Returns `{ middleware, registerCheck }`:

- **`middleware`** — mount with `app.use(middleware)`. Handles `livezPath`/`readyzPath`
  directly; every other path passes through to `next()` untouched.
- **`registerCheck(name, check)`** — registers a readiness check under `name`. Only affects
  `/readyz`; `/livez` never depends on registered checks. Registering a second check under an
  already-used name replaces the first.

### Check functions

```typescript
type CheckFn = () => boolean | Promise<boolean>;
```

A check returning `false`, throwing, or exceeding `checkTimeoutMs` all count as a failure for
that check.

```typescript
// Sync — no Promise wrapper needed
registerCheck('feature-flag', () => Boolean(process.env.FEATURE_ENABLED));

// Async
registerCheck('database', async () => {
  const result = await db.query('SELECT 1');
  return result.rowCount === 1;
});
```

## Integrating with graceful shutdown

`@nextrush/health` has no code dependency on `@nextrush/adapter-node`'s `gracefulShutdown`
option — either can be used entirely on its own. But together, a registered check can make
`/readyz` flip to `503` the moment a shutdown drain begins, not only once it completes, which is
what actually helps a load balancer stop routing new traffic promptly during a rollout.

`gracefulShutdown`'s own signal handler doesn't expose a "drain started" callback today, so wire
the shared flag from your own signal listener registered alongside it — same signals, run before
`server.close()` starts draining:

```typescript
import { serve } from '@nextrush/adapter-node';
import { health } from '@nextrush/health';

let isDraining = false;

const { middleware, registerCheck } = health();
registerCheck('draining', () => !isDraining);

app.use(middleware);

const server = await serve(app, {
  gracefulShutdown: { signals: ['SIGTERM', 'SIGINT'] },
});

// Runs alongside gracefulShutdown's own handler — both listen for the same
// signal, and Node invokes every registered listener for a signal in
// registration order. This one only flips the flag; `close()` (installed by
// `gracefulShutdown`) still owns the actual drain.
process.on('SIGTERM', () => {
  isDraining = true;
});
process.on('SIGINT', () => {
  isDraining = true;
});
```

This is an integration you wire yourself with a shared flag — there is no hard import between
the two packages, so `@nextrush/health` works standalone for anyone not using
`gracefulShutdown` at all.

## Limitations

- Checks run concurrently on every `/readyz` request — there is no caching layer. An expensive
  check (e.g. a real DB round-trip) runs on every probe interval. If check cost becomes a
  problem, add your own caching inside the check function itself; this package does not do it
  for you.
- No rate limiting on the endpoints themselves — orchestrator probe intervals are typically low
  enough (seconds, not requests/second) that this hasn't been a problem in practice. Public-
  facing rate limiting, if you have any need for it here, belongs at the network layer per the
  Security Posture section above.
