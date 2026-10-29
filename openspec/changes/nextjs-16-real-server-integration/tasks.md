# Tasks

## 1. Baseline reproduction before fixture changes

- [x] 1.1 Record the planning inspection: `/tmp` first, `/playground` second; note that no existing Next.js 16 reproduction was found (only prior-session drafts) and preserve every file inspected. Verify the note names the paths searched and states that nothing was modified or deleted.
- [x] 1.2 With the fixture unchanged, run `pnpm --filter nextjs-app-16 build`, start `next start` on a free port, and probe the existing surface over HTTP: `GET /api/hello` (direct form), `GET /destructured/hello`, `HEAD /api/hello`, `OPTIONS /api/hello`, and a `POST /api/hello` with a JSON body. Record exact status, `Allow` header, and body. Verify each result is captured verbatim as the pre-change baseline.

## 2. Conference-room fixture

- [x] 2.1 Add a fixture-local `lib/rooms.ts` holding the `ConferenceRoom` type, the seeded Atlas/Orion array, and CRUD helpers keyed by `crypto.randomUUID()`. Verify it exports only types and functions, imports no framework code, and states in a header comment that the array is process-local test storage, not durable persistence.
- [x] 2.2 Add a dependency-free `lib/validate.ts` with `validateRoomInput` (full create body) and `validateRoomPatch` (partial body), returning a discriminated result and never throwing. Verify with `node --test` or the harness cases that missing, wrong-type, empty-string, and negative-capacity inputs are rejected while a valid body passes.
- [x] 2.3 Add `app/api/rooms/[[...route]]/route.ts`: one `createApp()` with `bodyParser()` registered, a rooms router declaring `/rooms` and `/rooms/:id`, mounted at `/api`, exporting all seven methods from one `handle(app)` call. Verify `next build` type-checks the route and the app factory is shared by no other module.
- [x] 2.4 Document in `packages/adapters/conformance/deploy-verification/README.md` that `nextjs-app-16` now serves the rooms API, that the data is in-memory and per process, and the command that runs the real-server proof. Verify the documented command matches `package.json`.

## 3. Real-server HTTP harness (RED against the documented contract)

- [x] 3.1 Add `test/integration.test.mjs` using `node:test`: acquire a free port via `node:net`, spawn `next start -p <port>` from the fixture, poll `GET /api/rooms` until ready or a deadline, capture child stderr, and `SIGTERM` the child in `after`. Verify a deliberately wrong port or missing build fails with a readable diagnostic, not a hang.
- [x] 3.2 Add the happy-path matrix: list, get by id, create (201), replace (PUT), partial update (PATCH leaves unspecified fields intact), delete (204 with empty body), and unknown id 404 for GET/PUT/PATCH/DELETE. Use unique IDs per test and clean up. Verify every case asserts status, content type, and parsed body.
- [x] 3.3 Add the failure matrix: malformed JSON, missing field, wrong field type, wrong content type, unsupported method (405 with `Allow`), `OPTIONS` (200 with `Allow`), and `HEAD` (GET headers, empty body). Verify each asserts the actual status and error envelope rather than only "not 500".
- [x] 3.4 Add the sequential-state test: POST → GET → PATCH → GET → DELETE → GET 404 through the running server, asserting each step observes the prior state. Verify the test fails if the two paths were served by different module instances.
- [x] 3.5 Add the package script `test:integration` (`next build && node --test test/integration.test.mjs`) and run it. Record every failure verbatim — status, headers, body — before changing any non-fixture code. Verify the run produces a complete pass/fail table.

## 4. Root-cause classification and regression

- [x] 4.1 Classify each failure from 3.5 against the owning layer: Next integration, adapter dispatch (`packages/adapters/nextjs`), router params/405 (`packages/router`), body parsing (`packages/middleware/body-parser`), response construction (`packages/core`), or fixture/test expectation. Verify each classification cites the file and code path or explicitly clears the layer.
- [x] 4.2 For every confirmed defect, add a failing package-level regression test (RED) that reproduces it without the fixture, run it, and confirm it fails for the stated reason. Verify the failure is not an artifact of the fixture or of missing `bodyParser()` registration.
- [x] 4.3 Fix each confirmed defect at the classified layer with the smallest change; rerun the regression test (GREEN) and the full real-server matrix. Verify no public API, dependency, or unrelated adapter changed, and that a defect belonging to Next itself is documented as a limitation instead of patched around.
- [x] 4.4 If no defect is confirmed, record the negative result with the exact matrix output and make no production-code change. Verify `git diff` contains only fixture, harness, and documentation files.

## 5. Verification gates

- [x] 5.1 Run `pnpm --filter nextjs-app-16 build` and confirm the Next 16.4.2 production build succeeds with no type error.
- [x] 5.2 Run the real-server suite from a clean `.next` (`pnpm --filter nextjs-app-16 test:integration`) and record the final pass count and any documented limitations.
- [x] 5.3 Run `pnpm --filter @nextrush/adapter-nextjs exec vitest run --coverage` and confirm all tests pass with line coverage at or above 90%.
- [x] 5.4 Run the cross-adapter conformance suite (`pnpm --filter @nextrush/adapter-conformance test`) and, if adapter or runtime code changed, the Bun/Deno/workerd runners; confirm zero regressions.
- [x] 5.5 Run typecheck and lint for every touched package and confirm zero new errors or warnings.
- [x] 5.6 If a spec delta changed, run `openspec validate nextjs-16-real-server-integration --strict` and confirm it passes with no new long-requirement warning.

## 6. Reporting and follow-up

- [x] 6.1 Update the proof-level documentation (certification/report surface and the deploy-verification README) so in-process, build-only, and real-server results are reported separately per the new `runtime-proof-harness` requirement. Verify no existing build-only fixture is described as integration proof.
- [x] 6.2 Produce the final report: reproduction commands, observed vs expected results, root cause with file/line, fix and layer, regression proof, verification commands and results, remaining issues, and git status. Verify it distinguishes confirmed defects from expected Next.js behavior.

## Workflow follow-up

- Archive this change only after 6.2 is committed and any behavior-changing fix has its `web-adapters` (or owning capability) delta synced.
- Extend the harness to Next.js 14 and 15 as a separate follow-up change once the 16 harness is green.
- Decide separately whether `test:integration` becomes a per-PR CI gate; this change only provides the script.
