# Web response materialization — investigation record (change rejected, later superseded)

> **Correction (2026-10-21).** The verdict below is **superseded**, and this file is kept because the
> history is the record. The revert was decided on **Bun** wall-clock throughput (noise-bound) and on
> **Bun/Node allocation bytes**, and **Deno was never measured** — which is where the platform has a
> static-response fast path that the framework's media type missed. A later measurement with a
> server-CPU-per-request instrument (the paired protocol) kept the change and added the JSON media
> type that unlocks that fast path: **−16.6 % server CPU per request on Deno GET**, −8.1 % on Deno
> POST, and **no CPU regression on Bun** despite the +12 B allocation the spike below measured.
>
> The current record is
> [`json-media-type-and-response-construction.md`](json-media-type-and-response-construction.md);
> the governing decision is RFC-046 / ADR-0034. §4's "Decision: revert" is corrected in place below.

Question: can `WebResponseBuilder.getResponse()` avoid the per-response `Headers` instance and its
`has`/`set` calls for the common content-type-only response, and does that reduce Bun's per-request
cost?

**Outcome: implemented, measured, and reverted.** The repo's archived `bun-response-cost` spike had
already measured this exact construction with a more sensitive instrument, and its verdict —
recorded below with the new evidence — supersedes a noise-bound wall-clock result.

Machine: Intel Core i5-8300H (8 threads, shared). Bun 1.4.3, Node v26.12.0, Deno 2.9.3.
Workload: `inproc` stage (no network, 100,000 dispatches per arm, source-bundled), CPU-pinned with
`taskset -c 0-3`. Measurements taken 2026-10-20.

## 1. Starting point

Three pinned runs of the untouched tree:

| run | `inproc.nextrush.us` | `inproc.nextrush.vs_hono` |
| ---: | ---: | ---: |
| 1 | 3.607 µs | 1.28 |
| 2 | 3.831 µs | 1.37 |
| 3 | 3.634 µs | 1.33 |

Attribution (`profile --rt bun`): `Headers` 2.6%, `Headers.set` 3.2%, `Headers.has` 2.1% — 65 ms of
sampled time inside `buildResponse`, for a response that records **zero** extra headers. Hono's hot
path passes a plain record to `new Response(...)` (`hono@4.13.0/dist/context.js`, `#newResponse`),
so the cheaper-looking shape exists on this runtime.

## 2. Change tried

`buildResponse` took a plain header record when `record.extraHeaders()` was empty, keeping the
`Headers` + `append` + `has`/`set` path otherwise. Guard tests asserted exactly one header on that
path and zero headers for a content-type-less stream. No public API or wire change.

## 3. Measurement — wall clock could not resolve it

Interleaved A/B, 3 pairs, base → change minutes apart on the same machine:

| pair | base µs / ratio | after µs / ratio |
| ---: | ---: | ---: |
| 1 | 3.655 / 1.25 | 3.605 / 1.31 |
| 2 | 3.602 / 1.23 | 3.561 / 1.25 |
| 3 | 4.471 / 1.48 | 3.603 / 1.25 |
| **median** | **3.655 / 1.25** | **3.603 / 1.25** |

−1.4% µs median at an unchanged ratio: inside this machine's noise band. The profile did confirm the
mechanism — `Headers`, `set`, and `has` left the top rows — but removing JavaScript-visible calls did
not translate into a Bun win.

## 4. The decisive evidence: the archived spike

`openspec/changes/archive/2026-10-19-bun-response-cost/design.md` (D8) measured the same variants
with a per-response allocation harness (`--expose-gc`, three runs, ±1.4 B stddev):

| Runtime | Shape | `current` (Headers + set) | `literal` (this change) | `pairs` |
| --- | --- | ---: | ---: | ---: |
| Bun | `default` | 355.1 B | **367.3 B (+12.2)** | 344.2 B (−10.9) |
| Bun | `one-extra` | 316.5 B | **325.8 B (+9.3)** | 291.9 B (−24.6) |
| Node (Web runner) | `default` | 2733.8 B | **2552.5 B (−181.3)** | 2861.1 B (+127.3) |

The archived verdict states it directly: *"D2's chosen construction is wrong for Bun … the literal
allocates more than the Headers instance it replaces (+12 B), reproduced across three independent
runs."* No single construction wins on both runtimes — Bun prefers `pairs`, Node prefers `literal`,
and runtime branching is forbidden by the portability rule. The current `Headers` + `set` code is the
recorded compromise.

**Decision at the time: revert.** The change made Bun's dominant path allocate slightly more while the loud
metric stayed flat. Keeping it would have required contradicting a deterministic, reproducible
measurement with a noise-bound one. Reverted to `f47ee4a0`; `ARCHITECTURE.md` unchanged for this
path.

**Corrected verdict (2026-10-21): kept.** The revert was right on the evidence it had — Bun's
allocation bytes really are worse, and Bun's wall-clock really was flat — but the question was asked
on two runtimes and answered on one. The later measurement adds:

- **Deno**, where the platform's `Response` constructor has a static fast path that the framework's
  media type missed: **−16.6 % server CPU per request on GET** (4/4 pairs faster) and −8.1 % on
  POST. The construction itself costs **1.019 µs** with a `Headers` instance against **0.230 µs**
  with the plain init record — measured in isolation, 5 rounds.
- **Bun and Node, measured on CPU per request** rather than wall-clock throughput: **no regression**
  (Bun −0.33 µs/req, 3/4 pairs faster; Node inside the noise). The +12.2 B allocation the spike
  measured is real and below the CPU floor.
- The media type that makes the fast path reachable — `application/json`, with no `charset`
  parameter, which RFC 8259 §8.1 defines and which Hono and Express already send — is a separate,
  wire-visible change, recorded in RFC-046 / ADR-0034.

## 5. Candidates measured and rejected in the same pass

| Candidate | Current | Alternative | Verdict |
| --- | ---: | ---: | --- |
| `request.method.toUpperCase()` guard (`GET`/`POST` short-circuit) | 0.029 µs | 0.023 µs | Rejected: 6 ns; adds a branch for no end-to-end effect. |
| Skip `parseQueryString('')` with a pre-check | 0.021 µs | 0.018 µs | Rejected: 3 ns; the empty path already returns a shared frozen object. |
| Native `indexOf` URL scan instead of `charCodeAt` loops | 0.107 µs | 0.101 µs | Rejected: 6 ns **and** a semantic defect — native form parses `http://h/p#f?x=1` as path `/p#f` + search `?x=1`, while the current scan (and `URL`) end the target at the fragment. |
| Fuse `WebResponseBuilder` + `OutgoingResponse` | 0.038 µs (both) | — | Rejected: one allocation; needs inheritance or a facade that fights the composition boundary. |
| Inline the `flush` closure in `getResponse` | — | — | Deferred: ~1% of samples; `flush` is the lifecycle contract for late writes. |

A units error in the first screening pass (µs reported as ns) briefly made these look like
sub-nanosecond operations; the corrected numbers drove the decisions.

## 6. Cross-runtime check (kept)

Deno (shares `WebResponseBuilder`): `inproc.nextrush.us` 8.52 / 8.82 / 9.07 µs against Hono
6.38 / 6.89 / 7.04 — ratio **1.24 / 1.25 / 1.42**, the same framework premium as Bun. No
Deno-specific regression. (An earlier 1.71 reading was machine noise.)

Wire (Bun, `wrk`, three runs): 34.8k / 33.7k / 34.2k rps against Hono 39.2k / 39.9k / 40.4k
(≈0.85) — consistent with a CPU-bound per-request delta of ~0.7 µs.

## 7. Verification of the surviving work

The RFC-043 adapter matrix (Bun + Deno contexts read provable-length bodies natively and cache the
result; unprovable bodies keep the reader) and the `requestTargetFromUrl` ARCHITECTURE correction
were kept:

- `packages/runtime` 352/352; `@nextrush/body-parser` 305/305; `@nextrush/adapter-bun` 129/129;
  `@nextrush/adapter-deno` 123/123.
- Conformance: Node suite 436/436; real Bun 56/56; real Deno 56/56.
- `probe --rt bun` 16 PASS / 0 FAIL; `--rt node` 15 PASS / 0 FAIL.
- Lint and `tsc --noEmit` clean for the touched packages.

## 8. Remaining bottlenecks (ranked)

1. **Context construction ~150–200 ns/request** — method normalisation, URL target derivation, query
   parse, body-source selection, and two response objects. Each piece is 15–45 ns; no single item is
   above the noise floor.
2. **Dispatch/middleware wrapper** — `compose`'s `nextFn` closure and the `.then` error boundary, one
   promise hop each (~20–60 ns).
3. **Native floor** — `Request` + `Response` construction plus `JSON.stringify` are the same for Hono
   and dominate both profiles; no framework change moves them.

Closing (1) and (2) requires object reuse/pooling or collapsing the context/dispatch layers, both
excluded by the framework's ownership and composability rules.

## 9. Limitation

Wire POST is now measured by `dev-check` (`wire.post.*`); `bun-body-read-baseline.md` §5.7
records the before/after. Edge real-runtime conformance ran against `workerd 2026-10-11`:
15/15 probes INFO, 0 FAIL.
