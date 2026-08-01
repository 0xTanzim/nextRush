# Subsystem Analysis — Response

**Playbook phase:** Part 4 §4.16 (Response). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (Large JSON
gap narrows relative to Hello/Empty) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md).

## Purpose

The response path takes application-produced output (an object for `ctx.json`, or a string/
buffer/stream for `ctx.send`) and writes it to the underlying Node `ServerResponse`.

## Present design

**Confirmed (structure):**
- `NodeContext.json` performs, in order: `JSON.stringify`, `Buffer.byteLength` (to compute
  `Content-Length`), response-header construction, `writeHead`, and `end`.
- `NodeContext.send` is a broader surface than `json` — it supports strings, buffers, typed arrays,
  `ArrayBuffer`, Node streams, Web streams, and plain objects, and implements backpressure handling
  and client-disconnect handling for the streaming cases.

## Benefits of the present design

- Computing `Content-Length` via `Buffer.byteLength` up front (rather than chunked/unknown-length
  encoding) lets the response avoid `Transfer-Encoding: chunked` overhead for the common
  JSON-response case, and gives clients an accurate length immediately.
- Supporting the full range of body types in `send` (buffers, typed arrays, streams — both Node and
  Web) means one API surface handles both small synchronous responses and large streamed responses
  without a separate "streaming mode" the developer must opt into, consistent with the framework's
  DX-first Context API design (`architecture.instructions.md`).
- Explicit backpressure and disconnect handling in the streaming path is a correctness property
  (a client that disconnects mid-stream, or a slow client that isn't draining the socket, must not
  leak memory or crash the process) — not incidental.

## Structural costs

`JSON.stringify` plus a separate `Buffer.byteLength` pass over the resulting string is two full
passes over the serialized payload size (stringify, then byte-length), rather than a single
combined pass — a structural fact about the `json` path specifically. Whether this two-pass
structure is measurable at benchmark scale, or negligible relative to the write itself, is
unmeasured.

## Evidence status

| Claim | Status |
| --- | --- |
| `ctx.json` performs stringify → byteLength → header construction → writeHead → end | **Confirmed** (source structure) |
| `ctx.send` supports the full body-type surface with backpressure/disconnect handling | **Confirmed** (source structure) |
| The two-pass stringify/byteLength structure is a meaningful contributor to any scenario's gap | **Hypothesis/Unknown** — not profiled |
| Large JSON's narrower gap (−11.3% at 256c) vs. Hello/Empty (−18.1%/−25.1%) reflects response-write/serialization cost becoming proportionally *less* significant as payload grows | **Hypothesis** — plausible reading of the benchmark pattern, but the same pattern is equally consistent with fixed per-request overhead (adapter/context/router) mattering relatively less as payload grows, which is the reading already adopted in [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §4. This file does not adopt a preference between the two readings — both are Hypothesis. |

## Finding

### F-RESPONSE-01 — Response serialization/write path structure is confirmed; its share of any scenario's gap is unmeasured, and no scenario isolates it as a variable

- **Status/confidence:** Structure Confirmed; performance impact Unknown.
- **Priority:** Not one of the top 3 ranked hypotheses (see [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)) — grouped under "middleware/context/response contributions are Unknown."
- **Current situation/evidence:** See "Present design" above. The Large JSON scenario's narrower
  gap is the only benchmark signal that touches this subsystem, and it is at least as well
  explained by the fixed-overhead-dilution reading already used for the adapter/context/router
  hypotheses as by anything specific to serialization. No scenario varies response-serialization
  cost while holding the rest of the request path constant.
- **Present-design benefits:** accurate `Content-Length`, unified small/streamed body API,
  backpressure/disconnect safety (see above).
- **Root cause:** Unknown.
- **Runtime/performance impact:** Unknown.
- **Recommendation:** No action. This investigation's constraints explicitly state serializer
  replacement is not justified by current data — this finding concurs and extends that to the
  broader response-write path. If P0 profiling (`../07-optimization-roadmap.md`) surfaces
  serialization/write as a visible CPU frame in the Hello or Large JSON profile specifically, open a
  dedicated finding at that point.
- **Alternatives:** Not evaluated — no problem statement exists yet.
- **Trade-offs:** Not applicable.
- **Risks:** None from inaction.
- **Expected improvement:** Unknown.
- **Migration difficulty:** Not applicable.
- **Validation:** Not applicable until a profile produces a finding to validate.

## Edge cases (playbook §4.9)

Streaming responses (Node/Web streams), client disconnect mid-stream, and very large response
bodies beyond the benchmark's "Large JSON" scenario size are structurally handled per the
backpressure/disconnect logic described above, but are not separately benchmarked. Their
performance characteristics under load are Unknown.
