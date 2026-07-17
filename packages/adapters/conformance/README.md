# @nextrush/adapter-conformance

Cross-adapter behavioral conformance — asserts identical observable behavior across
the Node, Bun, Deno, and Edge adapters. Not published.

## Two layers

1. **Node/vitest suite** (`src/__tests__/`) — runs every adapter's *handler* (the
   runtime-neutral seam) under Node via `describe.each(drivers)`. Fast, runs in the
   normal test suite: `pnpm --filter @nextrush/adapter-conformance test`.
2. **Real-runtime runners** — run the adapters on their *actual* runtimes, not
   simulated under Node. This is what makes "edge-ready" proven rather than asserted
   (openspec `harden-runtime-edge-serverless`, task group 3).

## Real-runtime runners

### Bun (`bun-runner/`) — verified locally, runs in CI

Runs the Bun adapter under real Bun, through a real `Bun.serve()` server hit over
the network (not a bare in-process handler call — Bun's fetch handler receives a
live `server` param that only a real server provides; see the runner's header
comment for the Bun-specific bug this distinction caught). Bun resolves the pnpm
workspace's built dist directly, no import map needed:

```bash
pnpm --filter "@nextrush/adapter-bun..." build
cd packages/adapters/conformance/bun-runner
bun test
```

### Deno (`deno-runner/`) — verified locally

Runs the Deno adapter under real Deno. Build the adapter's dist first (the import
map resolves `@nextrush/*` to built dist), then run:

```bash
pnpm --filter "@nextrush/adapter-deno..." build
cd packages/adapters/conformance/deno-runner
deno task conformance          # deno test --no-check ...
```

Type-checking is done in the Node/tsc build; the Deno run proves runtime behavior,
so it uses `--no-check`.

### workerd (`workerd-runner/`) — runs in CI

Bundles the worker entry (edge adapter + app) with esbuild and loads it into a real
`workerd` isolate via miniflare, then dispatches requests. Requires `miniflare` +
`esbuild`:

```bash
pnpm --filter "@nextrush/adapter-edge..." build
cd packages/adapters/conformance/workerd-runner
node --test conformance.workerd.test.mjs
```

## CI

`.github/workflows/runtime-conformance.yml` runs all three as separate jobs
(`bun-conformance`, `deno-conformance`, `workerd-conformance`) on pinned runtime
versions, so a regression in one adapter fails only that runtime's job.

## Local reproduction with `act`

Run the CI jobs locally against the same images (requires Docker + [`act`](https://github.com/nektos/act)):

```bash
act -j bun-conformance
act -j deno-conformance
act -j workerd-conformance
```

Pin runtime versions in the workflow (Bun `1.3.14`, Deno `v2.6.3`, miniflare `@4`,
compat date `2024-11-01`); bump deliberately, reproducing with `act` before pushing.

## Serverless target (task group 8)

`serverlessDriver` runs the same request/response assertions through
`createLambdaHandler` (the real Tier-1 handler), converting each `DispatchInit`
into an API Gateway v2 event and normalizing the platform result back. The
serverless adapter reuses the edge execution engine, so it passes parity with
node/bun/deno/edge; two behaviors are encoded as capability flags rather than
skipped:

- `teardownOnShutdown: false` — a serverless invocation has no server lifetime,
  so extension `destroy()` never runs (F-14, same as edge).
- `transportAbortFiresSignal: false` — the platform delivers a fully-buffered
  event, so there is no mid-request transport abort; cancellation is
  timeout-driven (#13), where `ctx.signal` still fires (proven by the driver's
  `timeoutResult()`).

**Real-runtime note (8.3):** the serverless adapter's deployment runtime is
**Node** (AWS Lambda / GCF / Azure Functions are Node runtimes), so its
conformance target runs under Node/vitest — that *is* its real runtime. It is
not an edge/Deno runtime, so running the serverless target under `workerd`/Deno
is not applicable; the Web-standard fetch engine it reuses is separately proven
under real Deno and `workerd` by the `deno-runner/` and `workerd-runner/` suites.
