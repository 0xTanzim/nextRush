# Bun Context and Response Hot Path — Phase 2

**Scope**: the per-request cost of context construction and response materialisation in
`@nextrush/runtime` + `@nextrush/adapter-bun`, measured against the Phase 1 result.
**Runtime**: Bun 1.4.3, Node v26.12.0, i5-8300H (4C/8T), Linux x64.
**Branch state**: working tree, no commits. Phase 1 changes preserved untouched.

## 0. Outcome

**No change was retained.** The Phase 2 premise — that ~2.0 µs of context/response overhead
leaves 0.8–1.5 µs recoverable — is not supported by measurement. The context and response
stage costs **0.84 µs** in the full path, and **≤0.05 µs of that is NextRush logic**. The
remainder is the Web `Response`/`Headers` construction floor, which is not removable without
changing the public response contract.

Four candidate optimisations were implemented as experiments and all were rejected on
measurement, including one that the framework's own guard had to be rewritten to test. The
largest real cost found in the stage — **~0.57 µs per extra header** — is spread across the
validation guard, header storage, iteration and `Headers.append`, with no removable share.

The remaining gap to the 6 µs target is in the body read/parse path, not here.

## 1. Method

Three instruments, each answering a different question. Every arm is interleaved across
rounds with the order reversed on alternate rounds; the first two rounds are discarded;
per-run spreads are reported so a delta can be compared against its own noise.

| Instrument | Question | Shape |
| --- | --- | --- |
| **Component ladder** | What does each construction step cost with nothing else in the way? | `createBunContext` + one builder method + `getResponse()`, per-iteration timing, p50/p95 |
| **Primitive A/B** | Is one Web-API form cheaper than another? | Raw `new Response` / `new Headers` variants, per-iteration timing |
| **Full pipeline** | Does any of it survive the real path? | `createHandler(app)` → `handle(request, info)`, bulk-timed 20k dispatches per run, 8 runs, median |

The full-pipeline instrument is deliberately identical to the dev-check gate's in-process
method (`performance.now()` around a bulk run, requests prebuilt because a request is
single-use). It reproduces the gate's POST row: **7.30 µs probe vs 7.39 µs gate**, so the
arm-to-arm numbers below are on the same footing as the budget.

Two instrument corrections were needed and are recorded because they changed the conclusion:

- The first ladder was not order-randomised. It reported `json + status 201` (0.811) as
  *cheaper* than plain `json` (1.376) — physically impossible for a status-only difference.
  An order-randomised rerun resolved it to 0.958 vs 0.837, i.e. status is noise-level. The
  randomised ladder is authoritative; the first is discarded.
- Per-iteration timing produces a GC-dominated tail (p99 ≈ 20 µs against a 2–4 µs p50), which
  makes sub-microsecond arm deltas untrustworthy. All retain/reject decisions use bulk timing.

## 2. Baseline — the six scenarios, full pipeline

GET routes, all through `createHandler(app)` with `bodyParser()` installed exactly as the
gate installs it. 20 000 dispatches per run, 8 runs, median of per-run means.

| Arm | median | min | max | Δ vs json |
| --- | --- | --- | --- | --- |
| `json` | 3.796 | 3.408 | 5.377 | — |
| `text` (`send('ok')`) | 3.679 | 3.171 | 4.099 | −0.117 |
| `json` + 2 headers | 4.866 | 4.270 | 7.036 | **+1.070** |
| `json` + status 201 | 4.037 | 3.059 | 4.529 | +0.241 |
| `json` + `set-cookie` | 4.879 | 3.882 | 5.401 | **+1.083** |
| empty 204 | 3.109 | 2.635 | 3.424 | −0.687 |
| **POST `json` + JSON body 1 KB** | **7.304** | 6.354 | 8.964 | +3.508 |

The architectural control is the gate's own raw floor: a request answered by a bare
`new Response` with no framework is **2.07 µs**. Subtracting it, everything NextRush does for
a GET JSON response is 1.73 µs, and for the POST 5.23 µs.

### 2.1 Cost map, and it closes

| Stage | µs | How established |
| --- | --- | --- |
| Bun handler floor (no framework) | 2.07 | gate `inproc.raw.us` |
| Body read + JSON parse (1 KB) | 3.50 | POST 7.30 − GET 3.80 |
| **Context + response build** | **0.84** | component ladder, confirmed by GET residual |
| Dispatch deadline | 0.50 | gate `inproc.nextrush.no-timeout.us` delta |
| Router + middleware chain | 0.39 | GET residual: 1.73 − 0.84 − 0.50 |
| **Total** | **7.30** | matches the measured POST row |

The Phase 1 report carried "context/response ≈ 2.0 µs" as an estimate from an earlier
architecture review. That estimate was never measured on this path and is wrong by more than
2×. It should not be used for planning again.

## 3. Component evidence

Randomised ladder, p50/p95 µs. These arms isolate construction; they are not additive.

| Arm | p50 | p95 |
| --- | --- | --- |
| `JSON.stringify({ok:true})` alone | 0.209 | 0.313 |
| `new Response(body)` | 0.540 | 1.022 |
| `new Response(body, {headers})` (content-type only) | 0.800 | 1.366 |
| context + `getResponse()` only | 0.490 | 1.267 |
| context + `json` | 0.837 | 2.162 |
| context + `json` + status 201 | 0.958 | 2.094 |
| context + `json` + 2 headers | 1.780 | 3.478 |
| context + `json` + 6 headers | 3.674 | 7.783 |

Reading them together:

- **Context construction is free.** `createBunContext` + an empty response (0.490) lands
  below a bare `new Response` with a string body (0.540). The `RequestInputs`, lazy `raw`,
  lazy `signal`, lazy header map, method-gated body source and separate content-type slot are
  already doing their job.
- **`json()` adds nothing measurable to the Web floor.** 0.837 for serialize + record +
  response, against 0.209 (serialize) + 0.800 (Headers + Response) = 1.009 for the same work
  built by hand. The arms are not additive, so the honest bracket for NextRush's own bookkeeping
  in the response builder is **0 to 0.05 µs**.
- **Nothing is duplicated.** `buildResponse` reads each piece once: status, bodyless check,
  HEAD-only `Content-Length` block, one extras pass, content-type fallback, one `Response`.
  `getResponse` materialises once and caches. `HeaderList.entries()` returns the internal
  array without copying, so the flush loop allocates nothing.

## 4. Per-header cost — the one real cost in this stage

> **Superseded attribution (2026-10-21):** the `+0.788 µs` on the `/set/0` row is a **full dispatch**
> difference between `/set/0` and `/json` — route *and* handler *and* response shape — not matcher
> cost, and it must not be cited as a router figure. A matcher-only probe puts the dynamic-versus-static
> delta at **379 ns** (88% of it the segment-trie walk, 2% the params bag). See
> `report/router/route-params-profile.md` §8.

A single route with the header count supplied by the path, so the only difference between
arms is how many `ctx.set` calls run. 20 000 dispatches per run, 8 runs.

| Arm | median | Δ | marginal |
| --- | --- | --- | --- |
| `/json` (static route, 0 sets) | 3.525 | — | — |
| `/set/0` (dynamic route, 0 sets) | 4.313 | +0.788 | dynamic-route param (router) — **see note below** |
| `/set/1` | 4.882 | +1.358 | first header ≈ 0.57 |
| `/set/2` | 5.052 | +1.527 | +0.17 |
| `/set/4` | 6.093 | +2.568 | +0.52/header |
| `/set/8` | 8.461 | +4.936 | +0.59/header |
| 1 header, 48-char value | 4.313 | +0.788 | length-insensitive |
| 1 `set-cookie` | 4.260 | +0.735 | no special penalty |

**Slope ≈ 0.51 µs per header** across `/set/1` → `/set/8`; the first costs ≈ 0.57. It is a
slope, not a step: the earlier 2-header/1-cookie equality was coincidence, not a threshold.

Attribution, from the primitive and guard probes:

| Piece | µs/header | Removable? |
| --- | --- | --- |
| `Headers.append` per header | 0.17 | No — Web API floor |
| `assertHeaderSafe` (name + value grammar) | 0.12 | No — security boundary, and a faster-looking rewrite measured slower (§5.4) |
| `isContentTypeField` + `toHeaderValue` | ~0.03 | No — required by content-type precedence |
| `HeaderList.set` scan + pair allocation | ~0.05 | No — already allocation-minimal |
| `extraHeaders()` iteration + destructuring | ~0.05 | No — would trade a micro-win for a clarity loss |
| Unattributed (JIT/GC variance) | ~0.15 | — |
| **Total** | **≈0.57** | — |

This cost does not touch the benchmark's POST row (its handler sets no headers), and it is
below the gate's noise floor, so nothing here is retained. It is recorded because it is the
largest genuine per-feature cost in the stage and the correct starting point if
header-bearing responses ever become a target.

## 5. Experiments

Each experiment states its hypothesis, the measurement that decided it, and the verdict.

### 5.1 E1 — plain-object headers instead of a `Headers` instance (REJECTED)

**Hypothesis**: `new Response(body, {headers: {'Content-Type': ct}})` skips the `Headers`
object and the append, saving the 0.26 µs that `Headers` construction costs.

**Measured**: content-type only — object **0.615**, `Headers` instance **0.758–0.800**.
A raw difference of ~0.14 µs. On the full path this is below the run spread (0.79–1.97 µs),
and it had already been tried and rejected once before with an end-to-end delta of
3.655 → 3.603 and a measured +12.2 B allocation per response.

**Verdict**: rejected. Confirmed a second time with a better instrument. Bun builds a
`Headers` internally either way; the object form only avoids the intermediate identity, and
the end-to-end effect is unmeasurable. Do not re-attempt.

### 5.2 E2 — header pairs passed straight to `ResponseInit.headers` (REJECTED)

**Hypothesis**: `ResponseInit.headers` accepts a `string[][]` sequence, so `buildResponse`
could hand its existing entry array to the constructor and delete both `new Headers()` and the
append loop.

**Measured** (raw, p50):

| Form | N=0 | N=2 | N=6 |
| --- | --- | --- | --- |
| `Headers` + append | 0.758 | **0.836** | **1.752** |
| pairs to `Response` | **0.677** | 1.003 | 3.508 |
| `new Headers(pairs)` | — | 1.125 | — |

The sequence form is faster only at N=0, and **2× slower at N=6** (+1.76 µs). The duplicates
question was settled as well: sequence headers do preserve repeated `set-cookie`
(`["a=1","b=2"]`) and do reject an invalid field name, so the form is semantically usable — it
is simply slower.

**Verdict**: rejected. The existing `Headers` + append path is the fastest available Web form.

### 5.3 E3 — `new Headers(pairs)` bulk construction (REJECTED)

**Hypothesis**: constructing from a sequence avoids N incremental append calls.

**Measured**: N=2 — 1.125 vs 0.836 for append. **Verdict**: rejected, slower.

### 5.4 E4 — character-code header validation instead of regex (REJECTED)

**Hypothesis**: `assertHeaderSafe` runs three regex evaluations per header
(`FIELD_NAME_TOKEN`, `FIELD_VALUE_CHARS`, trailing-whitespace). At ~0.12 µs/header and
0.57 µs/header total, it looked like the largest removable share, so a character-code
equivalent was written and differentially tested.

**Correctness first**: a differential over **every BMP code unit** (0x0000–0xFFFF, each as a
field name, a name suffix, and a value), plus empty/whitespace/CRLF/Latin-1-boundary shapes and
array values. The first differential run found a real divergence — the loop accepted an
**empty** field name, while the `+` in the token regex requires at least one character. Fixed
and re-run: **0 mismatches**. The loop is exactly equivalent, including error class and message.

**Measured**: 6 headers per call — shipped **0.653 / 0.696 / 0.824**, loop **0.828 / 0.862 /
0.942**. The regex is **faster** by 0.12–0.17 µs.

**Verdict**: rejected. The regex stays. Bun's JIT handles anchored character classes better
than a hand-written loop, so this idea is not merely unproven — it is a regression.

### 5.5 E5 — removing a dead `Headers.has('Content-Type')` (NOT WORTH IT)

`buildResponse` appends the extras and then checks `!headers.has('Content-Type')` before the
content-type fallback. Because `OutgoingResponse.set` routes every content-type field into its
own slot, the extras list can never contain one, so the check is provably always false.

Removing it saves a single `Headers` lookup — well under 0.05 µs, and below the resolution of
every instrument here. **Verdict**: not worth a code change; recorded as a finding.

## 6. Full-pipeline impact

Nothing changed, so the requirement is that nothing moved:

| Check | Result |
| --- | --- |
| Gate `inproc` | PASS 1, WARN 2, FAIL 0, budgets unchanged |
| `inproc.post.nextrush.us` | 7.39 µs (probe: 7.30) — Phase 1 result holds |
| `inproc.nextrush.no-timeout.us` | timeout race cost 0.50 µs — unchanged |
| Both WARNs | pre-existing (GET vs Hono 1.49, h12 1.36); unchanged by this phase |

## 7. Correctness tests

No source file under `packages/` was modified in this phase. The suites were run to prove the
working tree is still the verified Phase 1 tree:

| Package | Result |
| --- | --- |
| `@nextrush/runtime` | 30 files, **377 tests passed** |
| `@nextrush/body-parser` | 12 files, **314 tests passed** |
| `@nextrush/adapter-bun` | 9 files, **129 tests passed** |
| `@nextrush/adapters/conformance` | 13 files, **436 tests passed** |

Identical counts to the Phase 1 verification run. Node-adapter and Deno suites were not
re-run this phase: the tree is unchanged and no Web-response semantics were touched.

## 8. Phase 1 preservation

- Content-length-gated native text body read: untouched (`body-source.ts`,
  `body-size-guard.ts`, `reader.ts`, `json.ts` unmodified this phase).
- JSON parser composition: not flattened.
- Timeout semantics: untouched — the dispatch deadline still bounds every request, `0.50 µs`
  cost confirmed by the gate.
- Benchmark budgets: unmodified.
- The user's uncommitted benchmark/report work: untouched.

## 9. Rejected ideas, consolidated

| Idea | Why it loses |
| --- | --- |
| Object literal for response headers | Bun builds `Headers` either way; 0.14 µs raw, unmeasurable end-to-end, +12.2 B/response |
| `string[][]` sequence into `ResponseInit.headers` | 2× slower at 6 headers (+1.76 µs) |
| `new Headers(pairs)` | +0.29 µs at 2 headers |
| Char-code header guard | Exactly equivalent (differential clean) but 0.12–0.17 µs slower |
| Remove dead `has('Content-Type')` | Real but <0.05 µs; below instrument resolution |
| Pool/reuse `Headers` across requests | Not safe — a `Response` may retain or copy the instance, and mutation between construction and send would corrupt another response |
| Context object pooling | Contexts escape into handlers and middleware closures by design; pooling would require an ownership contract the public API does not have |

## 10. Remaining bottlenecks and the next recommended experiment

The POST row is 7.30 µs: **2.07 floor + 3.50 body path + 0.84 response + 0.50 deadline +
0.39 router/middleware**. Context/response is 11.5% of the row and ~0.7% of it is framework
logic, so this stage cannot supply the remaining 1.3 µs to the 6 µs target.

**Rank 1 — body read + JSON parse (3.50 µs, 48% of the row).** This is where Phase 1 already
took the biggest win and where the remaining budget is. Next experiment: measure the split
between `request.text()` (I/O settle) and `JSON.parse` for a 1 KB body, and check whether the
parser's depth pre-check (`str.length * 3`) or the `needsBytes` branch is doing avoidable work
on the plain-text path. Requires approval: it touches the Phase 1 body path.

**Rank 2 — dispatch deadline (0.50 µs, 7%).** Already reduced and correctness-bounded; parked
in Phase 1 for lack of a cheaper shape. Not worth revisiting before rank 1.

**Rank 3 — router + middleware (0.39 µs)**, of which a dynamic-route param alone costs
0.788 µs on a lighter request (measured in §4). Out of scope without approval.

## 11. Reproduction

```bash
# component ladder (randomised arms, p50/p95)
cd /tmp/opencode/probe-bun-body && bun run ctx-response-ladder2.ts

# raw header-form A/B + duplicate set-cookie and validation checks
cd /tmp/opencode/probe-bun-body && bun run header-forms.ts

# guard speed + differential over every BMP code unit
cd /tmp/opencode/probe-bun-body && bun run header-guard-ab.ts

# full pipeline, gate methodology
cd /tmp/opencode/probe-bun-body && bun run full-pipeline-bulk.ts

# per-header scaling
cd /tmp/opencode/probe-bun-body && bun run header-scaling.ts

# authoritative gate
cd apps/benchmark && node scripts/dev-check/check.mjs inproc
```

## 12. Findings outside this phase's scope (not fixed, not filed)

| File | Issue | Evidence |
| --- | --- | --- |
| `packages/runtime/src/body-source.ts` | 456 lines; exceeds the 300-line structure cap (pre-existing, 408 before Phase 1) | `wc -l` |
| `packages/router` | a dynamic route parameter costs 0.788 µs against a static route | `/set/0` vs `/json`, §4 |
| `packages/runtime/src/response-builder.ts` | `headers.has('Content-Type')` after the extras loop is unreachable-true | §5.5 |
