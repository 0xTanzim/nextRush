# NextRush Runtime Certification Matrix

> **Generated — do not edit by hand.** Regenerate with
> `pnpm --filter @nextrush/adapter-conformance cert:matrix`.
> Derived from the capability profiles (`capabilitiesFor()`) and the
> cross-adapter conformance driver flags — the same data the conformance
> suite asserts. A capability regression drops the affected runtime here.

Legend: ✅ full · ⚠️ partial (different model) · ➖ not applicable by design · ❌ unsupported

| Feature | node | bun | deno | edge | serverless |
| --- | --- | --- | --- | --- | --- |
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
