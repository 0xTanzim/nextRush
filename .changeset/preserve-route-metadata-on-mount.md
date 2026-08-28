---
'@nextrush/router': patch
---

Routes mounted via `mount()`/`use(prefix, router)` now preserve their route metadata: request schemas from `validate()` and inline docs from `endpoint()` survive the copy, so `getRoutes()` (and `@nextrush/openapi`) documents mounted routes exactly like directly registered ones. Internal representation change only — no public API change, and the dispatch hot path is unaffected (verified by the hot-path guard suite and a CPU-pinned interleaved A/B benchmark). Implements the RFC-002 v5 amendment (mount-time metadata preservation).
