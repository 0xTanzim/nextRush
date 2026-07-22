# NextRush Runtime Certification Matrix

> **Generated — do not edit by hand.** Regenerate with
> `pnpm --filter @nextrush/adapter-conformance cert:matrix`.
> Derived from the capability profiles (`capabilitiesFor()`) and the
> cross-adapter conformance driver flags — the same data the conformance
> suite asserts. A capability regression drops the affected runtime here.

> **Proof level.** The `Proof` row states whether that column's result comes
> from execution on the REAL runtime (a separate real-runtime runner:
> `bun-runner/`, `deno-runner/`, `workerd-runner/`, or the native Node driver)
> or from the in-process driver SIMULATION (`drivers/web-driver.ts`, which
> always runs under Node/vitest regardless of which target it simulates).
> Only 🟢 `real-runtime` rows back a "proven" claim in public docs — see
> `docs/audits/08-runtime-compatibility-gap-analysis.md`.

> **Real-runtime breadth (F-01, ADR-0010).** Even among `real-runtime` columns,
> HOW MUCH of the shared behavioral contract each real runner actually proves
> differs: `full-suite` means it runs the identical `defineConformanceSuite`
> the in-process driver runs (Bun/Deno run their real binary IN-PROCESS with
> the test, so the suite's per-case closures work normally — a behavior added
> to the suite automatically runs there too). `curated-subset` means only a
> hand-picked assertion set could be proven — workerd is a genuinely SEPARATE
> isolate reached only over HTTP via miniflare, so the suite's closures cannot
> cross that boundary; widening it needs a data-driven driver contract, an
> RFC-gated decision this change does not make unilaterally.

Legend: ✅ full (executed assertion) · ⚠️ partial (different model) · 🔷 capability-only (no executed assertion, F-02) · ➖ not applicable by design · ❌ unsupported

| Feature | node | bun | deno | edge | serverless |
| --- | --- | --- | --- | --- | --- |
| **Proof** | **🟢 real-runtime** | **🟢 real-runtime** | **🟢 real-runtime** | **🟢 real-runtime** | **🟡 simulated** |
| **Real-runtime breadth** | **🟢 full-suite** | **🟢 full-suite** | **🟢 full-suite** | **🟠 curated-subset** | **➖ n/a** |
| Request | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ |
| AbortSignal | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Cookies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multipart | 🔷 | 🔷 | 🔷 | 🔷 | 🔷 |
| SSE | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compression | 🔷 | 🔷 | 🔷 | 🔷 | 🔷 |
| WebSockets | 🔷 | 🔷 | 🔷 | 🔷 | 🔷 |
| Shutdown | ✅ | ✅ | ✅ | ➖ | ➖ |
| Timeouts | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Coverage** | **70%** | **70%** | **70%** | **66.7%** | **61.1%** |

## Notes

- **Timeouts** — ✅ full on every runtime (F-04/ADR-0010): Node now races the
  handler against `timeout` and returns a clean 504, cancelling via `ctx.signal`,
  the same contract Bun/Deno/Edge/serverless already used. `server.timeout`
  remains an independent socket-level slow-client guard on Node, unaffected.
- **Multipart / Compression / WebSockets** — 🔷 capability-only (F-02): support
  is inferred from a `capabilitiesFor()` bit, not an executed cross-adapter
  conformance assertion — the adapters implement no multipart parser, no
  response-compression, and no WebSocket-upgrade path today. Not counted as
  `full`/proven; add a real conformance assertion to graduate a feature out of
  this state (as Streaming/SSE did — see `#20` in `suite.ts`).
- **AbortSignal** — ⚠️ for `serverless`: the platform delivers a buffered event,
  so there is no mid-request transport abort; `ctx.signal` still fires on timeout.
- **Shutdown** — ➖ for `edge`/`serverless`: no server lifetime, so extension
  `destroy()` never runs (F-14). Excluded from coverage rather than scored as a failure.
- **Proof (`serverless`)** — 🟡 simulated here because its real deployment runtime
  IS Node (Lambda/GCF/Azure all run Node); real-runtime coverage for that target
  is `node`'s own row, not double-counted as a second real-runtime proof.
