# Tasks

## 1. Baseline and attribution (before)

- [x] 1.1 Profile the Deno POST path over real HTTP (`prof-run.sh`, 186 825 requests in 8 s) and record the ranked self time per function. Verify the profile names the timeout cluster and the body-read cluster separately.
- [x] 1.2 Price the primitives in isolation per runtime: `setTimeout`+`clearTimeout`, `Promise.race`, the microtask settle turns. Verify Deno's timer is materially more expensive than Bun's.
- [x] 1.3 Measure the race end to end by running the identical bundle with the race disabled and with the default timeout, paired, on Deno, Bun, and Node. Verify the delta is the race's cost and not a build difference.

## 2. RED tests

- [x] 2.1 Add failing tests for the shared scheduler in `packages/runtime/src/__tests__/deadline-scheduler.test.ts`: a deadline fires when it is due, a cancelled deadline never fires, many deadlines share one timer, an earlier deadline re-arms the timer, and the timer is released when the sweep finds nothing pending. Verify they fail against no scheduler.
- [x] 2.2 Keep the runner's timeout contract test (`web-runner-timeout-contract.test.ts`) green: a stuck handler still gets a 504, a committed response still outlives the timeout, and a late rejection is still swallowed. Verify pass-before and pass-after.

## 3. Implementation

- [x] 3.1 Add `packages/runtime/src/deadline-scheduler.ts`: one shared timer, a pending-deadline map, a sweep on a short window, and an exact arm once a deadline is within the window.
- [x] 3.2 Use the scheduler in the shared web runner, replacing the per-request `setTimeout`/`clearTimeout` and the `Promise.race`.
- [x] 3.3 Keep the Node adapter's own race unchanged in this change; record it as the next candidate.

## 4. Verification

- [x] 4.1 Run the runtime and adapter suites; verify all pass with no skipped new tests.
- [x] 4.2 Run the cross-adapter conformance suite on Node, Bun, Deno, Edge, and serverless, plus the real-runtime runners on Bun, Deno, and `workerd`.
- [x] 4.3 Run ESLint and `tsc --noEmit` (strict) for the touched packages; verify zero errors.
- [x] 4.4 Measure the paired before/after on Deno, Bun, and Node for POST and on Deno for GET; verify no runtime regressed.
