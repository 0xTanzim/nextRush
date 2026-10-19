# RFC-042: Fixed-key JSON serialization — rejected by measurement

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Status**           | `Rejected`                                                            |
| **RFC number**       | `042`                                                                 |
| **Date**             | `2026-10-19`                                                          |
| **Author(s)**        | NextRush maintainers                                                  |
| **Group**            | `runtime-adapters`                                                    |
| **Packages touched** | `@nextrush/runtime` (measurement only; no shipped change)             |
| **Framework impact** | `Internal-only`                                                       |
| **Supersedes**       | `—`                                                                   |
| **Superseded by**    | `—`                                                                   |
| **Related**          | `RFC-039`, `RFC-018`, `RFC-041`, `ADR-0028`                           |

---

## Progress Tracker

**Overall:** `[██████████░░░░░░░░░░]` 50% — RFC written, measurement complete; no implementation phase · Doc status: `Rejected`

| Phase | Part / deliverable                                             | Status         |
| ----- | -------------------------------------------------------------- | -------------- |
| P0    | Profile evidence for the fixed-key shape                       | ✅ Done        |
| P1    | Byte-identical prototype and differential tests                | ✅ Done        |
| P2    | Re-measure against `JSON.stringify`                            | ✅ Done        |
| P3    | Ship or reject                                                 | ✅ Rejected    |

---

## 0. Revision History

- **v1 (2026-10-19)** — Initial draft after the RFC-039 P3 gate tripped. Records the prototype,
  its byte-equality tests, and the measured regression that rejects it.

## 1. Summary

RFC-039's P3 gate asks whether response serialization is at least ~5 % of sampled request CPU.
The `inproc-nextrush-large-response` profile measured `JSON.stringify` at **88.1 % self**
(14.69 s of 16.67 s). A fixed-key serializer was built for the measured shape: an array of plain
objects with one key order, whose values are primitives or arrays of primitives, optionally
wrapped in one response object.

The prototype was byte-identical on the differential corpus. It was also **4.4× slower**:
the same profile took **75 s**, with `encodeFixedObjectArray` (25.6 %), `encodeArray` (16.6 % +
13.2 %), `encodeNumber` (8.0 %) and `quote` (7.8 % + 2.3 %) replacing the native path. The
implementation was reverted; `JSON.stringify` remains the only serializer.

## 1a. Terminology

- **Fixed-key shape** — every object in the large array has the same own enumerable string keys in
  the same order.
- **Byte-identical** — `serializeJson(value) === JSON.stringify(value)` for every supported value.
- **Fallback** — the fast path declined the value, so the existing `JSON.stringify` call ran.

## 2. Decision Summary

**Rejected.** Do not ship a JavaScript fixed-key serializer. Native `JSON.stringify` is faster on
Bun 1.4.3 for the only shape the prototype supported, even when the shape is fully known and the
key list is cached. The framework keeps the generic serializer and the existing actionable errors.

## 2a. Decision Drivers

- A serialization optimization must beat the native path it replaces, not merely be byte-equal.
- The measured regression is far outside run-to-run noise (75 s vs 17 s for the same profile run).
- The fast path adds shape checks, a recursion guard and custom escaping — maintenance cost for a
  measured loss.
- RFC-039 P3 permits stopping when the narrow path cannot be justified; shipping a slower path
  would violate the performance contract even though bytes match.

## 3. Problem & Motivation

`ctx.json` calls `JSON.stringify` for every response. A 400-object payload makes that native call
the dominant cost. RFC-039 proposed compiling a serializer from response metadata so the request
path would not re-enumerate a shape it already knows. The P3 profile confirmed the share was large
enough to try, so the proposed optimization was tested rather than assumed.

## 4. Goals & Non-Goals

**Goals**

- Prove byte equality for the fixed-key shape and its fallback cases.
- Measure the prototype against the current serializer under the same profiler.

**Non-Goals**

- Changing `ctx.json`, route metadata or the public API.
- Shipping a serializer that is byte-equal but slower.
- Adding `eval`/`new Function` or a runtime code generator.

## 5. Impact

No shipped code, API, adapter contract or budget changes. The only durable output is this RFC, the
profile files it cites, and the RFC-039 P3 verdict.

## 6. Proposed Solution

The prototype was a recursive encoder in `@nextrush/runtime`:

- accept a large array of plain objects with one cached key order, optionally wrapped in a plain
  response object;
- encode strings with a hand-written escaper matching `JSON.stringify` (quotes, backslashes,
  control characters, lone surrogates, paired surrogate preservation);
- encode finite integers with `String`, other numbers with `JSON.stringify`, non-finite numbers as
  `null`;
- encode arrays of primitives; treat holes, `undefined`, functions and symbols as `null`;
- decline `toJSON`, non-plain objects, differing key orders, non-primitive values, cycles, and
  nesting beyond 12 levels, falling back to `JSON.stringify`.

The differential suite covered property order, escaping, Unicode and lone surrogates, `null`,
negative zero, non-finite numbers, nested arrays, holes, `undefined` properties, `toJSON`, non-plain
objects, circular structures and `BigInt`. It passed.

## 6a. Trade-offs

| Option | Win | Cost |
| --- | --- | --- |
| Native `JSON.stringify` (chosen) | Fastest measured path; zero maintenance; exact semantics by construction | No shape specialization |
| JavaScript fixed-key encoder (rejected) | Byte-identical; shape checks are explicit | 4.4× slower; custom escaping and shape rules must be maintained forever |
| Frozen-payload cache (not proposed) | Large win for repeated immutable payloads | Changes mutation semantics or requires deep-frozen proof; not the RFC-039 shape |

## 7. Architecture

The prototype lived behind `serializeJson` in `@nextrush/runtime`, so both adapter families would
have shared one serializer. It consulted no route metadata and changed no call site. That placement
was correct for the experiment; the experiment is what failed.

## 7a. Architecture Invariants

- `serializeJson` remains the single JSON body path for Web and Node contexts.
- Unsupported values still produce the same typed `TypeError` before the response is committed.
- No per-runtime behavior fork.

## 8. Detailed Design

The measured shape was:

```json
{ "items": [ { "id": 0, "name": "item-0", "tags": ["a", "b", "c"] }, ... ] }
```

The prototype cached the `items` element keys (`id`, `name`, `tags`), checked each element's
`Object.keys` order, and concatenated fragments. That check allocates one key array per element;
the native serializer walks the same objects in optimized C++/native code and does not pay a
JavaScript call per string, number and array.

## 9. Alternatives

- Keep `JSON.stringify` (chosen).
- Compile a serializer only for Tier 3 routes with an `endpoint({ responses })` schema. This was
  not built because the prototype already lost on a fully known shape; adding schema conversion and
  registration plumbing cannot recover the 4.4× gap.
- Reuse a frozen-payload cache. Rejected as a different feature with different semantics.

## 10. Rejected Ideas

- **Per-string `JSON.stringify` calls inside a JavaScript loop.** More native calls, more overhead.
- **Regex-based escaping.** Regex on the serialization hot path is slower and harder to prove
  byte-identical than the explicit character loop.
- **Shipping the prototype behind an opt-in flag.** A slower opt-in serializer is still a slower
  serializer, and the flag becomes permanent surface area.

## 11. Risks

- A future runtime may make JavaScript string building faster relative to native `JSON.stringify`.
  If that happens, re-run the same profile before reviving this RFC.
- The profile measures Bun 1.4.3. Node's serializer was not profiled because the gate tripped on
  Bun and the prototype lost there first.

## 12. Backward Compatibility

Not applicable — no code ships.

## 13. Cross-Cutting Concerns

- **Security:** no change; the existing serializer remains the only path.
- **Portability:** no runtime branch was added.
- **Observability:** no new metrics or logs.

## 14. Success Metrics

The prototype was accepted only if it was byte-identical **and** faster. It was byte-identical and
slower, so it failed the second, decisive metric.

| Metric | Native | Prototype |
| --- | --- | --- |
| Profile wall time | 17 s | 75 s |
| `JSON.stringify` self | 88.1 % | 0 % (not called) |
| Encoder self | — | 25.6 % + 16.6 % + 13.2 % + 8.0 % + 7.8 % + 2.3 % |

## 15. Phased Implementation

- P0 — profile the large-response entry. ✅
- P1 — write differential tests, implement the prototype. ✅
- P2 — re-profile. ✅
- P3 — reject and revert. ✅

## 16. Rollback Plan

The prototype was deleted before this RFC was committed; `serializeJson` was restored to its
pre-experiment form. The profile outputs remain under
`apps/benchmark/scripts/dev-check/.out/prof/` for the change's evidence.

## 17. Future Work

- Re-open only with a new measurement showing a JavaScript encoder beats native `JSON.stringify` on
  the target runtime.
- If response schemas become available at registration for another reason, measure again rather
  than assuming this result transfers.

## 18. Open Questions

- None. The measured result is decisive for the tested runtime and shape.

## 19. Decisions Log

- **2026-10-19** — Reject the fixed-key serializer; keep `JSON.stringify`. Evidence: profile
  `CPU.20261019.194427.573137.0.001.md` (prototype) vs
  `CPU.20261019.193823.569451.0.001.md` (native).

## 20. References

- `docs/RFC/runtime-adapters/039-precompile-per-request-tax.md` §3.2 and §3.10.
- `docs/RFC/request-data/018-response-serialization.md` — the existing serializer decision.
- `apps/benchmark/scripts/dev-check/entries/inproc-nextrush-large-response.ts`.
- `packages/runtime/src/serialize-json.ts`.
