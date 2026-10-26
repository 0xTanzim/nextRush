# Bun Body Read and JSON Parse — Phase 3

**Scope**: the 3.50 µs body-read + JSON-parse stage identified in Phase 2, split into
unavoidable and reducible work.
**Runtime**: Bun 1.4.3, Node v26.12.0, i5-8300H (4C/8T), Linux x64.
**Tree**: verified Phase 1 state. **No source file was modified in this phase.**

## 0. Outcome

**No optimisation survives measurement.** Every candidate that could be implemented without
changing semantics is below the noise floor: the total reducible arithmetic across all of them
is **~0.2 µs**, spread over items that each measure 0.00–0.08 µs individually.

The stage is not dominated by avoidable logic. It is:

| Portion | Cost | Nature |
| --- | --- | --- |
| `JSON.parse` | 0.60–1.00 µs | semantics — irreducible |
| `request.text()` | 0.53 µs in-process, 4.83 µs on a socket | transport — irreducible |
| body-source construction (2 header lookups) | 0.22–0.33 µs | irreducible for a body-bearing request |
| UTF-8 limit guard | 0.08 µs | security boundary |
| depth pre-check + walk | ≤0.10 µs, not distinguishable from zero | already correct, already cheap |
| **Fixed async/middleware/GC overhead** | **≈2.5 µs** | architectural, not body-parse work |

The single most useful result is a **correction of what the in-process number means**: on a
real Bun socket the 1 KB read costs 4.83 µs, and `text()` beats `arrayBuffer()` at every size
measured. The in-process gate understates the read, and it is not the read that needs work.

## 1. Method

Same three-instrument discipline as Phase 2, plus a socket instrument this phase required.

| Instrument | Question |
| --- | --- |
| **Primitive bulk** | What does one operation cost with nothing around it? |
| **Pipeline bulk** | Does it survive the middleware chain, router and response build? |
| **Socket** | What does the same read cost when bytes actually cross a socket? |

Bulk timing (one `performance.now()` per run of 10 000 dispatches, 6 runs, median of per-run
means) with arm order reversed on alternate runs and the first two rounds discarded. Bodies are
1 KB (`{"name":"x"…"}`, 1023 bytes), limit 1 MiB, `Content-Length` present and honest.
Body-bearing requests are single-use, so each arm prebuilds `warmup + count` and consumes each
exactly once; constructor work is outside the timer where it is not the subject.

**In-memory vs socket is stated for every read result**, because they differ by an order of
magnitude and only the socket number is user-visible.

## 2. Experiment 1 — separating the costs

### 2.1 In-memory (1 KB, limit 1 MiB, µs)

| Arm | median | [min..max] |
| --- | --- | --- |
| `JSON.parse(string)` | **1.001** | [0.776..2.127] |
| `exceedsUtf8Limit(text, limit)` | 0.083 | [0.060..0.156] |
| `JSON.parse` + depth walk | 0.926 | [0.701..1.229] |
| `request.text()` | **0.527** | [0.335..0.723] |
| `request.arrayBuffer()` | 1.161 | [0.930..1.417] |
| `WebBodySource.readTextIfProvenWithin` (Phase 1 path) | 1.134 | [0.813..1.276] |
| `readBodyText` (parser wrapper) | 1.315 | [0.975..1.786] |
| `readBody` + decode (byte fallback) | **3.569** | [3.189..3.927] |
| Full pipeline POST | 8.901 | [8.265..10.613] |

The Phase 1 path arm includes constructing `WebBodySource` (measured separately at
0.218–0.330, of which 0.162 is the two `request.headers.get()` calls). Subtract it and the
text path itself is `0.53 (text) + 0.08 (guard) + cache ≈ 0.85 µs`, against **3.57 µs** for
the byte fallback. That gap is the Phase 1 win, confirmed here rather than assumed.

`parse + walk` (0.926) is not measurably above `parse` alone (1.001) — see Experiment 2.

### 2.2 Real socket (server-side, body read only, `Bun.nanoseconds()`, 3 000 samples × 3 runs)

| Mode | p50 | p95 | p99 |
| --- | --- | --- | --- |
| `text()` 1 KB | **4.832** | 8.939 | 23.516 |
| `arrayBuffer()` 1 KB | 6.370 | 15.107 | 32.953 |
| `text()` 64 KB | 25.299 | 43.113 | 104.133 |
| `arrayBuffer()` 64 KB | 32.527 | 70.173 | 482.201 |

Three things follow:

1. **The in-process read (0.53 µs) is not the socket read (4.83 µs).** In process, the body is
   already a JS string; on a socket, `await req.text()` waits for the byte stream. Any
   conclusion about read cost drawn from the in-process gate alone would be wrong in both
   direction and magnitude.
2. **Read cost scales with bytes** — 0.32 µs/KB at 1→64 KB — so it is real work, not a fixed
   overhead.
3. **`text()` beats `arrayBuffer()` at both sizes** (−1.54 µs at 1 KB, −7.23 µs at 64 KB).
   Phase 1 chose the text path on in-process evidence; it is also the right choice on the wire.

### 2.3 What is unavoidable

`JSON.parse` and the transport read are the stage. Neither can be removed without changing what
the framework does. `JSON.parse(str, reviver)` with `reviver === undefined` is identical to
`JSON.parse(str)` across three runs (0.647/0.661, 0.756/0.636, 0.601/0.723) — no specialised
call is worth adding.

## 3. Experiment 2 — the depth pre-check

### 3.1 The arithmetic

`maxDepth` defaults to **64**, so the guard walks when `depthCheckBytes >= 2 * (64 + 1) = 130`.
In the text path `depthCheckBytes = str.length * 3`, the UTF-8 upper bound.

| Body | `str.length * 3` | Walk runs? | Actually needed? |
| --- | --- | --- | --- |
| < 44 ASCII chars | < 130 | no | no — depth ≤ 22 |
| 44–129 ASCII bytes | ≥ 130 | **yes** | **no** — depth ≤ 64, exactly at the limit |
| ≥ 130 bytes | ≥ 130 | yes | depends; a 1 KB body can reach depth 512 |
| multibyte | ≥ 3 × chars ≥ bytes | yes | never under-triggers |

So the bound never misses a required walk, and over-triggers only in the 44–129 byte band.
The benchmark body (1023 bytes) is never in that band: its walk is genuinely required by the
semantics, because 1023 bytes can encode depth 511 > 64.

### 3.2 The cost, with the same parser on both sides

| Arm (identical `json()` parser, 1 KB body) | median | [min..max] |
| --- | --- | --- |
| walk **on** (default `maxDepth` 64) | 7.645 | [6.703..11.263] |
| walk **off** (`maxDepth: Infinity`) | 7.903 | [6.101..9.191] |
| `bodyParser()` combined | 7.311 | [7.079..8.639] |
| `json()`, **100 B** body (walk unavoidably on) | 7.235 | [6.179..9.104] |

Turning the walk off is **not faster** — it measures slower, i.e. inside the spread. The walk is
therefore **not distinguishable from zero** at this resolution; the primitive arms bound it at
≤0.10 µs for a one-object body.

An earlier arm in this phase appeared to show a 1.37 µs walk cost. That was an instrument
error: the "walk off" arm used `json()` while the baseline used `bodyParser()`, so the delta
was middleware composition, not the walk. The table above holds the parser fixed. Recorded
because it is exactly the kind of attribution mistake this phase exists to avoid.

### 3.3 Is there a semantics-preserving alternative?

Yes, one, and it is not worth taking. When the text path is used, `Content-Length` is present
and honest, so the **exact byte count** is available and tighter than `str.length * 3`:

- Structural bytes are ASCII brackets, two per nesting level, so `bytes >= 2 * depth`.
- Decoding cannot create brackets, so a lossy decode cannot hide depth.
- Therefore `contentLength >= 2 * (maxDepth + 1)` is a sound and tighter trigger.

It would skip the walk for 44–129 byte ASCII bodies — where the walk costs ≤0.10 µs and those
bodies are already the cheapest requests. **Rejected as below noise.** The guard stays as it is;
nothing here justifies touching a security control.

### 3.4 Behaviour matrix

| Input | Result |
| --- | --- |
| ASCII 1 KB | walk runs, depth 2, accepted |
| multibyte UTF-8 | bound is ≥ actual bytes, walk runs, accepted |
| escaped strings | escaped bytes are ordinary bytes; bound still conservative |
| deeply nested (>64) | walk throws `jsonDepthExceeded` as before |
| malformed JSON | `JSON.parse` throws before the guard; mapped to `invalidJson` |
| 44–129 bytes | walk runs unnecessarily; accepted; ≤0.10 µs |

## 4. Experiment 3 — `needsBytes`

### 4.1 Which shapes read bytes

`needsBytes = rawBody || verify !== undefined`. The text path is taken only when all of these
hold, otherwise the code falls back to the incremental byte reader:

| Shape | Path | Verified |
| --- | --- | --- |
| default JSON, honest CL ≤ limit | **text** | yes |
| `rawBody: true` | bytes | +7.07 µs over an unread body |
| `verify` configured | bytes | +6.52 µs |
| `encoding !== 'utf-8'` | bytes, then UTF-8 decode | shape matrix |
| no `Content-Length` (chunked) | bytes, limit enforced incrementally | shape matrix |
| `Content-Length > limit` | rejected before any read | `entityTooLarge` |
| understated `Content-Length` | text path (in-memory), limit check still applies | see 4.3 |
| empty body, `CL: 0` | text path, `''`, parser returns without parsing | shape matrix |
| repeated read | `BodyConsumedError` → `BodyParserError` | see §8 |

### 4.2 The cost of the branch

The branch itself is a cached boolean OR of two closure constants — **no measurable cost**.
The cost is in *taking* the byte path:

| Arm (1 KB body) | median | Δ vs unread |
| --- | --- | --- |
| GET /json (no body) | 3.510 | +0.004 |
| POST, body unread, no parser | 3.506 | — |
| POST, `json()` text path | 8.010 | +4.504 |
| POST, `json({ rawBody: true })` | 10.580 | **+7.074** |
| POST, `json({ verify })` | 10.024 | **+6.518** |
| POST, `bodyParser()` | 8.333 | +4.827 |

The byte path costs **+2.57 µs** over the text path for the same request. That is the correct,
documented price of needing bytes, and it is the reason the text path exists.

Note also: **a POST whose body is never read costs the same as a GET** (3.506 vs 3.510), so
there is no hidden POST-specific context cost.

### 4.3 Shape matrix results

| Case | Observed |
| --- | --- |
| empty body, `CL: 0` | `ok len=0` — parser returns without parsing |
| missing `Content-Length` | `ok len=1023` — byte fallback, incremental limit |
| understated `CL: 10`, actual 1023 | `ok len=1023` **in memory**; `exceedsUtf8Limit` still bounds it |
| over-limit `CL` | rejected: `Request body too large (1048577 bytes exceeds 1048576 byte limit)` |
| `encoding: 'latin1'` | text path declines, falls back — see §8 |
| repeated read | `BodyParserError: Error reading request body` — see §8 |

The understated-`CL` row is worth stating precisely: **in memory, headers do not frame a body**,
so the declared length is not enforced by the platform. The safety proof therefore rests on two
layers — transport framing on a real socket (verified against a live `Bun.serve` in Phase 1:
declared 10, sent 50 → exactly 10 bytes reached the handler) and `exceedsUtf8Limit` here. The
in-memory harness exercises only the second. Neither is redundant.

## 5. Experiment 4 — candidates, each measured alone

| # | Candidate | Work eliminated | Measured | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Lazy `WebBodySource.contentType` | one `request.headers.get()` per request | 0.058–0.133 µs | **reject** — below noise; adds a getter to a public readonly field |
| 2 | Hoist `needsBytes` to factory scope | one boolean OR per request | not measurable | **reject** — below noise |
| 3 | Exact `Content-Length` in the depth guard | walk on 44–129 byte bodies | walk ≤0.10 µs | **reject** — below noise; §3.3 |
| 4 | `JSON.parse(str)` when no reviver | one argument pass | no difference across 3 runs | **reject** |
| 5 | Native `request.json()` instead of text + parse | the intermediate string | run A: 1.333 vs 1.453; run B: 1.526 vs 1.316; socket 6.216 vs 6.078 | **reject** — run-to-run sign disagreement; plus semantic regression (below) |
| 6 | Skip `exceedsUtf8Limit` when `CL ≤ limit` | 0.083 µs | 0.083 µs isolated | **reject** — below noise, and it weakens the decoded-size bound in the `[limit/3, limit]` band |
| 7 | Flatten one async frame in `readBodyText` | one promise + microtask | wrapper adds 0.18 µs total | **reject** — below noise |

**Why #5 is rejected on semantics as well as speed.** `readTextIfProvenWithin` populates
`_cachedText`, and `buffer()` deliberately re-encodes that cache so a byte read *after* a text
read still observes the body. Parsing via `request.json()` would leave `_cachedText` unset, so a
later `buffer()` would throw `BodyConsumedError` instead of returning the bytes — a
compatibility regression for `rawBody`/`verify`-style consumers and for `ctx.bodySource.buffer()`
called after parsing. It would also drop `reviver` support. Not a candidate.

## 6. Where the stage actually goes

Isolated parts sum to ~2.0 µs. The pipeline measures +4.50 µs for the same parser. The gap is
fixed per-request overhead, not parse work:

- A 100 B body costs 7.235 vs 7.645 for 1 KB — **10× the bytes moves the request by 0.41 µs**.
  So the per-byte slope is ~0.41 µs/KB and the fixed body-path cost is ~4.1 µs.
- That fixed cost is the extra middleware layer and its `await` chain, the promise settlement
  for a body-bearing dispatch, and GC pressure from the parsed object graph. Component
  microbenchmarks run at lower allocation pressure than the pipeline, so they understate the
  marginal cost — the same effect Phase 1 recorded as "component times are not additive".

None of that is body-parse logic, and none of it is removable without changing middleware
semantics or the async contract. It is the real explanation for why this stage cannot be cut
further by editing the reader or the parser.

## 7. Verification

No source file changed. Suites were run to prove the tree is still the verified Phase 1 tree:

| Package | Result |
| --- | --- |
| `@nextrush/runtime` | 30 files, **377 tests passed** |
| `@nextrush/body-parser` | 12 files, **314 tests passed** |
| `@nextrush/adapter-bun` | 9 files, **129 tests passed** |
| `@nextrush/adapters/conformance` | 13 files, **436 tests passed** |

Gate: **PASS 1 / WARN 2 / FAIL 0**, budgets unmodified
(`apps/benchmark/scripts/dev-check/budgets.json` untouched).

**Gate drift, stated because it affects how the number should be read.** The gate run at the end
of this phase reported POST 8.56 µs, against 7.39 earlier the same session. Nothing in the tree
changed between them. The whole run drifted together — raw floor 2.07 → 2.21, Hono 2.99 → 3.17,
GET 4.47 → 5.31 — so this is machine state (thermal/load), not a regression: the POST ratio
moved only 1.89 → 1.94. Every comparison in this report is interleaved inside one process, so
none of it depends on cross-run absolutes.

## 8. Findings outside this phase's scope

| Location | Finding | Evidence |
| --- | --- | --- |
| `reader.ts` repeated-read mapping | A second `readBodyText` yields `BodyParserError: Error reading request body`, not the specific "Body has already been consumed" the catch block intends. The `err.name === 'BodyConsumedError'` comparison appears not to match the thrown class's `name`. | shape matrix, §4.3 |
| `reader.ts` fallback decode | When `encoding !== 'utf-8'`, `readTextIfProvenWithin` correctly declines, but the fallback in `readBodyText` decodes with `UTF8_DECODER` regardless of `options.encoding`. JSON is UTF-8 per RFC 8259, so the parser is right; the mismatch is only visible if a caller sets a non-UTF-8 encoding and expects it honoured. | `encoding: 'latin1'` → `ok len=1023` |
| `body-source.ts` | 456 lines, over the 300-line structure cap (pre-existing; 408 before Phase 1) | `wc -l` |

Neither is a Phase 3 regression and neither was changed.

## 9. Recommendation for the next phase

**Do not run another body-path phase.** The arithmetic is exhausted: everything left in the
reader and parser is either semantics, security, or ≥0.08 µs.

The POST row now decomposes as **2.2 floor + 4.5 body stage + 0.84 context/response + 0.50
deadline + 0.39 router/middleware**. Of the 4.5, ~2.0 is explained components and ~2.5 is fixed
async/GC overhead.

Rank 1, if the 6.0 µs target is still wanted: **attribute the ~2.5 µs fixed overhead** with
turn-level tracing of a body-bearing dispatch (how many promise turns between handler entry and
body availability, and what each costs), then decide whether a composed-middleware design change
is justified. That is an architectural decision, needs approval, and is not a micro-optimisation.

Rank 2: the two error-mapping findings in §8, as a small correctness change.

Anything that games the in-process gate — for example special-casing preconstructed requests —
would not move the socket number at all: the read is 4.83 µs there and the gate already
understates it.

## 10. Reproduction

```bash
# Experiment 1, in-memory cost split
cd /tmp/opencode/probe-bun-body && bun run body-cost-split.ts

# Experiment 1, socket read cost (1 KB and 64 KB, text vs arrayBuffer)
cd /tmp/opencode/probe-bun-body && bun run body-socket2.ts

# Experiment 2, walk on/off with the same parser, plus regressions in the bound
cd /tmp/opencode/probe-bun-body && bun run depth-walk.ts

# Experiment 3, needsBytes pipeline decomposition and shape matrix
cd /tmp/opencode/probe-bun-body && bun run needs-bytes.ts

# Experiment 4 #5, native request.json()
cd /tmp/opencode/probe-bun-body && bun run native-json.ts

# suites and gate
cd packages/runtime && npx vitest run --maxWorkers=2
cd apps/benchmark && node scripts/dev-check/check.mjs inproc
```
