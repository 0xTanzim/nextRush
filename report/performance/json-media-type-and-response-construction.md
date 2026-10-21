# JSON media type and plain-init-record response construction — measurement record

Question: can the framework's JSON response be built without a per-request `Headers` instance, and
does changing the JSON media type pay for itself?

**Outcome: implemented, measured, kept.** The two changes together are worth **−16.6 % server CPU
per request on Deno GET** and **−8.1 % on Deno POST**, with no regression on Bun or Node. The
JSON media type changes on the wire, which is a breaking change at a major boundary — see
`docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md` and
`docs/adr/ADR-0034-json-media-type-and-response-construction.md`.

Machine: Intel Core i5-8300H (4C/8T, shared; SMT siblings 0↔4, 1↔5, 2↔6, 3↔7). Bun 1.4.3,
Node v26.12.0, Deno 2.9.7. Measurements taken 2026-10-21, load average 1.32 at the start of the
series.

## 1. What changed

| # | Change | File |
| --- | --- | --- |
| 1 | The Web response is built from a plain init record when the recorded response carries no header beyond its content type; the `Headers` path is unchanged for every other response | `packages/runtime/src/response-builder.ts` |
| 2 | The framework's JSON media type is `application/json` (RFC 8259 §8.1 defines no `charset` parameter) | `packages/runtime/src/response-builder.ts`, `packages/runtime/src/response-body.ts`, `packages/adapters/node/src/context.ts`, `packages/adapters/node/src/adapter.ts` |
| 3 | The context's fourteen constructor-assigned fields are declared, so `useDefineForClassFields` stops emitting a per-instance define the constructor overwrites | `packages/runtime/src/web-context-base.ts` |

## 2. The mechanism

Deno's `Response` constructor (`ext/fetch/23_response.js`) has a static fast path. It is entered only
when **all** of these hold:

- `init.status === 200`
- `init.statusText === ""`
- the body is a string or a `Uint8Array`
- `init.headers` is a **plain object** (not a `Headers` instance) with exactly **one** key, named
  `content-type`, whose value is exactly one of `"text/plain"`, `"text/plain;charset=UTF-8"`, or
  `"application/json"`.

The framework satisfied neither of the last two conditions: it passed a `Headers` instance, and its
JSON media type was `application/json; charset=utf-8`.

An isolated probe of the construction alone (`deno run --allow-all --quiet`, 200 000 iterations per
shape, median of five rounds after a 20 000-iteration warmup) prices the four shapes the framework
can produce:

| Construction                              | µs/op | min  |
| ----------------------------------------- | ----: | ---: |
| plain object + `application/json`         | 0.230 | 0.206 |
| plain object + `application/json; charset=utf-8` | 0.674 | 0.658 |
| `Headers` + `application/json`            | 0.962 | 0.937 |
| `Headers` + `application/json; charset=utf-8` (the old path) | 1.019 | 0.986 |
| no headers at all                         | 0.167 | 0.164 |

The old path cost **1.019 µs**; the new one **0.230 µs** — a 4.4× difference in the response
construction, for 0.79 µs per request on Deno.

## 3. The changes are complementary

Measured alone, neither change is worth much. Together they are — because the fast path needs the
plain-object *shape* **and** the accepted *value*.

Deno GET, paired A/B, 3 pairs per arm, median of the per-pair deltas:

| Arm (against the same HEAD baseline)                       | Median Δ | Pairs faster |
| ---------------------------------------------------------- | -------: | -----------: |
| plain init record only (charset kept)                      | −2.14 µs | 3/3          |
| bare media type only (`Headers` path kept)                 | −0.15 µs | 2/3          |
| `declare` on the context fields only                        | +0.33 µs | 1/3          |
| **all three**                                              | **−2.26 µs** | **4/4**    |

The shape change alone still carries the parameterised value, so Deno validates the header list and
re-maps it natively. The bare value alone still arrives inside a `Headers` instance, so the fast
path is never entered.

The `declare` change is **below the measurement floor** in the server A/B. It is kept because it
removes a provably dead per-instance write and no measurement showed it costing anything — not
because it is fast.

## 4. End-to-end results

Paired protocol: server pinned to physical core 0 (sibling 4 idle), `wrk` on physical cores 1 and 3
(siblings 5 and 7 idle), 3 s warmup and 8 s measurement per arm, arms alternating with the order
flipped every pair. The primary metric is the server's own CPU time per request, read from
`/proc/<pid>/stat` (`utime + stime`) and divided by the request count `wrk` reports. The statistic
reported is the **paired delta** per pair — the difference of two medians would be contaminated by
the slow drift between separately-measured arms.

Workloads: GET `/` → `ctx.json({ hello: 'world' })`; POST `/` with a 1 KB JSON body →
`ctx.json({ ok: true })`.

| Runtime | Workload | Before (µs/req) | After (µs/req) | Paired Δ  | Pairs faster | rps Δ   |
| ------- | -------- | ---------------: | --------------: | --------: | -----------: | ------: |
| Deno    | GET      | 14.74           | 12.29           | −2.26 µs  | 4/4          | +16.2 % |
| Deno    | POST     | 44.06           | 40.50           | −3.00 µs  | 4/4          | +8.1 %  |
| Bun     | GET      | 14.13           | 13.37           | −0.33 µs  | 3/4          | +5.0 %  |
| Bun     | POST     | 27.36           | 27.13           | −0.29 µs  | 4/4          | +0.7 %  |
| Node    | GET      | 23.13           | 22.92           | +0.11 µs  | 2/4          | +0.6 %  |
| Node    | POST     | 42.81           | 42.15           | −0.55 µs  | 3/4          | +1.3 %  |

Reading: Deno's win is large and consistent (4/4 pairs, no overlap between the arms' ranges). Bun's
is small but consistently non-negative. Node's GET is inside the noise (2/4 pairs, median +0.11 µs);
its POST is a small consistent win. **No runtime regressed.**

## 4a. The gap to Hono

Same protocol, same session, same workload — NextRush's own bundle against Hono 4.13.0's, built
from the repository's `serve-hono.ts` entry so the route, the body, and the response shape are the
same. Hono's `c.json()` sends `application/json` (bare), which is the value this change moves
NextRush to, so the two now put the same bytes on the wire.

| Runtime | Workload | NextRush at HEAD | NextRush after | Hono | Gap at HEAD | Gap after |
| ------- | -------- | ---------------: | -------------: | ---: | ----------: | --------: |
| Deno    | GET      | 14.65 µs         | 11.07 µs      | 9.69 / 9.13 µs | **1.51×** | **1.21×** |
| Bun     | GET      | —                | 12.98 µs      | 11.22 µs | —         | 1.16×    |
| Deno    | POST     | —                | 38.66 µs      | 25.13 µs | —         | 1.54×    |

(The two Hono GET readings are two separate sessions — 9.69 µs in the HEAD session, 9.13 µs in the
after session — which is why the gaps are computed within a session rather than across them.)

The Deno GET gap to Hono closed from **1.51× to 1.21×**: roughly 45 % of the framework's overhead
over the baseline is gone, on the runtime where the platform's fast path was being missed. The POST
gap (1.54×) is untouched by this change — body reading, not response construction, is what dominates
there.

## 5. Why the media type is the right value

- **RFC 8259 §8.1** registers `application/json` with no parameters. JSON is UTF-8 by definition, so
  a `charset` parameter is one the specification does not define.
- **The ecosystem majority sends the bare value.** Hono 4.13.0 (`c.json()` →
  `application/json`), Express 5.2.1 (`res.json()` → `application/json`), and Fastify 5.11.2
  (`application/json; charset=utf-8`). Two of the three compared frameworks — including this
  repository's primary benchmark baseline — already send the bare value.
- **The archived F-05 rule pinned the parameterised value only because adapters had drifted.** Edge
  and Bun's server-level error path emitted a bare `application/json` while the shared helper emitted
  the parameterised form. Routing every adapter through one shared helper that emits the bare value
  keeps the uniformity and removes the drift.

## 6. Verification

- `packages/runtime` — 382/382.
- `packages/adapters/node` — 301/301.
- `packages/adapters/bun` + `packages/adapters/deno` — 252/252.
- `packages/adapters/edge` + `serverless` + `nextjs` — 477/477.
- `packages/adapters/conformance/src` — 436/436.
- Real-runtime conformance — Bun 56/56 (`bun test`), Deno 56/56 (`deno task conformance`), `workerd`
  16/16 (`node --test conformance.workerd.test.mjs`).
- The two `bun-runner` / `deno-runner` files fail to load under the **root** vitest config
  (`Cannot find package 'bun:test'`, `Deno is not defined`). This is pre-existing and expected:
  they are native-runtime runners, excluded by the conformance package's own vitest config
  (`include: ['src/**/*.test.ts']`), and they resolve `@nextrush/*` through `dist/`. They pass when
  run the way CI runs them.

## 7. Rejected candidates

| Candidate | Measured | Verdict |
| --- | --- | --- |
| `pairs` construction (`headers: [['content-type', v]]`) | 0.674 µs/op on Deno (not a plain object, so no fast path); Node +127 B in the archived spike | Rejected: cannot enter the fast path, and Node's worst default shape |
| Runtime-branching construction (literal on Deno, `Headers` elsewhere) | would take the fast path everywhere | Rejected: AGENTS.md §4 forbids behaviour that depends on runtime identity |
| Send both `application/json` and a `charset` parameter | — | Rejected: a media type no client expects, and it re-enters the slow path |
| `text/plain; charset=utf-8` → bare `text/plain` | Deno's fast path accepts `"text/plain"` | Deferred: the RFC 8259 argument does not apply to text, and it is a separate wire change |
| Static-file MIME table (`.json` → `application/json; charset=utf-8`) | — | Deferred: a different surface (a served file, not a generated response), with no evidence attached |

## 8. Reconciliation with the earlier investigation

`web-response-materialization.md` recorded a **revert** of the plain-init-record change. That verdict
is not contradicted, and it is not simply replaced — the two records cover different runtimes:

- The earlier pass measured **Bun** wall-clock throughput (`inproc` µs, noise-bound) and **Bun/Node
  allocation bytes** from the archived spike. Its Bun allocation objection is real: the literal
  allocates **+12.2 B** more than the `Headers` instance on Bun.
- It never measured **Deno**, where the platform's fast path exists and where the change is worth
  −16.6 % of a request's CPU.

The new measurement answers the Bun question the earlier pass could not: the +12 B allocation
produces **no CPU regression** on Bun (−0.33 µs/req, 3/4 pairs faster) and none on Node. The
allocation delta is real and below the CPU floor. That file's verdict is corrected to say so.

## 9. Limitations

- The machine is shared. Wall-clock throughput alone swings ~40 % between runs; only the paired CPU
  metric resolves these effects. The absolute numbers in §4 are valid only for this box, on this
  day, with this load.
- The `declare` change's effect is below the measurement floor. It is justified structurally, not
  statistically.
- The measurement covers a GET and a 1 KB JSON POST. A raw-body POST, a streaming response, and a
  multi-header response were not re-measured end-to-end for this change; the conformance suite
  covers their behaviour, and the response construction they reach is the same two paths.
- Bun's wire throughput and the Bun-vs-Hono ratio are untouched by this change beyond the ~5 %
  measured above; the framework's remaining Bun gap is in the request path, not the response.

## 10. Reproduction

```bash
# 1. build the paired bundles (before = HEAD source, after = working tree)
bash /tmp/opencode/ab/build-bundles.sh serve-nextrush

# 2. one arm per change, for attribution
node /tmp/opencode/ab/compose-arm.mjs serve-nextrush literal
node /tmp/opencode/ab/compose-arm.mjs serve-nextrush media
node /tmp/opencode/ab/compose-arm.mjs serve-nextrush declare

# 3. the paired measurement
node /tmp/opencode/ab/ab.mjs --rt deno --before serve-before.js --after serve-after.js \
  --pairs 4 --duration 8 --warmup 3 --out res-deno.json

# 4. the paired-delta statistic
node /tmp/opencode/ab/paired.mjs res-deno.json res-bun.json res-node.json

# 5. the construction-shape probe
deno run --allow-all --quiet /tmp/opencode/deno-resp-probe.ts
```

Raw data: `/tmp/opencode/ab/res-*.json` (per-pair rows for every run in this report), the harness
(`ab.mjs`, `compose-arm.mjs`, `build-bundles.sh`, `paired.mjs`), and the bundles themselves
(`serve-before.js`, `serve-after.js`, `serve-nextrush-{literal,media,declare}.js`). The bundles are
built from **source** through `apps/benchmark/scripts/dev-check/lib/build.ts`, which aliases
`@nextrush/*` to `packages/**/src/index.ts`; the "before" arm restores the six changed source files
to their `HEAD` content for the build only — never a stash, reset, or checkout of the working tree.
