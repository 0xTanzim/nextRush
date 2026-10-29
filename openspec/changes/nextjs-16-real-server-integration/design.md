# Design

## Context

See `proposal.md` — Why. Planning inspection searched `/tmp` first and `/playground` second for an
existing reproduction: `/tmp` contains only prior-session drafts (`draft-proposal.md`,
`onerror-probe.ts`, archive notes) and `/playground` is empty, so this harness starts from the
documented contract rather than an existing failure artifact. Current evidence for the Next.js
bridge is an in-process conformance driver and three `next build` fixtures. The pinned Next 16 fixture
(`packages/adapters/conformance/deploy-verification/nextjs-app-16`) already exports all seven
methods through `handle(app)`, but serves only `GET /api/hello`. `bodyParser()` is opt-in, so a
JSON CRUD surface must register it explicitly.

## Goals / Non-Goals

**Goals:**
- One real-server harness that proves the documented Next.js App Router contract over HTTP on
  Next 16.4.2, and doubles as the reproduction bed for any adapter defect.
- Fixture code small enough to audit: one data module, one app factory, one catch-all route.

**Non-Goals:**
- No durable persistence, auth, or CRUD surface beyond the conference-room matrix.
- No Next 14/15 runs in this change; the harness is written so those versions can add their own
  fixture copy later.
- No CI wiring in this change; the harness runs through a package script and its output is
  recorded as evidence.

## Decisions

### 1. Reuse the existing Next 16 fixture, add a single catch-all route module

The rooms API lives in one `app/api/rooms/[[...route]]/route.ts` module exporting the seven
methods from one `handle(app)`, with the app mounted at `/api` and the rooms router declaring
`/rooms` and `/rooms/:id`. The fixture-local data module is imported only by that module.

**Why:** Next compiles each route module as a separate bundle. Two route files
(`app/api/rooms/route.ts` and `app/api/rooms/[id]/route.ts`) would each instantiate the data
module, so state written by POST would not be visible to GET-by-id. One catch-all keeps a single
module graph — and therefore one array — per server process. Rejected: a second fixture app
(duplicates the pinned build matrix) and two route files with a `globalThis` singleton (hidden
global state, exactly what the fixture must not teach).

### 2. Register `bodyParser()` explicitly and assert its real error envelope

The app registers `bodyParser()` and routes read `ctx.body`. Malformed JSON and wrong content
types are asserted through the parser's documented error codes and statuses rather than by
calling `request.json()` in the fixture.

**Why:** The probe must exercise the framework's parsing contract, not bypass it. A fixture that
calls `ctx.req.json()` would hide exactly the body-path defects this change is looking for.

### 3. Validation is a small pure module, no new dependency

A `validateRoomInput` (create) and `validateRoomPatch` (partial) return a discriminated result;
route handlers map the result to 201/200/400 and never throw. IDs are generated with
`crypto.randomUUID()`.

**Why:** Keeps the fixture dependency-free and the HTTP contract explicit. A schema library would
add a dependency to prove something the fixture is not about.

### 4. Harness: `node:test` + global `fetch`, spawning the production server

A Node test file binds a temporary `node:net` server to obtain a free port, spawns
`next start -p <port>` from the fixture directory, polls `GET /api/rooms` until ready or a
deadline expires, runs the request matrix, and kills the child with `SIGTERM` in `after`. The
package script builds first (`next build && node --test test/integration.test.mjs`) so a stale
`.next` cannot produce a false pass.

**Why:** Node's built-in test runner and `fetch` add no dependency and match the existing
`workerd-runner` precedent. Rejected: `next-test-api-route-handler`, `supertest`, and Playwright —
each adds a dependency and the first two are in-process, which is the gap being closed.

### 5. Isolation by unique identifiers, not a reset endpoint

Each test creates its own room with a unique ID and deletes it. One dedicated test asserts
sequential state persistence (create → GET → PATCH → GET → DELETE → GET 404) on its own record.

**Why:** No test-only reset route leaks into the fixture's production build. The server is started
once per suite, so ordering independence comes from unique IDs, not from run order.

### 6. Contract asserted (to be confirmed against observed behavior)

- `GET /api/rooms` → 200, JSON array; `GET /api/rooms/:id` → 200 or 404.
- `POST /api/rooms` → 201 with the created record; malformed/invalid body → 400.
- `PUT /api/rooms/:id` → 200 replaced record; unknown id → 404; invalid body → 400.
- `PATCH /api/rooms/:id` → 200 patched record, unspecified fields untouched; unknown id → 404.
- `DELETE /api/rooms/:id` → 204 with no body; unknown id → 404.
- Unsupported method → 405 with `Allow`; `OPTIONS` → 200 with `Allow`.
- `HEAD /api/rooms` → GET headers, no body.
- Malformed JSON → the parser's documented `400` envelope, not 500.

Any observed deviation is classified before a fix: Next behavior (e.g. TRACE handled before the
adapter), adapter/engine behavior, router dispatch, parser behavior, or fixture expectation.

## Risks / Trade-offs

- **Route-module state divergence** → single catch-all module, and the sequential test would fail
  immediately if state were split.
- **Production bundles vs dev server differ** → harness always builds and runs `next start`.
- **Port races** → port obtained from a bound-then-closed socket, with one retry on `EADDRINUSE`.
- **Slow readiness** → poll with a deadline; failure prints the child's stderr, never a bare timeout.
- **Build cost on every run** (~20–40 s) → acceptable for a probe; the script is not wired into the
  default `pnpm test` in this change.
- **A real defect may be in Next itself** → report as a limitation with the exact version; do not
  patch around it or weaken the assertion.
- **In-memory storage is per process** → documented in the fixture; not a multi-instance claim.
