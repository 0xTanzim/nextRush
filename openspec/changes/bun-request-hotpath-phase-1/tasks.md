# Tasks

> **Status at 2026-10-21 close-out: 39 / 42 complete.**
>
> Open, by design rather than omission:
> - **9.5** — the CPU-pinned per-phase A/B cannot be re-run: the change was already in the working
>   tree when this pass began, so there is no pre-change arm to measure against without reverting
>   user work. RFC-045 §14.1 records the recorded baseline, two close-out runs, and states plainly
>   that the full-POST comparison overlaps run noise.
> - **9.7** — `apps/benchmark/scripts/alloc/` has no JSON-path variant, and the literal claim ("no
>   settlement promise is allocated") is false in the shipped code; the promise remains as the race
>   handle. Substituted evidence is recorded on the task.
> - **10.2** — archiving is gated on 9.5 and 9.7.
>
> Two task texts drifted from the shipped code during implementation. The shipped names are
> authoritative: `textWithinLimit` → `readTextIfProvenWithin`, `readText` → `readBodyText`,
> `parseJsonPrechecked` → one shared read/parse tail inside `json()`, and the timeout helper takes an
> `onTimeout` callback rather than `ctx`.

## 1. Decision record (RFC-gated, before code)

- [x] 1.1 Write `docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md` from the RFC template: the body-read, timeout, and parser-chain problems with committed numbers; the limited-text eligibility rules; actual-byte limit enforcement; the timeout shape; the flattened JSON path; rejected alternatives; and the measurement gate. Verify every template section is filled and the RFC contains no implementation claim that the change has shipped.
- [x] 1.2 After review approval, write `docs/adr/ADR-0033-bun-request-hotpath-phase-1.md` from the ADR template recording the durable decisions (internal limited text capability, committed-response timeout dispatch, shared prechecked JSON path) and their consequences. Verify each decision is stated in one paragraph and the ADR links RFC-045. — **`ADR-0033` written, `Accepted · Shipped`, registered in `docs/adr/INDEX.md`.**
- [x] 1.3 Register RFC-045 in `docs/RFC/INDEX.md` and link it from `openspec/changes/bun-request-hotpath-phase-1/design.md`. Verify the index row resolves and the design link points at the RFC.

## 2. Baseline and attribution (before implementation)

- [x] 2.1 Capture the Bun in-process baseline with `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` and three CPU-pinned runs (`taskset -c 0-3 …`); record `POST us`, the Hono ratio, min/median/max, and the spread in `report/performance/bun-native-gap-analysis.md` or a dedicated Phase 1 baseline section. Verify the spread is recorded before any code is written and is used as the parking threshold in 9.5. — **Recorded in `report/performance/bun-body-read-baseline.md` §2.1–2.3 (three runs: 26.74 / 28.92 / 26.67 µs, ratios 6.22 / 7.19 / 5.93).**
- [x] 2.2 Re-run the body-read probe variants (`ctx-body-source`, `ctx-body-text`, `ctx-text-json`, `ctx-native-json`) and the parser-chain stage (`body-parser` vs `ctx-body-source`) with the same protections; record each median and the runtime version. Verify the numbers match the report's table or record the drift explicitly. — **RFC-045 §3.2: `ctx-body-source` 6.07, `ctx-body-text` 6.21, `ctx-text-json` 3.81, `ctx-native-json` 3.77, body-parser 7.28 µs.**
- [x] 2.3 Capture the Bun wire POST result once with the existing dev-check wire stage and record it as directional evidence only. Verify no wire budget is added or tightened from this number. — **`bun-body-read-baseline.md` §5.7 (throughput 9,073 → 22,056 rps). No wire budget row exists.**

## 3. P0 RED tests — Web body source

- [x] 3.1 Add failing `WebBodySource` tests for the native text path: when UTF-8 and `Content-Length <= limit`, `request.text()` is used and `request.body.getReader` is never touched; the returned string equals the buffer-path decode for valid UTF-8. Verify the test fails on the current implementation for the fast-path expectation. — **Shipped as *"returns the decoded body when Content-Length proves it fits"*. The `getReader` clause was dropped as unimplementable: `request.text()` consumes the body through its own reader internally. The pinned observable is that no framework-side byte read or `Uint8Array` occurs, plus string equality with the buffer decode.**
- [x] 3.2 Add failing fallback tests: absent/chunked/understated length, non-UTF-8 encoding, and `contentLength > limit` all use the existing `buffer(limit)` behavior and error contracts. Verify each fails for the intended reason. — **Absent, over-limit, and non-UTF-8 decline-without-consuming; an understated length is the encoded-size case in 3.3.**
- [x] 3.3 Add failing byte-limit tests: an ASCII body under the limit, a non-ASCII body whose `text.length` is under the limit but whose UTF-8 bytes exceed it, a body whose bytes are exactly at the limit, and one byte over. Verify the over-limit cases fail before implementation and the at-limit case passes. — **`body-size-guard.test.ts` (9 cases) plus the `é`-body rejection; the reported `received` count is now the exact UTF-8 byte length rather than a code-unit count.**
- [x] 3.4 Add failing cache/consumption tests: `text()` then `buffer()` returns bytes without a second platform read; `buffer()` then `text()` returns the cached decode; `text()` twice returns the cached text; `stream()` after text still throws `BodyConsumedError`. Verify each fails only on the new expectation. — **text→buffer, text→text, and consumed→reject are pinned here; buffer→text is the pre-existing `text()` path over the byte cache.**
- [x] 3.5 Add failing body-parser-facing assertions that the optional capability is detected structurally and that a source without it (the Node shape) keeps the buffer path. Verify no test imports an adapter package from `runtime`. — **`json-text-path.test.ts` *"falls back to the byte read when the source has no text capability"*; runtime tests import types only.**

## 4. P0 implementation — Web body source

- [x] 4.1 Add `_cachedText` to `WebBodySource`; implement `textWithinLimit(limit)` with the decision order in RFC-045 §8.3: cached buffer, cached text, consumed, declared over-limit, eligible native text, buffer fallback. Verify tasks 3.1–3.5 turn green. — **Shipped as `readTextIfProvenWithin(limit)`.**
- [x] 4.2 Add the UTF-8 byte-check helper (`text.length * 3` upper bound, `text.length` lower bound, exact `TextEncoder` in the uncertain band). Keep `BodyTooLargeError` messages and the existing `AbstractBodySource` pre-check/post-check ownership unchanged. Verify the error contract tests stay green. — **`body-size-guard.ts` (`exceedsUtf8Limit`, `utf8ByteLength`); messages unchanged.**
- [x] 4.3 Override `text()` in `WebBodySource` to call `textWithinLimit(this.options.limit)`, and extend `buffer()` so a text-only cache is re-encoded once and cached. Verify the valid-UTF-8 round-trip and the consumed/stream tests.
- [x] 4.4 Document the native text condition, the byte-check algorithm, and the cache caveat in `packages/runtime/ARCHITECTURE.md`; update the Bun/Deno adapter architecture docs only where they describe the shared body source. Verify the docs describe when text is used and when the buffer path is required. — **Added to the performance table plus a *"The limited text read"* subsection. Neither adapter's docs describe the shared reader internals, so no adapter doc changed.**

## 5. P1 RED tests — body-parser JSON path

- [x] 5.1 Add failing tests that an eligible JSON request without `rawBody`/`verify` uses one limited text read through the body source capability and produces the same `ctx.body` as the buffer path. Verify the test fails on the current `buffer()`-only branch.
- [x] 5.2 Add failing tests for `rawBody` and `verify`: both must use the buffer path and receive the original bytes, including a body with a byte sequence that would round-trip differently through text. Verify the tests fail if either is routed through text. — **Also pinned at integration level: `rawBody` bytes equal the encoded body and equal the byte-path result.**
- [x] 5.3 Add failing limit tests: text length under the limit but actual bytes over; understated `Content-Length`; chunked/absent length; declared length over the limit. Verify each produces the existing `ENTITY_TOO_LARGE` code and the intended message shape.
- [x] 5.4 Add failing parity tests for empty body, strict mode, `maxDepth` just below/at/above the threshold, invalid JSON, and `next()` ordering. Run each through both the text and buffer paths and assert `code`, `status`, client-safe message, and `ctx.body` equality. Verify the tests fail for the missing text path, not for pre-existing behavior.
- [x] 5.5 Add failing combined-parser tests: `bodyParser()` JSON output equals standalone `json()`, content-type detection still happens once, and the prechecked path does not call `next()` twice. Verify the test fails on the current extra wrapper assumption.

## 6. P1 implementation — body-parser JSON path

- [x] 6.1 Add `readText(ctx, limit)` in `parsers/reader.ts` or a sibling module: no source, declared over-limit pre-check, optional `textWithinLimit`, otherwise `readBody` + `bufferToString`; map runtime errors exactly as `readBody` does. Verify tasks 5.1–5.3 turn green. — **Shipped as `readBodyText(ctx, limit)`; its error mapping is now covered by three tests.**
- [x] 6.2 Add `parseJsonPrechecked(ctx, options)` and the shared `parseJsonText`/`parseJsonBuffer` helpers in `parsers/json.ts`: empty body, `rawBody`, `verify`, parse/reviver, strict, depth, `ctx.body`, and error mapping. Keep `json()` as the public middleware delegate. Verify task 5.4 turns green. — **Drift: no separate helpers exist. `json()` selects a text or byte read, then runs one shared parse/strict/depth/error tail, which is stronger than two helpers because the two paths cannot diverge.**
- [x] 6.3 Route `combined()`'s JSON branch directly to `parseJsonPrechecked` after its one content-type detection, then call `next()` itself. Do not create a second parser instance or re-read the content type. Verify task 5.5 and the existing combined-parser tests turn green. — **`combined.ts:116` builds exactly one `json()` parser and calls it with `prechecked = true`; one content-type detection, one `next()`.**
- [x] 6.4 Update the body-parser README/ARCHITECTURE only if a documented guarantee changes; otherwise record "no documented guarantee changed" in the change notes. Verify no public option or error code was added. — **No documented guarantee changed: no option, error code, or message was added. Recorded here and in RFC-045 §12.**

## 7. P2 RED tests — timeout dispatch

- [x] 7.1 Add failing runner tests for the committed-response timer skip: a handler that commits synchronously arms no timer; a handler that settles without committing may arm a timer but receives no 504 and completes normally. Verify the second test fails on the current settlement-based behavior if it asserts the new shape.
- [x] 7.2 Add failing tests for a handler that rejects after the timeout fires: the rejection is observed, no unhandled rejection is emitted, and the timeout response path still behaves as before. Verify the test fails without the direct-race handler. — ***"answers 504, not 500, when the handler rejects only after the deadline"***.
- [x] 7.3 Keep the existing timeout tests green before and after: 504 body, `ctx.triggerTimeout()`, signal abort, warning text, late committed response, timeout `0`, and sync committed response. Verify pass-before/pass-after.

## 8. P2 implementation — timeout dispatch

- [x] 8.1 Replace `dispatchWithTimeout` with the committed-response bounded loop plus direct `Promise.race` and `finally clearTimeout` shape in RFC-045 §8.5; pass `ctx` into the helper. Verify tasks 7.1–7.3 turn green. — **Drift: the helper takes an `onTimeout` callback that calls `ctx.triggerTimeout()`, keeping `@nextrush/runtime` free of a concrete context type. Same behavior, narrower dependency.**
- [x] 8.2 Update the helper comments to explain why `ctx.responded` is the timer-skip signal, why a settled-no-response handler may arm a timer, and why the direct race observes late rejection. Verify no comment claims the old settlement behavior.

## 9. Verification and after-measurement

- [x] 9.1 Run `pnpm --filter @nextrush/runtime --filter @nextrush/body-parser --filter @nextrush/adapter-bun --filter @nextrush/adapter-deno test`; verify all pass with no skipped new tests. — **379 / 320 / 129 / 123 passing, 0 skipped.**
- [x] 9.2 Run the cross-adapter conformance suite across Node, Bun, Deno, and Edge; verify observable body-reading, JSON, and timeout behavior is identical and Node is unchanged. — **436/436 across the conformance drivers.**
- [x] 9.3 Run ESLint and `tsc --noEmit` (strict) for the touched packages; verify zero errors and no new warnings. — **`tsc` clean on all four; `oxlint` clean on runtime and adapter-bun except one pre-existing `no-non-null-assertion` warning in `response-builder.ts:173`, a file this change does not touch. body-parser has no lint script.**
- [x] 9.4 Run per-package coverage for the touched packages; verify line/function coverage is at or above 90% and does not decrease on touched files. — **Lines / branches: `body-source.ts` 91.2 / 91.7, `web-runner.ts` 100 / 92.9, `body-size-guard.ts` 100 / 100, `reader.ts` 92.7 / 90.5, `json.ts` 100 / 92.2. `reader.ts` started this pass at 85.4% lines; the three error-mapping tests close it.**
- [ ] 9.5 Run the CPU-pinned A/B for each phase separately (body text, parser flattening, timeout) with the same protocol as 2.1; keep a change only if its median win exceeds the recorded spread, otherwise revert it and record the parked result. — **Blocked, not skipped. The change was already in the working tree at the start of this pass, so no pre-change arm exists without reverting user work (forbidden). The substitute evidence is RFC-045 §14.1: recorded baseline 9.91–10.40 µs, close-out runs 8.18 and 9.41 µs, explicitly stated as overlapping once run spread is counted; the isolated read probe (6.07 → 3.77 µs) is the effect-size evidence.**
- [x] 9.6 Run `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun`, `--rt node`, and `--rt deno`; verify the Bun POST result improves, Node does not regress, and Deno stays within its committed baseline/noise floor. — **Bun: `inproc.post.nextrush.vs_hono` PASS (1.9 and 2.15, target 3), `FAIL 0`; the only WARN is the pre-existing GET ratio band. Node and Deno: `FAIL 0`, no new KNOWN. "Bun POST improves" is **not** claimed: the two close-out runs straddle the baseline (see 9.5).**
- [ ] 9.7 Run the allocation harness (`apps/benchmark/scripts/alloc/`) or the repo's current equivalent for the JSON path; verify no settlement promise is allocated on the async dispatch path and no `Uint8Array` is allocated for eligible JSON text reads. Record the before/after numbers. — **Not satisfiable as written. (a) No JSON-path allocation variant exists in `apps/benchmark/scripts/alloc/`; building one is a new instrument, not a verification. (b) The claim "no settlement promise is allocated" is **false** in the shipped code — `dispatch.then(...)` always allocates it, and removing it would lose the late-rejection guard. What holds is pinned structurally instead: the `Uint8Array`-free claim is asserted by path-selection tests (`calls.bufferLimit` stays `undefined`), and the removed `await` is visible in `web-runner.ts`. RFC-045 §10/§14 correct the claim.**
- [x] 9.8 Ratchet `apps/benchmark/scripts/dev-check/budgets.json` only if 9.5–9.7 show a win beyond the spread; never add a wire budget row. Verify `bookkeeping` and the Bun/Node/Deno gates pass. — **No ratchet: `budgets.json` is unmodified, because 9.5 did not establish a beyond-spread win. `bookkeeping.budget-rules` and `bookkeeping.knownFailures` PASS.**
- [x] 9.9 Run the full `bundle cold inproc probe bookkeeping` gate on Bun, Node, and Deno; verify zero FAIL and no new KNOWN results. — **Bun: full gate `PASS` on bundle/cold/probe/bookkeeping/hygiene, one WARN (GET ratio), `FAIL 0`, no new KNOWN. Node and Deno: `inproc` stage `FAIL 0`, no new KNOWN; their `bundle`/`cold` stages were not re-run in this pass (no bundling or startup path changed).**
- [x] 9.10 Run `pnpm bench:validate` (or the repository's current equivalent); verify response bodies and content types remain byte-identical across all benchmark servers. — **No `bench:validate` script exists; the equivalent is `node apps/benchmark/scripts/validate-parity.js nextrush-v3` → *"Parity OK — 2 servers agree on bodies, content types, statuses, and middleware headers."***
- [x] 9.11 Update RFC-045, ADR-0033, and the performance report with the final before/after numbers, the kept/parked list, and any residual caveat. Verify the ADR states the accepted result and the RFC status moves from `In Review` to `Approved` only after the gate passes. — **RFC-045 → `Shipped` (the vocabulary this repo uses for an implemented RFC) with §14.1 results and the noise caveat; ADR-0033 written; `bun-body-read-baseline.md` close-out added; router and phase-2 reports corrected where they mis-attributed cost.**

## 10. Workflow follow-up

- [x] 10.1 Review RFC-045 and the spec deltas before implementation begins; resolve the open questions in RFC-045 §18 (buffer-after-text behavior, depth upper bound, `SETTLE_TURNS`, direct combined routing) in the ADR or review notes. — **All five resolved in RFC-045 §18, each with the shipped choice and its reason.**
- [ ] 10.2 Archive the change only after every task is complete, ADR-0033 is accepted, the conformance and performance gates pass, and the final report is committed. — **Not archived: gated on 9.5 and 9.7. Everything else is done.**
