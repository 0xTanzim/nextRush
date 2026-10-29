# Proposal

## Why

The Next.js App Router bridge is proven in-process and at build time only. The conformance
`nextjs` driver calls `handle()` directly with synthetic `Request` objects
(`transport: 'in-process'`), and the `nextjs-app-{14,15,16}` fixtures run `next build` without
ever starting a server. So nothing exercises what Next actually does to a request before the
adapter sees it — path normalization, method routing, body streaming, `HEAD` body stripping,
405/OPTIONS handling — on a real Next.js 16 server. `report/performance/performance-reality-check.md`
already records this as "app-level verification: none".

## What Changes

- Add a conference-room CRUD API to the existing pinned Next.js 16 fixture
  (`packages/adapters/conformance/deploy-verification/nextjs-app-16`), backed by a fixture-local
  in-memory module shared within one server process. Test-only storage; not durable or distributed.
- Add a real-server harness that builds the fixture, starts `next start` on an ephemeral port, and
  drives the API over HTTP with `node:test`: GET/POST/PUT/PATCH/DELETE, dynamic params, 404s,
  malformed and invalid JSON, unsupported methods, and sequential state.
- Reproduce first, then classify each failure against the owning layer: Next integration, adapter
  dispatch, body parsing, routing/params, response construction, or fixture/test isolation.
- Fix only confirmed defects, at the owning layer, each with a regression test that fails before
  the fix. If nothing fails, report that with evidence and ship the harness alone.
- Keep the change scoped to Next.js 16; the 14/15 matrix is planned after the harness is green.

No public API, dependency, or breaking change. If a confirmed defect changes adapter-observable
behavior, its requirement update lands in `web-adapters` through `/opsx:update` before archive.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-proof-harness`: add the requirement that the Next.js App Router bridge is proven
  through a real `next build` + `next start` server, not only in-process request construction,
  with per-scenario proof-level reporting.

## Impact

- `packages/adapters/conformance/deploy-verification/nextjs-app-16/`: new `app/api/rooms/**`
  route modules, a fixture-local rooms data module, a shared app factory, and a real-server test.
- The fixture's `package.json` scripts (build/start/test) and `packages/adapters/conformance/deploy-verification/README.md`.
- If a defect is confirmed: the smallest fix in `packages/adapters/nextjs`, `packages/router`,
  `packages/middleware/body-parser`, or `packages/core`, plus its regression test and the
  corresponding `web-adapters` (or owning capability) delta.
- No new dependency is expected; a raw `node:test` + `fetch` harness keeps the tree unchanged.
- Durable decision: if the probe changes documented Next.js support or adapter behavior, record it
  in `docs/RFC/runtime-adapters/049-nextjs-callable-handler.md` (or a successor RFC) before archive.
