# Subsystem Analysis — Serializer

**Playbook phase:** Part 4 §4.18 (Serialization). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (JSON,
Large JSON, POST JSON scenarios) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md) ·
[`response.md`](./response.md) (the write path this feeds into).

## Purpose

JSON serialization converts application-level values into the byte payload written to the
response. This is distinct from the response-write mechanics covered in [`response.md`](./response.md)
— this file covers the serialization step itself (`JSON.stringify` and its inputs), while
`response.md` covers what happens to the resulting string on its way to the socket.

## Present design

**Confirmed (structure, cross-referenced from [`response.md`](./response.md)):** `NodeContext.json`
calls `JSON.stringify` on the application-supplied value, then `Buffer.byteLength` on the result to
compute `Content-Length`, before proceeding to header construction and the write. NextRush uses the
built-in V8 `JSON.stringify` — there is no custom or third-party serializer in the observed path
(no serialization library dependency is declared for `core`/`router`, consistent with the
zero-dependency-functional-core claim in `README.md`).

## Benefits of the present design

- Using the built-in `JSON.stringify` avoids adding a runtime dependency for serialization,
  consistent with the framework's zero-dependency functional-core design goal
  (`README.md` — "Zero-Dependency Functional Core") and the repo's dependency-minimization rule
  (`project-rules.instructions.md` §6).
- V8's `JSON.stringify` is a heavily optimized, widely-battle-tested implementation shared by every
  competing framework in this benchmark (raw Node, Fastify, Hono, Koa, Express all ultimately call
  the same V8 primitive for a plain-object JSON response) — it is not a framework-specific
  differentiator by construction, which is directly relevant to whether it is a plausible
  explanation for a NextRush-specific gap.

## Structural costs

None identified beyond the two-pass stringify/byteLength structure already documented in
[`response.md`](./response.md) — this file does not duplicate that finding, only cross-references
it, per this investigation's instruction to avoid copying long content across reports.

## Evidence status

| Claim | Status |
| --- | --- |
| NextRush uses V8's built-in `JSON.stringify`, no custom/third-party serializer | **Confirmed** (source reading — no serializer dependency observed in the response path) |
| `JSON.stringify` cost is shared across every framework in this benchmark for equivalent payloads | **Confirmed** (structural fact — all compared frameworks are Node.js frameworks using the same V8 runtime primitive for a JSON response) |
| Serialization is a meaningful, NextRush-specific contributor to the JSON/Large JSON/POST JSON gaps | **Not supported by current evidence** — because the primitive is shared across all compared frameworks, a NextRush-specific serialization cost would have to come from something *around* the `stringify` call (input shape, extra passes), not the `stringify` call itself, and no profile isolates that either |

## Finding

### F-SERIALIZER-01 — No current evidence supports a serializer-focused optimization; the shared-primitive structure makes it an unlikely differentiator versus the alternatives already ranked

- **Status/confidence:** Structure Confirmed; not ranked as a priority hypothesis.
- **Priority:** Not one of the top 3 ranked hypotheses (see [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)).
  This investigation's constraints are explicit that "serializer replacement is not justified by
  the current data," and this finding is the reasoned basis for that constraint, not a restatement
  of it.
- **Current situation/evidence:** See "Present design" and "Evidence status" above.
- **Present-design benefits:** zero added dependency, shared/optimized V8 primitive (see above).
- **Root cause:** Unknown, but structurally de-prioritized: since every compared framework pays the
  same `JSON.stringify` cost for an equivalent payload, a NextRush-specific gap is more plausibly
  explained by NextRush-specific work surrounding the call (context construction, response-header
  assembly, the adapter timeout machinery already ranked #1) than by the call itself.
- **Runtime/performance impact:** Unknown, and not expected to be the dominant factor given the
  shared-primitive reasoning above — this is a structural argument, not a measurement, and is
  labeled accordingly.
- **Recommendation:** Do not evaluate a serializer replacement (e.g. a faster JSON library) as part
  of this investigation's roadmap. If P0/P1 profiling unexpectedly shows `JSON.stringify` itself
  (not surrounding code) as a disproportionate CPU frame relative to competing frameworks under
  identical payloads, revisit — but that would be a new, distinct finding requiring its own
  evidence, not an extension of this one.
- **Alternatives:** Not evaluated — the shared-primitive reasoning above already argues against
  prioritizing this path; no alternative serializer is proposed.
- **Trade-offs:** Not applicable — no change proposed.
- **Risks:** Investing effort here would be the "overengineering the wrong subsystem" failure mode
  — a serializer swap is exactly the kind of visible-but-unjustified change this investigation's
  governance is designed to prevent.
- **Expected improvement:** Unknown; not applicable, no experiment proposed.
- **Migration difficulty:** Not applicable.
- **Validation:** Not applicable — no change proposed.

## Edge cases (playbook §4.9)

Non-plain-object values passed to `ctx.json` (e.g. values with custom `toJSON`, circular
references, very large arrays) are handled by `JSON.stringify`'s own semantics and are not
separately benchmarked. Their performance characteristics are Unknown and are not expected to
differ from any other Node.js framework using the same primitive.
