# Subsystem Analysis — Body Parser

**Playbook phase:** Part 4 §4.17 (Body Parser). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (POST JSON
−28.9% at 256c, and notably below-parity at 1c unlike most other scenarios) ·
[`../04-root-cause-analysis.md`](../04-root-cause-analysis.md) (Hypothesis priority 3) ·
[`../05-solution-engineering.md`](../05-solution-engineering.md) (conditional body experiment).

## Purpose

The body-parser subsystem reads and buffers an incoming request body, then decodes/parses it
(JSON, in the benchmarked scenario) before handing a typed value to application code.

## Present design

**Confirmed (structure):**
- `NodeBodySource.buffer` enforces the configured content-length limit, installs `data`/`end`/
  `error`/`close` listeners plus settlement and cleanup closures, collects incoming chunks as
  `Buffer`s, and calls `Buffer.concat` once all chunks have arrived. The result is **cached** (a
  second read of the body does not re-buffer), and abort/413 (payload-too-large) behavior is
  preserved throughout.
- The JSON body-parser middleware performs, per request: a method/body-presence/content-type
  guard, a `readBody`-limit check, decode, `JSON.parse`, and strict validation. It **only** runs a
  depth-traversal scan **when the payload size could plausibly exceed `maxDepth`** — it is not an
  unconditional scan on every request.
- **This investigation does not claim the depth scan runs for the benchmark's specific POST JSON
  payload** — whether the benchmark payload is large/deep enough to trigger that conditional path
  is unverified; asserting it does would be exactly the kind of unproven claim this investigation's
  evidence rules forbid.

## Benefits of the present design

- Per-request listener/settlement/cleanup closures are the standard, correct way to consume a
  Node.js readable stream (`req`) safely — buffering without them risks missed `error`/`close`
  events and resource leaks on abort.
- Caching the buffered result means a handler that reads the body more than once (directly or via
  multiple middleware) does not pay the buffering cost twice.
- Content-length enforcement and 413 behavior are explicit input-validation/DoS-prevention
  properties (`engineering-standards.md` — "never trust external input"; `project-rules.instructions.md`
  §3 — body parsing enforces size limits), not optional hardening.
- Making the depth-traversal scan conditional (only when size could exceed `maxDepth`) avoids
  unconditional O(depth) work on every small payload — a deliberate cost-avoidance design, not an
  oversight.

## Structural costs

The buffering path installs multiple listeners and closures per request specifically for bodies
that have content (POST JSON, in this benchmark) — work that scenarios without a body (Hello,
JSON [GET], Route Params, Query, Deep Route, Empty) do not incur at all. This is consistent with
POST JSON being the one scenario that is **already below parity at 1 connection** (unlike most
other like-for-like scenarios, which are ahead or near-tied at 1c per
[`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §5) — a pattern distinct from the
"gap appears only at concurrency" story that fits Hello/Empty/JSON/Route Params/Deep Route/Large
JSON.

## Evidence status

| Claim | Status |
| --- | --- |
| `NodeBodySource.buffer` installs per-request listeners/closures, enforces limits, caches, preserves abort/413 | **Confirmed** (source structure) |
| Body parser's depth scan is conditional on payload size vs. `maxDepth`, not unconditional | **Confirmed** (source structure) |
| The depth scan actually executes for the benchmark's POST JSON payload | **Not established** — explicitly not claimed by this investigation |
| POST JSON is below parity even at 1 connection, unlike most other like-for-like scenarios | **Confirmed** (benchmark data, `../01-benchmark-analysis.md` §5) |
| Body-buffering/parsing work is the cause of POST JSON's 1c and scaling-regime gaps | **Hypothesis** — plausible given POST JSON is the only body-bearing like-for-like scenario, but not profiled |

## Finding

### F-BODY-01 — POST JSON is the only like-for-like scenario below parity at 1 connection; body-buffering/parsing contribution is a testable but unmeasured hypothesis

- **Status/confidence:** Structure Confirmed; performance impact Hypothesis.
- **Priority:** P1 — third-ranked hypothesis in [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md),
  ranked above middleware/context/response specifically because it is the only hypothesis with a
  **1-connection signal** (most other gaps only appear under concurrency, which points toward
  shared/scaling-sensitive costs like the adapter timeout machinery instead; POST JSON's low-
  concurrency deficit points at request-specific work instead).
- **Current situation/evidence:** See "Present design" and "Structural costs" above. POST JSON is
  the only like-for-like scenario carrying a request body, and the only like-for-like scenario
  behind raw Node.js even at 1 connection (`../01-benchmark-analysis.md` §5).
- **Present-design benefits:** correct stream consumption, result caching, size-limit/413 DoS
  protection, conditional (not unconditional) depth scanning.
- **Root cause:** Unknown — could be the listener/closure setup cost, `Buffer.concat`, JSON.parse
  itself (shared with every framework and unlikely to be NextRush-specific), or the validation
  step; no profile isolates any of these against current code.
- **Runtime/performance impact:** Unknown.
- **Recommendation:** No source change. Capture a CPU + allocation profile of the POST JSON
  scenario specifically (P1 in [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md),
  conditional on P0 provenance work landing first).
- **Alternatives:** If profiling isolates meaningful cost, first evaluate safe single-chunk/empty-
  Buffer fast paths (e.g. skipping `Buffer.concat` entirely when the body arrives in exactly one
  `data` event) while preserving limits, abort handling, result caching, 413 behavior, and
  cross-runtime semantics (the body-source abstraction is used by non-Node adapters too, per
  `architecture.instructions.md`'s runtime-independence mandate).
- **Trade-offs:** Not assessed — no solution proposed yet.
- **Risks:** A single-chunk fast path that silently skips a limit check or 413 path would reopen a
  DoS vector this subsystem currently closes — any future change here needs explicit test coverage
  for the multi-chunk, oversized, and abort cases, not just the fast-path happy case.
- **Expected improvement:** Unknown — this investigation's decision threshold for a route/body
  candidate is ≥3% scenario-specific RPS improvement (POST JSON specifically), non-overlapping/
  noise-aware, no regression in limit/413/abort behavior (see
  [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md)).
- **Migration difficulty:** Not assessed — no change proposed.
- **Validation:** Full matrix in [`../06-validation-regression.md`](../06-validation-regression.md).

## Edge cases (playbook §4.9)

Bodies exceeding `maxDepth`-triggering size, malformed JSON, missing/incorrect `Content-Type`,
and client abort mid-body are all structurally handled per the guards described above, but none
are separately benchmarked for performance. Their performance characteristics under load are
Unknown.
