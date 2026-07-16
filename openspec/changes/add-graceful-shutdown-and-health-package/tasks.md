## 1. T010 — Signal-wired graceful shutdown

- [x] 1.1 RED: write a failing integration test in `packages/adapters/node/src/__tests__/` (check
      existing test file naming in that directory first) that starts a real server via
      `serve(app, { gracefulShutdown: true })`, holds an in-flight slow request open, sends
      `process.kill(process.pid, 'SIGTERM')` (or spawns the server in a child process and signals
      it, to avoid killing the test runner itself — decide the safer approach during
      implementation), and asserts the held request completes successfully before the process
      would exit.
      Verified: `graceful-shutdown.integration.test.ts` written, spawning the fixture via `tsx`
      first failed for the right reason (no signal listener existed yet → immediate process
      termination on SIGTERM → dropped connection). Root-caused and switched to spawning plain
      `node` against a pre-built `.mjs` fixture (see 1.4/1.6 notes) — `tsx`'s CLI wrapper relays
      signals over an internal IPC handshake and escalates to SIGKILL if the child doesn't ack
      within its own short race window, incompatible with a real time-bounded drain.
- [x] 1.2 RED: write a failing test asserting that `serve()` called WITHOUT `gracefulShutdown`
      installs no `SIGTERM`/`SIGINT` listener (check `process.listenerCount('SIGTERM')`
      before/after, or equivalent) — the regression guard for the opt-in default.
      Verified: passed trivially before the feature existed (no listener possible either way) —
      correct baseline, not a false positive; re-verified green after GREEN with real behavior.
- [x] 1.3 RED: write a failing test asserting the signal handler is removed after `close()`
      completes (no listener leak across repeated `serve()`/`close()` cycles in one process).
      Verified: failed with `expected +0 to be 1` before GREEN (no listener ever installed) —
      correct RED for the right reason.
- [x] 1.4 Verify RED: run all three, confirm they fail because the feature doesn't exist yet, not
      because of a test-setup mistake.
      Verified: ran via `pnpm --filter @nextrush/adapter-node exec vitest run`. 1.1 failed with
      `fetch failed` / `SocketError: other side closed` (SIGTERM fell through to Node's default
      terminate-on-signal behavior); 1.3 failed with a listener-count mismatch. Both are the
      feature genuinely not existing, not a setup bug.
- [x] 1.5 GREEN: add `gracefulShutdown` to `ServeOptions` in
      `packages/adapters/node/src/adapter.ts`; wire the specified (or default `['SIGTERM',
      'SIGINT']`) signals to the existing `close()` drain logic per design.md D1-D3. Support the
      `{ signals, timeout }` override shape.
      Verified: added `GracefulShutdownOptions` type + `gracefulShutdown` field on `ServeOptions`;
      extracted the existing drain logic into `drainAndClose()` (unchanged behavior) and added
      `buildCloseWithGracefulShutdown()` which installs `process.once(signal, ...)` handlers only
      when the option is truthy, invoking the same `drainAndClose`, removing all handlers once it
      settles (`.finally(removeSignalHandlers)`).
- [x] 1.6 Verify GREEN: run the three new tests — green. Run the full `@nextrush/adapter-node`
      test suite — zero regressions.
      Verified: 6 test files / 86 tests, all passing (`pnpm --filter @nextrush/adapter-node exec
      vitest run`). `tsc --noEmit` and `pnpm lint` both clean. The 1.1 integration test's
      `beforeAll` rebuilds the package via `tsup` before spawning, so the fixture's
      `@nextrush/adapter-node` import always reflects current source, never a stale `dist/`.
- [x] 1.7 Update `packages/adapters/node/README.md` documenting the new option with an example.
      Verified: added a `gracefulShutdown` row to the `ServeOptions` table; rewrote the "Graceful
      Shutdown" section into "Signal-wired (recommended)" (new option, default + override
      examples, opt-in/removal/SIGKILL caveats) and "Manual" (the pre-existing pattern, kept for
      custom coordination); added `GracefulShutdownOptions` to the Exports listing.
- [x] 1.8 REFACTOR: confirm no duplicated drain-logic exists between the signal path and the
      already-existing manual `close()` call path — the signal handler should simply invoke the
      same `close()` the return value already exposes, not a second drain implementation.
      Verified structurally via AST pattern search: exactly one `server.close(...)` call and one
      `server.closeAllConnections()` call in the whole file, both inside `drainAndClose()`. Both
      the no-signal path and the signal-wired path call this same function — no second drain
      implementation exists.

## 2. T011 — New package `@nextrush/health`

- [x] 2.1 Scaffold `packages/middleware/health/` matching `packages/middleware/request-id/`'s
      file layout (`middleware.ts`, `types.ts`, `constants.ts`, `index.ts`,
      `src/__tests__/`, `package.json`, `README.md`) and package.json conventions (name
      `@nextrush/health`, same `exports`/`main` shape).
      Verified: created `package.json` (name `@nextrush/health`, identical `exports`/`main`/
      `sideEffects: false` shape to request-id, only `dependencies`/`description`/`keywords`
      differ), `tsconfig.json`, `tsconfig.build.json`, `tsup.config.ts` as byte-for-byte
      structural copies of request-id's, adjusted only for package name/description.
- [x] 2.2 RED: write failing tests asserting `/livez` returns `200` with no checks registered, and
      remains `200` even when a registered readiness check fails (per spec's liveness/readiness
      separation, D5).
      Verified: 3 tests written in `health.test.ts`'s `describe('livez', ...)` block (no-checks
      200, failing-check-still-200, throwing-check-still-200).
- [x] 2.3 RED: write failing tests asserting `/readyz` returns `200` when all checks pass, and
      `503` when any check fails or throws.
      Verified: 5 tests written in the `describe('readyz', ...)` block, including a
      pass-through-to-`next()` test for unrelated paths (not explicitly requested by this
      sub-task but required to prove the middleware doesn't swallow non-health routes).
- [x] 2.4 RED: write a failing test asserting a check that never resolves still produces a
      bounded-time `503` response (timeout handling, per design.md's Risk mitigation) rather than
      an indefinite hang.
      Verified: `describe('check timeout', ...)` — registers a check returning
      `new Promise<boolean>(() => {})` (never settles), asserts `503` and elapsed time
      `< 1000ms` against a configured `checkTimeoutMs: 50`.
- [x] 2.5 RED: write a failing test asserting both sync (`() => boolean`) and async
      (`() => Promise<boolean>`) check functions are supported (resolves design.md's Open
      Question — confirm the decision during this step, adjust the test accordingly if the
      decision lands on async-only instead).
      Verified: **decision — support both**, per design.md's own "lean toward supporting both"
      steer and no strong reason found during implementation to narrow it. 3 tests in
      `describe('sync and async checks', ...)`: sync-only, async-only, and a mixed sync+async
      registration where the async one fails (confirms `Promise.all` over the check map handles
      a heterogeneous mix correctly, not just a homogeneous one).
- [x] 2.6 Verify RED: run all new tests, confirm they fail because the package doesn't exist yet.
      Verified: `pnpm --filter @nextrush/health exec vitest run` failed with
      `Cannot find module '../index'` / `ERR_MODULE_NOT_FOUND` — genuinely absent implementation,
      not a test-setup mistake.
- [x] 2.7 GREEN: implement the middleware, check registry, and the two endpoints per design.md
      D4-D5 and the spec's scenarios. Keep the file under this repo's 300-line ceiling per
      `code-structure.md` — split into the planned `middleware.ts`/`types.ts`/`constants.ts`
      files from the start rather than one large file.
      Verified: `constants.ts` (66 lines), `types.ts` (103 lines), `middleware.ts` (159 lines
      after the REFACTOR-step lint fix), `index.ts` (49 lines) — all well under the 300-line hard
      cap. `middleware.ts` holds `runCheckWithTimeout` (the `Promise.race` timeout wrapper),
      `runAllChecks` (concurrent check runner → name→pass map), and `health()` (the factory
      returning `{ middleware, registerCheck }`). `/livez` never calls `runAllChecks` at all
      (D5 — structurally enforced, not just tested).
- [x] 2.8 Verify GREEN: run all new tests — green. Confirm no test asserts on internals rather
      than observable HTTP behavior, per this repo's TDD steering.
      Verified: 14/14 tests pass (12 behavioral + 2 in the new locked public-surface test).
      Every behavioral assertion is on `ctx.status`, `ctx._json` (the mock's captured
      `ctx.json()` argument), or `next()` call count/timing — no test reaches into `health()`'s
      internal `Map` or calls `runCheckWithTimeout`/`runAllChecks` directly. `tsc --noEmit`
      clean; `eslint` clean on all 4 src files after one fix (see 2.11 note).
- [x] 2.9 Write `packages/middleware/health/README.md`, explicitly stating the default
      unauthenticated/cluster-internal security posture per design.md's Non-Goals and the spec's
      own security-disclosure scenario — do not leave this implicit.
      Verified: dedicated "Security Posture — Read Before Deploying" section states the
      unauthenticated-by-default posture explicitly, why it's intentional (matches Kubernetes
      convention, auth would cause false-negative outages since orchestrator probes can't supply
      credentials), the network-layer mitigation (NetworkPolicy / ingress-level restriction, not
      app-level auth), what the response body does/doesn't leak (boolean per-check only, no
      stack traces/connection strings), and the most likely misconfiguration (mounting behind an
      auth middleware by mistake). Mid-task correction: an earlier draft of the "Integrating with
      graceful shutdown" example referenced a fabricated `onDrainStart` callback that doesn't
      exist on the real `GracefulShutdownOptions` (verified against
      `packages/adapters/node/src/adapter.ts:103-115` via the graph) — caught before commit and
      rewritten to use the actual, working manual-listener coordination pattern instead.
- [x] 2.10 Add `@nextrush/health` to the root `README.md`'s middleware table, alongside the
      existing entries.
      Verified: one row added after `@nextrush/timer`; confirmed no duplicate via grep
      (`grep '@nextrush/health' README.md` → exactly 1 match).
- [x] 2.11 REFACTOR: confirm the check-registry API is simple and consistent (one clear way to
      register a check, one clear return contract), no speculative configurability beyond what
      the spec actually requires.
      Verified: registry is a single `Map<string, CheckFn>` with exactly one write path —
      `registerCheck(name, check)`. No `unregisterCheck`, no per-check timeout override, no
      priority/tags/groups, no separate sync/async registration methods — matches design.md's
      explicit Non-Goal ("not making checks async-queue-based... a simple array... run on each
      `/readyz` request"). One real fix applied during this pass: `eslint`'s
      `@typescript-eslint/no-confusing-void-expression` flagged the `setTimeout` callback in
      `runCheckWithTimeout` (`() => resolve(false)` as an implicit-return arrow) — added explicit
      braces; re-ran the full suite after the fix, still 14/14 green.

## 3. Cross-cutting

- [x] 3.1 (Optional integration, per design.md D4) Add a documented example in
      `@nextrush/health`'s README showing how to register a "draining" check that reads a shared
      flag set by `gracefulShutdown`'s signal handler — demonstrate the integration without
      creating a hard code dependency between the two packages.
      Verified: already present from task group 2 (commit `b281669`) — the README's
      "Integrating with graceful shutdown" section demonstrates a shared `isDraining` boolean
      flag set by the user's own `process.on('SIGTERM'/'SIGINT', ...)` listeners (run alongside,
      not instead of, `gracefulShutdown`'s own handler), read by a `registerCheck('draining', ...)`
      call. No import of one package's internals by the other — confirmed via `grep -rn
      "@nextrush/adapter-node" packages/middleware/health/src` (no matches) and `grep -rn
      "@nextrush/health" packages/adapters/node/src` (no matches). Correctly notes that
      `gracefulShutdown` has no `onDrainStart` callback today (verified against
      `packages/adapters/node/src/adapter.ts`'s actual `GracefulShutdownOptions` shape — no such
      field exists), so the example uses the working manual-listener pattern rather than a
      fabricated API. Confirmed correct as-is; not duplicated.
- [x] 3.2 Run the full repo `pnpm verify` — confirm no regression.
      Verified: `pnpm exec turbo run verify --continue` → `129 successful, 4 failed, 133 total`.
      All 4 failures are the pre-existing, previously-confirmed set: `@nextrush/di#test` and
      `@nextrush/class#test` (both time out on the same `CircularDependencyError`-detection test
      — `container.errors.test.ts`'s "should detect direct circular dependency with clear error"
      and registrar.test.ts's "surfaces @nextrush/di CircularDependencyError as-is", each hitting
      their vitest timeout at ~44-50s), `@nextrush/dev#lint` (pre-existing ESLint errors),
      `docs#lint` (pre-existing, `apps/docs` untouched). Cross-checked via `git diff --stat
      c31ccd2..HEAD -- packages/di packages/class apps/docs` — empty output, confirming this
      branch touches none of those three paths, so all 4 failures are structurally guaranteed
      pre-existing, not caused by this change. `@nextrush/adapter-node` and `@nextrush/health`
      both built/tested/linted successfully with zero failures. No other package failed — no
      regression introduced by this change.
- [x] 3.3 Add changesets: `@nextrush/adapter-node` (minor — new optional field, additive) and
      `@nextrush/health` (this is a new package's first release — check this repo's convention
      for a brand-new package's initial changeset, e.g. how `@nextrush/adapter-serverless` was
      introduced, and match it).
      Verified: added `.changeset/add-graceful-shutdown-signal-wiring.md`
      (`@nextrush/adapter-node: minor`) and `.changeset/add-health-package.md`
      (`@nextrush/health: minor`), matching `.changeset/adapter-serverless.md`'s convention for
      introducing a brand-new package (a `minor` bump on the new package's own name, prose
      describing the capability being shipped — that package's initial changeset is still
      present in `.changeset/`, confirmed via `git log --oneline -- .changeset/adapter-serverless.md`
      showing it was added in commit `bec1c1d` and never removed).
- [x] 3.4 Update `docs/audits/03-gap-checklist.md`: mark T010 and T011 ☑ with Verified: notes
      citing this change's commits; recompute the Progress Dashboard's Phase 1 row (should
      become 9/9, 100%) and Total row.
      Verified: T010 and T011 entries flipped to ☑, each with a `Verified (2026-07-17):` note
      citing commits `2efa95d`/`b281669` and the 86/86 and 14/14 test results. Progress Dashboard's
      Phase 1 row recomputed to `9/9, 0/0/9, 100%`; Total row recomputed to `64, 44, 2, 18, 28.1%`.
