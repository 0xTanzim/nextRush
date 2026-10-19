# Tasks

## 1. Record the interim adapter-contract decision (RFC gate)

- [x] 1.1 Update `docs/RFC/runtime-adapters/041-recorded-response-model.md` to record the interim
      commit contract this change establishes: a post-commit response-header write is discarded and
      reported once, and a response the handler already committed outlives the handler timeout.
      Verify: the RFC's commit-model section states both outcomes and marks them as outcomes the
      recorded-response model must preserve.
- [x] 1.2 Confirm no new RFC is required — the decision edits the RFC that already owns the commit
      surface — and that the decision is discoverable from `docs/RFC/INDEX.md`. Verify: the index
      shows a single owning row for the commit/timeout surface, with no competing owner.

## 2. Node: a post-commit header write is a discarded, reported no-op

- [x] 2.1 (RED) Add a node-adapter test with an outer middleware that has post-`next()` work and an
      inner middleware that calls `ctx.set()` after the handler committed the response; assert the
      outer work ran, the client received the handler's response, and nothing rejected. Verify: the
      test fails against `packages/adapters/node/src/context.ts` for the expected reason (the outer
      post-`next()` work never ran).
- [x] 2.2 (RED) Add a test asserting the discarded write produces exactly one warning per process
      that names the field. Verify: the test fails today because no warning exists.
- [x] 2.3 (GREEN) Guard `ctx.set()`/`setHeader` in `packages/adapters/node/src/context.ts` on the
      committed state (`_responded || this._res.headersSent`), matching the guards the response
      methods already carry, and emit the once-per-process warning. Verify: 2.1 and 2.2 pass.
- [x] 2.4 (REFACTOR) Extract the committed-state check and the once-per-process warning into one
      small helper shared by `set` and the response methods, with no behaviour change. Verify: the
      full `@nextrush/adapter-node` suite passes.
- [x] 2.5 Confirm the header-validation guard is unweakened: an invalid field name or a value with
      control characters still throws a typed error before commit, and the post-commit path does not
      bypass it. Verify: the existing header-validation tests pass unchanged plus one new assertion
      covering a post-commit invalid write.
- [x] 2.6 Document the discard-and-report behaviour in the READMEs of the middleware that writes
      headers after the handler (`packages/middleware/timer`, `packages/middleware/compression`).
      Verify: each README states that a post-handler write after commit is discarded and reported
      once.

## 3. Web adapters: a committed response is not replaced by the 504

- [x] 3.1 (RED) Add a web-runner test where the handler commits a response and then works past the
      configured timeout; assert the client receives the committed response. Verify: the test fails
      today with `504 Gateway Timeout`.
- [x] 3.2 (GREEN) Guard the timeout path in `packages/runtime/src/web-runner.ts` on `ctx.responded`
      and deliver the committed response. Verify: 3.1 passes, and a request that produced nothing
      still receives the unchanged 504 body, cancellation signal and warning.
- [x] 3.3 Add the cross-adapter conformance scenario for a committed response outliving the timeout
      in `packages/adapters/conformance`. Verify: the suite passes on Node, Bun, Deno, Edge and
      serverless, and fails if the Web 504 path is restored.
- [x] 3.4 Update the `web-adapters` documentation for the timeout-completion contract, marking the
      `504`-after-commit change **BREAKING (observable)** with its migration note. Verify: the docs
      state the rule and the migration guidance.

## 4. Web adapters: arm the timeout only when the handler has not already settled

- [x] 4.1 A/B the candidate shapes from design.md D3 on a CPU-pinned run, best-of-three, recording
      the spread and the number of runs — including a null result. Verify: `dev-check` reports the
      `inproc.nextrush` request cost for each shape with the spread recorded.
- [x] 4.2 (GREEN) Implement the shape the A/B selects, so a synchronously-answered handler performs
      no timeout racing while the timer, 504 body, cancellation signal and warning text are
      unchanged for a request that does not settle. Verify: the `web-adapters` timeout-arming
      scenarios pass and 3.1 stays green.
- [x] 4.3 Adopt the change only if the committed `inproc.nextrush.vs_hono` gate improves beyond the
      machine's 8–12 % run-to-run noise floor; otherwise record the null result and revert the
      shape. Verify: `node apps/benchmark/scripts/dev-check/check.mjs inproc` passes with a
      committed-gate number (there is no `bench:validate` script in this repository), or the task
      records a documented null result with the gate unchanged.
- [x] 4.4 Add a web-runner unit test asserting the already-settled case schedules no timer while the
      pending case still does. Verify: the test fails if the racing is restored.
- [x] 4.5 Document the arming rule in the web-adapters docs. Verify: the doc states that no timeout
      racing is performed for an already-settled handler.

## 5. Measurement validity: an in-proc entry exercises the adapter it names

- [x] 5.1 (RED) Change `apps/benchmark/scripts/dev-check/entries/inproc-nextrush.ts` and its sibling
      in-proc entries to select the adapter for the runtime under test instead of unconditionally
      importing `@nextrush/adapter-bun`, and record which adapter and runtime each row exercised.
      Verify: with the Node runtime selected the entry exercises the Node adapter entry point, and
      the existing Bun/Web runner entry remains as the labelled control.
- [x] 5.2 Record the before/after in-proc numbers for `--rt node` (runner-on-Node vs Node adapter)
      on the same machine and flags. Verify: `node apps/benchmark/scripts/dev-check/check.mjs inproc
      --rt node` runs clean and both numbers are recorded (there is no `bench:validate` script).
- [x] 5.3 Document the entry-selection rule and which adapter each in-proc row measures in the
      dev-check README. Verify: the README names each row's adapter and runtime.

## 6. CPU, allocation, and kernel attribution for the touched paths

- [x] 6.1 Attribute CPU for the Node header-write path and the Web dispatcher before and after the
      fixes using the existing profiler artifacts and methodology. Verify: a profiler artifact
      identifies the header-write and dispatch frames.
- [x] 6.2 Measure the allocation impact of both fixes with the deterministic allocation counter,
      never sampled `heapUsed`. Verify: each fix records a counter delta, and any `heapUsed` figure
      is explicitly marked as non-evidence.
- [x] 6.3 Record any cache-line or branch-layout observation as labelled inference only. Verify:
      every layout statement is marked inference, and no task's acceptance depends on one.
- [x] 6.4 Leave kernel/syscall-level behaviour to the existing OS-queue and socket-timeout evidence;
      add an entry only if a syscall-level change is actually made. Verify: no user-space assertion
      about kernel behaviour is recorded without a matching OS-level measurement.

## 7. Integration checks

- [x] 7.1 Run the cross-adapter conformance suite across all shipped adapters. Verify: the parity
      scenarios for both behaviours pass on every adapter.
- [x] 7.2 Run the repo gates: per-package line coverage at or above 90 %, ESLint clean, `tsc` strict
      clean, `turbo build/lint/typecheck`, and the build hygiene stage that rejects a newly added
      comment referencing a planning artifact. Verify: every gate passes with the changed packages
      included.
- [x] 7.3 Run `dev-check` on Bun and Node and confirm the gate summary is no worse than the
      pre-change summary, explaining any difference. Verify: `bench:validate` passes and no new
      failure appears outside the recorded known failures.

## Workflow follow-up

- Archive the change once the RFC record (group 1) and the integration gates (group 7) are satisfied.
- Verify the archived result.
