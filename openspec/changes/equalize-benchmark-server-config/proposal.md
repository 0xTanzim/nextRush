# Equalize benchmark server configuration

## Why

A fairness audit of `apps/benchmark`'s six servers found three asymmetries that the harness's own
fairness guarantees claim not to exist. The report states "**Identical runtime config** — same Node
flags, `NODE_ENV=production`, and payloads everywhere" and validates bodies/status/headers via
`bench:validate` — but nothing checks *server construction*, so all three passed unnoticed. Two of
the three flatter NextRush, which makes them a reputational liability, not just a measurement bug.

### A-1: Fastify is the only server using `async` handlers (costs Fastify ~7.1%)

Every other server's like-for-like handlers are synchronous:

| Server | `hello-world` handler | Shape |
| --- | --- | --- |
| nextrush | `(ctx) => ctx.json(HELLO_WORLD)` | sync |
| hono | `(c) => jsonRes(c, HELLO_WORLD)` | sync |
| express | `res.json(HELLO_WORLD)` | sync |
| koa | `ctx.body = HELLO_WORLD` | sync |
| raw-node | `sendJson(res, 200, HELLO_WORLD)` | sync |
| **fastify** | `async () => HELLO_WORLD` | **async — alone** |

An `async` handler allocates a promise plus an async state machine per request. Fastify accepts a
synchronous handler that returns a value, so this is an avoidable handicap on one competitor.
Measured pinned (server cores 0-3, client 4-7), interleaved, 3 rounds, `hello-world` @128c:

| Round | async (current) | sync (fair) |
| --- | --- | --- |
| 1 | 19,993 | 21,457 |
| 2 | 24,887 | 26,175 |
| 3 | 24,335 | 26,503 |
| **mean** | **23,072** | **24,711 (+7.1%)** |

Sync won 3/3. This is the only asymmetry large enough to change the published ranking between
Fastify and NextRush.

### A-2: NextRush listens with a 2× deeper accept queue than every competitor (helps NextRush ~1.2%)

`ss -tln` Send-Q (the listen backlog) per server:

```
raw-node 511   fastify 511   hono 511   koa 511   express 511
nextrush-v3 1024   ← the only one
```

`packages/adapters/node/src/adapter.ts`'s `DEFAULT_LISTEN_BACKLOG = 1024` is a deliberate,
documented framework default and stays as-is — a real NextRush deployment does get 1024, and that
is a legitimate framework property. The defect is purely that the *benchmark* compares it against
five servers left on Node's 511 default while claiming identical runtime config, and never prints
the value. Measured on Fastify @512c, pinned, 3 rounds: +0.4% / +1.8% / +1.4% → **+1.2%, consistent
3/3 but small**. Real and must be equalized and disclosed; not responsible for the rankings.

This is also the report's own still-open "accept-queue theory" item, now measured.

### A-3: residual per-request static-serving cost is not evenly distributed

After `fix(benchmark): scope static serving`, static-file work is off the shared request path for
nextrush (router route), fastify (route table) and koa (router route), but hono
(`app.use('/static/*', …)`) and express (`app.use('/static', …)`) still evaluate a per-request
mount/path check on every unrelated request. Each is that framework's own idiom, but NextRush's
wiring was optimized first and the others audited afterward — the ordering that produces bias even
with honest intent. Koa additionally carries a `router.allowedMethods()` layer no other server has.

## What Changes

- **Fastify handlers become synchronous** for every scenario where the other five servers are
  synchronous. `async` is retained only where the handler genuinely awaits (e.g. reading a body).
- **Backlog is set explicitly to 1024 on all six servers**, equalizing upward to the value NextRush
  ships rather than down to Node's default, per the decision that 1024 is the intended modern
  default. `raw-node`, `express`, `koa`, `hono` and `fastify` each gain an explicit backlog argument.
- **Residual middleware-layer asymmetries are reduced** where each framework permits it, and any
  irreducible remainder is documented per-server rather than left implicit.
- **The report gains a per-server configuration table** printing backlog and handler style, and
  `validate-parity.js` gains a **fairness assertion that fails the run when servers disagree on
  backlog** — the same treatment the existing `Content-Length` framing check already gets.
- **Saturation and GC are measured and reported**, answering two open questions directly: whether
  the servers are actually CPU-saturated at the tested concurrency (the report already requires a
  saturation check before any c128+ number may back a conclusion), and whether GC is a factor.

## Non-Goals

- **Not** changing `DEFAULT_LISTEN_BACKLOG` in `@nextrush/adapter-node`. The framework default is
  ratified and stays; only the benchmark's comparison is equalized.
- **Not** making all servers async instead of sync. Sync matches five of six and is the cheaper,
  more representative shape for a handler that does no I/O.
- **Not** rewriting the `middleware-stack` or `error-handling` scenarios. They are already tagged
  ⚠️ idiomatic and excluded from the headline score; making them mechanically identical would
  misrepresent how each framework is actually used.
- **Not** claiming an improvement for NextRush. This change is expected to make NextRush's relative
  position **worse**, and that outcome ships as measured.

## Impact

- `apps/benchmark/servers/*.js` (all six), `apps/benchmark/scripts/validate-parity.js`,
  the report generator, and `reports/investigations/performance-investigation-reconciliation.md`.
- No framework package changes. No public API change.
- Published rankings will move. Any prior NextRush-vs-Fastify claim derived from the affected runs
  is withdrawn until re-measured under this change.
