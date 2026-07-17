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

Legend: ✅ full · ⚠️ partial (different model) · ➖ not applicable by design · ❌ unsupported

| Feature | node | bun | deno | edge | serverless |
| --- | --- | --- | --- | --- | --- |
| **Proof** | **🟢 real-runtime** | **🟢 real-runtime** | **🟢 real-runtime** | **🟢 real-runtime** | **🟡 simulated** |
| Request | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ |
| AbortSignal | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Cookies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multipart | ✅ | ✅ | ✅ | ✅ | ✅ |
| SSE | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compression | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSockets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shutdown | ✅ | ✅ | ✅ | ➖ | ➖ |
| Timeouts | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| **Coverage** | **95%** | **100%** | **100%** | **100%** | **94.4%** |

## Notes

- **Timeouts** — ⚠️ for `node`: enforced at the socket level (`server.timeout`),
  not a 504. Bun/Deno/Edge/serverless race the handler and return 504 (F-08).
- **AbortSignal** — ⚠️ for `serverless`: the platform delivers a buffered event,
  so there is no mid-request transport abort; `ctx.signal` still fires on timeout.
- **Shutdown** — ➖ for `edge`/`serverless`: no server lifetime, so extension
  `destroy()` never runs (F-14). Excluded from coverage rather than scored as a failure.
- **Proof (`serverless`)** — 🟡 simulated here because its real deployment runtime
  IS Node (Lambda/GCF/Azure all run Node); real-runtime coverage for that target
  is `node`'s own row, not double-counted as a second real-runtime proof.
