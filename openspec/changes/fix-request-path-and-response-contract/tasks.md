# Tasks

## 1. Verification harness (what every later group's proof depends on)

- [x] 1.1 Confirm the request-cost toolkit and its committed budgets are present and runnable — verify: `node apps/benchmark/scripts/dev-check/check.mjs bundle cold inproc probe` completes on `--rt bun` and `--rt node` and prints a PASS / WARN / KNOWN / FAIL summary
- [x] 1.2 Wire the deterministic stages (`bundle cold inproc probe`) into CI so a pull request touching the request path runs them — verify: the job fails when a committed maximum is exceeded, proven with a deliberately regressed local run
- [x] 1.3 Add a bookkeeping check that every known-failure id maps to at least one probe — verify: deleting a probe leaves its id orphaned and the check reports the error
- [x] 1.4 Add the socket-required marking to the conformance suite and report a proof level (real-runtime vs simulated) per scenario — verify: a socket-required scenario executed by an in-process-only driver reports "not satisfied at real-runtime level" rather than pass
- [x] 1.5 Add real-listener drivers for the adapters whose runtimes are available locally (Node and Bun always; Deno when the runtime is present) — verify: a socket-required scenario runs over an actual socket on each and reports its proof level
- [x] 1.6 Add a source-hygiene check: the change introduces no source comment referencing a report path or a bug-brief identifier, so the code stays self-describing — verify: searching the changed source for report paths and brief identifiers returns nothing
- [x] 1.7 Document the toolkit's stages, the meaning of each ratio, and how to read a run summary — verify: following the documentation reproduces the summary output on a clean checkout

### 1b. Apparatus defects found while verifying 1.1–1.7

Both real-runtime conformance runners were unloadable, and the toolkit that proves every later
group was itself over the size ceiling with untested logic. None of this was in the plan; it is
recorded because each item is load-bearing for a later group's proof.

- [x] 1.8 Fix the Bun and Deno real-runtime runners, which could not execute at all — verify: `bun test` in `bun-runner/` reports 38 passing over a real listener and `deno task conformance` in `deno-runner/` reports 38 passing over a real `Deno.serve()` listener, each printing a per-scenario proof level
- [x] 1.9 Make the primitives swap a declared export condition instead of an undocumented import-map substitution — verify: `bun-runner/` contains no reader-installed wiring, the `test-primitives` subpath exports a `bun` condition, and the same suite still registers through Bun's own `it`/`expect`
- [x] 1.10 Give the real-runtime runners a CI job so socket-level parity is proven rather than assumed — verify: a `runtime-parity` job runs the Bun, Deno and workerd runners after the build, and each runner was confirmed green locally first
- [x] 1.11 Bring the toolkit within its own source-size ceiling and give its pure logic tests — verify: `check.mjs` orchestrates rather than implements (no module-level mutable state), the stage bodies live in `lib/stages/`, `pnpm --filter nextrush-benchmark test` covers the exemption and hygiene logic, and the full run's status counts are unchanged by the split

## 2. Request-path value integrity (parameters and wildcards)

- [x] 2.1 RED: add dispatch-level tests that mount the routing middleware and assert parameter and wildcard case preservation, covering mixed-case static plus parameter routes, `caseSensitive: true`, trailing and doubled slashes, percent-encoded uppercase, and a fold that changes a character's length — verify: the new tests fail today for the missing-value-path reason, not for a setup error
- [x] 2.2 Extend the canonicalizer's result with the case-preserving value path, reusing the same string when nothing folded — verify: unit tests assert same-string identity for an all-lowercase path and structurally identical/original-case output when a fold occurred
- [x] 2.3 Accept and forward the value path through router dispatch and the matcher while leaving the public two-argument match signature unchanged — verify: the standalone-match test and the unchanged-signature test both pass
- [x] 2.4 Record the request-path canonicalization contract in the router's documentation: matching uses the folded path, value extraction uses the case-preserved path, `ctx.path` stays folded — verify: the docs describe the two strings and match the tests
- [x] 2.5 Add a conformance scenario asserting parameter and wildcard case preservation on every adapter — verify: the scenario passes on node, bun, deno, edge and workerd
- [x] 2.6 Delete the known-failure id covering the `param-case-preserved` and `wildcard-case-preserved` probes — verify: both probes report PASS on `--rt bun` and `--rt node`
- [x] 2.7 Confirm no cost or allocation regression on the all-lowercase path — verify: the in-process ratio stays within its committed maximum and the router/dispatch allocation benchmarks report no new per-request allocation
- [x] 2.8 Document the observable change — verify: a CHANGELOG entry and a migration note state that a consumer needing folded parameter values must fold them itself

## 3. Serialize before commit, and never leave a request unanswered

- [x] 3.1 RED: add tests for the Node response path, the shared Web response builder, and the application error path — a value that cannot be serialized must produce a 500 (never a socket hang, never an empty 200 with a successful status), the builder must leave the response uncommitted after a throw, and a value that serializes to nothing must throw — verify: every new test fails today
- [x] 3.2 Add one shared serialization helper that produces the body string and throws a typed error naming the value class — verify: both adapter families import the single helper, and the helper's tests cover the value class in the message
- [x] 3.3 Move the response-committed flag to after a serialized body exists, in both the Node response methods and the shared Web builder — verify: a throw leaves the response uncommitted and a subsequent write completes normally
- [x] 3.4 Add the never-unanswered safety net in the application error path, in adapter finalizers, and in the Web builder — verify: an error handler that writes nothing still yields a 500 with a JSON body, and each of the three layers is reached by its own test
- [x] 3.5 Audit the remaining write methods (streaming, NDJSON/SSE writers, the default send branch) for the same commit-before-write ordering — verify: each audited method either has a test proving it cannot commit before it can write, or is fixed and tested
- [x] 3.6 Add a serialization-failure conformance scenario for every adapter — verify: the scenario passes on node, bun, deno, edge and workerd with status 500, a JSON body, no empty response, and no hang
- [x] 3.7 Delete the known-failure id covering the `json-bigint`, `json-circular` and `json-undefined` probes — verify: all three report PASS on `--rt node` and `--rt bun`
- [x] 3.8 Document the changed contract — verify: the CHANGELOG and the response docs state that a serialization failure reaches the error handler and that a request is always answered

## 4. Boot before dispatch on every entry point

- [x] 4.1 RED: add tests for every adapter entry point created without an explicit `ready()` — a declared route responds, an unknown path is a 404 rather than an empty 200, concurrent first requests share one boot, and extension setup runs exactly once — verify: the tests fail today
- [x] 4.2 Add one shared boot-gate helper that memoizes boot and returns the handler, with a steady-state fast path that adds no promise hop — verify: a test asserts the steady-state path performs no extra await or timer
- [x] 4.3 Adopt the shared helper in every Web adapter entry point and delete the duplicated inline boot logic — verify: no adapter retains its own boot/finalization copy and each adapter's existing tests stay green
- [x] 4.4 Make the application entry used directly fail with an actionable error when invoked before boot while the application owns an unmounted router, keeping the existing extension warning — verify: the new error test passes, and an explicitly mounted router still dispatches without boot
- [x] 4.5 Add a conformance scenario: a handler created without an explicit `ready()` routes correctly — verify: the scenario passes on node, bun, deno, edge and workerd, including a 404 for an unknown path
- [x] 4.6 Delete the known-failure id covering the `createhandler-without-ready` probe — verify: it reports PASS on `--rt bun`
- [x] 4.7 Correct the documentation that shows the previously broken pattern and state that the entry point boots on first request — verify: every documented snippet runs as written against the fixed code

## 5. Error-body contract

- [x] 5.1 RED: add tests for a parser error keeping its own code, a status-only error deriving the status's code, other client-error codes being preserved, a 5xx body staying byte-identical, a constant parse-failure message with a non-enumerable cause, and each value of the unparsed-content-type policy — verify: all fail today
- [x] 5.2 Derive the client-error code from the error's string code or otherwise from the status, reusing the existing error middleware's derivation so there is one contract, with 5xx bodies unchanged — verify: the shared-code test passes for both surfaces and the 5xx snapshot is byte-identical
- [x] 5.3 Make every parser's response-visible failure message a framework constant and retain the engine's own text only as a non-enumerable cause — verify: the same malformed body produces byte-identical responses on Node and Bun, and the engine text is absent from the body
- [x] 5.4 Add the explicit unparsed-content-type policy with today's behaviour as the default, and use the rejecting policy in the probe entry — verify: the default leaves the parsed body undefined and continues; the rejecting policy answers 415 before any handler runs
- [x] 5.5 Add conformance coverage for an invalid body asserting an identical response on every adapter, plus the rejecting policy — verify: both scenarios pass on node, bun, deno, edge and workerd
- [x] 5.6 Delete the known-failure id covering the `error-code-4xx`, `error-no-engine-text` and `unsupported-content-type` probes — verify: all three report PASS on `--rt bun` and `--rt node`
- [x] 5.7 Document the option and the code contract — verify: the body-parser docs state the default and recommend the rejecting policy for JSON APIs, and the CHANGELOG records the code change plus the next-major default flip

## 6. Dot segments and the negotiated request-target capability

- [x] 6.1 RED: add tests for percent-encoded and mixed dot spellings, for non-rejection of names that merely contain dots (including double-encoded forms), for the raw-target path helper on unusual targets, and for the new capability's reported value — verify: they fail today
- [x] 6.2 Add the raw-target path helper (path, query, original path) that scans the target string and constructs no `URL`, and use it for the Web context — verify: a test asserts no `URL` is constructed per request and that ordinary targets derive the same values as before
- [x] 6.3 Treat every percent-encoded dot spelling as a dot segment in one linear scan — verify: the encoded-rejection tests pass and the "filename containing dots" test still passes
- [x] 6.4 Add the request-target preservation capability, produce it for every known runtime, and expose it on the capability profiles — verify: a preserving runtime reports true, a normalizing runtime reports false, and the runtime-identity lint rule stays green
- [x] 6.5 Add the real-socket conformance scenario whose expectation is derived from the capability — verify: a divergence between an adapter's reported capability and its observed behaviour fails the suite
- [x] 6.6 Document the platform limit in the security guide and on each affected adapter page, including the proxy-ACL guidance — verify: each page states the limit and the recommended enforcement point
- [x] 6.7 Delete the known-failure id covering the `dot-segment-literal` and `dot-segment-encoded` probes — verify: both report PASS on `--rt node` and `--rt bun` with the documented per-capability expectations
- [x] 6.8 Confirm the adapter contract's security-parity requirement is satisfied by the socket scenarios — verify: the parity scenario reports its proof level and passes, or is explicitly marked simulated for an adapter that cannot run one

## 7. Outgoing-response honesty (interim, until the recorded model lands)

- [x] 7.1 RED: add real-adapter tests for a compressing middleware on a request with no body and on a request carrying a body — the first must not compress and must report once, the second must never transform the request body — verify: the tests fail today and pin the current behaviour precisely
- [x] 7.2 Remove every read of the parsed request body as if it were the outgoing response, and emit one warning per process when no outgoing body is available — verify: the no-body test shows no content encoding plus one warning, and the with-body test shows the request body untouched and no wasted work
- [x] 7.3 Resolve the response-aware middleware's documented default so its documented example has the documented effect, and pin the decision with a real-adapter test — verify: the documented example's header appears on every adapter, or the documentation is corrected and a test locks the corrected behaviour
- [x] 7.4 Add the post-handler header-write conformance scenario and record the current adapter divergence — verify: the scenario runs on every adapter and reports which adapters honour a header written after the handler
- [x] 7.5 State the limitation in each affected package's README and note that the structural fix is deferred — verify: each README says the middleware cannot act on handler-written responses, and the docs match the test in 7.1

## 8. Web request-path footprint

- [x] 8.1 Record this group's durable decision in `docs/RFC/` (promote the governing footprint RFC to approved, or add the decision) before implementing it — verify: the governing entry's status reads approved
- [x] 8.2 Baseline: run the deterministic stages twice and record the ratio and allocation figures for both runtimes — verify: two runs agree within the toolkit's noise band, and both figures are recorded for comparison
- [x] 8.3 RED: add tests asserting that constructing a Web context reads no incoming headers, resolves no client address, constructs no `URL`, and arms no timer for a handler that already settled — verify: they fail today
- [x] 8.4 Materialise the incoming-header record lazily behind a declared slot and memoized getter, and let a single-name lookup read the platform headers directly — verify: the laziness tests pass, the record's prototype-less shape, case-insensitive lookup and `set-cookie` array handling are unchanged, and no record is built for a handler that never reads it (proven by the counting-request test: zero platform header reads)
- [x] 8.5 Resolve the client address lazily behind a memoized getter — verify: no lookup for a handler that never reads the address, exactly one lookup for two reads, and the proxy-trust and empty-string tests are unchanged
- [x] 8.6 Move boot, timeout arming and finalization into one shared Web runner used by every Web adapter, arming a timer only when the handler has not already settled — verify: no adapter retains its own copy, no timer is armed for a synchronous handler, and the timeout interval, response body, signal and warning are unchanged
- [x] 8.7 Use the raw-target path helper for the Web context's path, query and original path, removing the per-request `URL` — verify: the in-process ratio improves and no probe regresses
- [x] 8.8 Adopt deferred query parsing only if the measurement supports it, and record the decision either way — verify: the ratio improves with no probe regression, or the attempt is reverted and the measurement recorded
- [x] 8.9 Ratchet the committed maximum and target to the measured values — verify: the gate passes at the new values and fails when the ratio is pushed above them
- [x] 8.10 Keep every new or changed module within its source-size ceiling and document the removed per-request work — verify: changed files are within their ceilings and the docs describe the lazy resolution and the shared runner
- [x] 8.11 Cross-adapter parity check for the whole group — verify: the conformance suite passes on every runnable adapter with no behavioural divergence and no probe failure

## 9. Integration verification

- [x] 9.1 Run the full test suite for every touched package plus the conformance suite on every runnable adapter — verify: green
- [x] 9.2 Confirm per-package line coverage stays at or above 90% and that the changed branches are covered — verify: the coverage report shows no decrease on a touched package
- [x] 9.3 Confirm lint (including the runtime-identity capability rule) and strict type checking are clean — verify: the lint and type-check commands exit 0
- [x] 9.4 Confirm every known-failure id fixed by this change is gone and no id remains that covers a passing probe — verify: the bookkeeping check passes and the probe stage reports no known entry for behaviour this change fixed
- [x] 9.5 Confirm the documentation sweep is complete — verify: every observable behaviour change has a CHANGELOG entry with a migration note, and each documented claim matches a passing test or scenario
- [x] 9.6 Confirm the diff is limited to the packages and documents named in the proposal and that no unrelated file changed — verify: the changed-file list matches the proposal's impact list

## Workflow follow-up

- Record the deferred recorded-response model as its own `docs/RFC/` entry before this change is archived, so the durable decision does not exist only in this change's history.
- Commit each group only when the maintainer asks; the maintainer decides when the working tree is committed.
- Archive the change once the maintainer's review requirements are satisfied.
