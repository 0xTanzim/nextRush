# Design — JSON media type and plain-init-record response construction

Governing documents: `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md`
and `docs/adr/ADR-0034-json-media-type-and-response-construction.md`.

## The finding

`buildResponse` in `packages/runtime/src/response-builder.ts` constructed every Web response as
`new Response(body, { status, headers })` where `headers` was a freshly allocated `Headers`
instance, populated by `append` for each recorded extra header, then `has`/`set` for the content
type. For the dominant response shape — a JSON body and nothing else — that instance is pure
per-request garbage.

Deno's `Response` constructor (`ext/fetch/23_response.js`) has a static fast path. It is entered
only when **all** of the following hold:

- `init.status === 200`
- `init.statusText === ""`
- the body is a string or a `Uint8Array`
- `init.headers` is a **plain object** (not a `Headers` instance) with exactly **one** key, named
  `content-type`, whose value is exactly one of `"text/plain"`, `"text/plain;charset=UTF-8"`, or
  `"application/json"`.

The framework satisfied none of the last two: it passed a `Headers` instance, and its JSON media
type was `application/json; charset=utf-8`.

## Decision 1 — one media type, the bare one

Every framework-generated JSON response carries `application/json`.

**Why the bare value.** RFC 8259 §8.1 registers `application/json` with no `charset` parameter;
JSON is UTF-8 by definition, so a parameter that says so is noise the RFC does not define. The
archived F-05 conformance rule required the parameterised value only because adapters had drifted —
Edge and Bun's server-level error path already emitted bare `application/json` while the shared
helper emitted the parameterised form. Routing every adapter through one shared helper that emits
the bare value preserves the uniformity the rule protected while removing the drift.

**Why it is not a compatibility regression in disguise.** Of the frameworks this repository
benchmarks against, Hono 4.13.0 (`c.json()` → `application/json`) and Express 5.2.1 (`res.json()` →
`application/json`) already send the bare value; only Fastify 5.11.2 sends the parameterised form.
The change moves the framework toward the majority convention and toward its own primary
comparison baseline, not away from it.

## Decision 2 — the plain init record, with the `Headers` path kept

When the recorded response carries no header beyond its content type, the builder passes a plain
init record. Any additional header — including the HEAD `Content-Length` the builder itself adds —
falls back to the unchanged `Headers` path.

**Why the fallback is mandatory.** The archived spike
(`openspec/changes/archive/2026-10-19-bun-response-cost/design.md`, D8) measured that both Bun and
Node *silently join a repeated field* supplied through an object literal: `{'Set-Cookie': ['a','b']}`
becomes the single header `a,b`. The plain init record is therefore only ever used when there is
exactly one header to carry, and the multi-value path keeps the `Headers` instance that preserves
each entry.

## Decision 3 — the two changes are complementary, and are kept together

Measured alone, neither change is worth much. Together they are.

| Arm (Deno, GET, paired CPU µs/request) | Median Δ | Pairs faster |
| --- | ---: | ---: |
| plain init record only (charset kept) | −2.14 | 3/3 |
| bare media type only (`Headers` kept) | −0.15 | 2/3 |
| both | −2.26 | 4/4 |

The reason is structural: the fast path needs the plain-object *shape* **and** the accepted *value*.
The plain init record alone still carries the parameterised value, so Deno validates the header
list and re-maps it natively. The bare value alone still arrives inside a `Headers` instance, so
the fast path is not entered. Only the pair satisfies both conditions.

An isolated Deno probe of the four construction shapes confirms the mechanism independently of the
server measurement:

| Construction | µs/op (median of 5 rounds) |
| --- | ---: |
| plain object + `application/json` | 0.230 |
| plain object + `application/json; charset=utf-8` | 0.674 |
| `Headers` + `application/json` | 0.962 |
| `Headers` + `application/json; charset=utf-8` | 1.019 |
| no headers at all | 0.167 |

## Decision 4 — `declare` on the context's constructor-assigned fields

`WebContextBase` declares fourteen fields that its constructor assigns. With
`useDefineForClassFields` (ES2022, on via `tsconfig.base.json`), a bare `field;` declaration emits a
per-instance define of `undefined` that the constructor immediately overwrites. Marking those
fields `declare` removes the dead write.

This change is **below the measurement floor** in the server A/B (median Δ +0.33 µs on Deno GET,
faster in 1 of 3 pairs). It is kept because it is a structural fix with an unambiguous mechanism —
a dead per-instance write removed — and no measurement showed it costing anything; the campaign's
rule is to reject a candidate that regresses, not to reject one that is unmeasurable.

## Rejected alternatives

- **Runtime-branching on Deno.** Keeping the `Headers` path on Bun/Node and the literal on Deno
  would take the fast path on every runtime. Rejected: AGENTS.md §4 forbids behaviour that depends
  on runtime identity, and the portability rule in RFC-041's own terms prefers one construction that
  is non-negative everywhere over a faster construction on one runtime.
- **The `pairs` construction** (`headers: [['content-type', value]]`), which the archived spike
  measured as the best Bun allocation shape (−10.9 B). Rejected: a sequence init is not a plain
  object, so it cannot enter Deno's fast path; it also loses Node's `default` shape by +127 B.
- **Keeping `application/json; charset=utf-8` and taking only the plain init record.** Rejected: it
  gives up the fast path entirely (0.674 µs against 0.230 µs per construction) and keeps a media
  type RFC 8259 does not define.
- **A `charset` alias header** (sending both `application/json` and a `charset` parameter) to keep
  old clients working. Rejected: it produces a media type no client expects and re-enters the slow
  path.

## Risks

| Risk | Mitigation | Likelihood | Impact |
| --- | --- | --- | --- |
| An application asserts the exact `application/json; charset=utf-8` string | Documented as a breaking change with a migration note in the changeset and RFC §12; the value is now the same on every adapter, so a single assertion update fixes all of them | Low | Low |
| The plain init record silently drops a repeated header | The path is taken only when the recorded response has zero extra headers; the multi-value path is unchanged and covered by the multi-`Set-Cookie` conformance scenario | Low | High |
| A future change reintroduces a `Headers` instance on the hot path | The conformance scenario pins the media type, and the campaign's report pins the measurement | Low | Medium |

## Measurement protocol

Server pinned to physical core 0 (sibling 4 idle), `wrk` on physical cores 1 and 3 (siblings 5 and 7
idle), 3 s warmup and 8 s measurement per arm, arms alternating with the order flipped every pair.
The primary metric is the server's own CPU time per request, read from `/proc/<pid>/stat`
(`utime + stime`) and divided by the request count `wrk` reports; wall-clock rps is secondary
because it swings ~40 % between runs on this shared machine. The reported statistic is the **paired
delta** per pair, not the difference of two medians — the paired delta cancels the slow drift that
separates two separately-measured arms.

Raw data and the harness: `/tmp/opencode/ab/` (`ab.mjs`, `compose-arm.mjs`, `build-bundles.sh`,
`paired.mjs`, `res-*.json`). The bundles are built from **source** through
`apps/benchmark/scripts/dev-check/lib/build.ts`, which aliases `@nextrush/*` to
`packages/**/src/index.ts`; the "before" arm is produced by restoring the six changed source files
to their `HEAD` content for the build only, never by stashing or resetting the working tree.
