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

`.github/workflows/runtime-conformance.yml` runs both as separate jobs
(`deno-conformance`, `workerd-conformance`) on pinned runtime versions, so a
regression in one adapter fails only that runtime's job.

## Local reproduction with `act`

Run the CI jobs locally against the same images (requires Docker + [`act`](https://github.com/nektos/act)):

```bash
act -j deno-conformance
act -j workerd-conformance
```

Pin runtime versions in the workflow (Deno `v2.6.3`, miniflare `@4`, compat date
`2024-11-01`); bump deliberately, reproducing with `act` before pushing.
