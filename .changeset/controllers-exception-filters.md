---
'@nextrush/controllers': minor
---

Controllers now support exception filters. When a route declares `@UseFilter(...)`, the
per-request handler body (guard execution, controller resolution, parameter resolution, method
call, and response) is wrapped in a filter pipeline.

On a thrown error, applicable filters are collected method-level first, then class-level, and the
first filter whose `@Catch` types match (or a no-arg catch-all) is resolved from the DI container
and invoked to set the response. If no filter matches, the error is rethrown unchanged so the
global error middleware handles it — preserving current, filter-free behavior and guard-error
propagation.

Opt-in and non-breaking: a route with no filter produces a handler behaviorally identical to
before (the try/catch wrapper is only installed when at least one filter is present).
