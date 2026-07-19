## 1. Phase 1 — BP-K graceful mid-stream 413 (T2)

- [ ] 1.1 RED adapter test: a chunked over-limit body (no Content-Length) yields a `413` response, and the client does NOT see `ECONNRESET`/socket hang up
- [ ] 1.2 RED test: after the breach no further chunks are buffered (peak bytes bounded near the limit)
- [ ] 1.3 Change `NodeBodySource.buffer()` breach handling: reject with `BodyTooLargeError`, stop consuming (`req.pause()` + detach `data`) instead of an immediate `req.destroy()`
- [ ] 1.4 Adapter error-response path: when the request body was not fully consumed, set `Connection: close` and `res.end()` the error response so Node flushes then closes
- [ ] 1.5 Update the round-1 conformance test to also exercise the streaming (chunked) breach path now that it returns a clean 413 (it currently uses the Content-Length pre-check path to avoid the reset)
- [ ] 1.6 Cross-adapter conformance: over-limit chunked body → `413` on every driver, no connection reset
- [ ] 1.7 Verify: adapter-node + body-parser + conformance suites green; no regression in the existing lifecycle tests (error/close/abort)

## 2. Phase 2 — collapse the body-read async frame (T3a, measurement-gated)

- [ ] 2.1 Capture baseline: allocation micro-bench + pinned POST-JSON A/B (current `reader.ts`)
- [ ] 2.2 Merge `readBody` + `readBodyFromSource` into one async function; behavior-identical (pre-check, `buffer(limit)`, post-check, error mapping)
- [ ] 2.3 Confirm body-parser suite (280) green + `tsc` clean
- [ ] 2.4 Re-measure: allocation delta + pinned POST-JSON A/B. **Keep only if a measurable, non-noise win; otherwise revert** and record the null result

## 3. Phase 3 — response serialization RFC (T3b, gated)

- [ ] 3.1 Author `docs/RFC/request-data/018-response-serialization.md`: opt-in compiled `ctx.json` serializer; evaluate in-house compiler vs Standard-Schema-derived vs optional `@nextrush/serializer` package; decide capability placement (node-adapter vs new `response-serialization`); zero-dep-core constraint
- [ ] 3.2 Micro-bench spike: `JSON.stringify` vs a compiled serializer on the benchmark payload shapes, to size the potential win and justify the RFC
- [ ] 3.3 **Gate:** do NOT implement the serializer in this change — implementation is a separate change opened only after RFC 018 is approved

## 4. Gates

- [ ] 4.1 adapter-node / body-parser / conformance suites green
- [ ] 4.2 `tsc` strict clean; per-package coverage ≥ 90% for touched files
- [ ] 4.3 `pnpm bench:validate` parity holds
- [ ] 4.4 pinned POST-JSON A/B recorded for T3a (kept only if a real win)
- [ ] 4.5 `openspec validate request-response-hotpath-round2 --strict` passes
