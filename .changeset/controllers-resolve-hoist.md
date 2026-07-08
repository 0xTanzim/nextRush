---
'@nextrush/controllers': patch
---

Controllers: resolve each controller instance once per route handler instead of on every request.

Controllers are always registered as singletons, so the previous per-request
`container.resolve()` on the hot path was redundant wrapper overhead. Resolution is now
lazy-memoized inside the handler closure: resolved on the first request (so a `validate: false`
opt-out still defers DI resolution to request time), cached on success, and retried on failure
(a failed resolve keeps throwing `ControllerResolutionError` until it succeeds). Guards still
execute per request. No observable behavior change.
