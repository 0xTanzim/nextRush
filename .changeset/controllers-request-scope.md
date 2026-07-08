---
'@nextrush/controllers': minor
---

Controllers: request-scoped DI with scope bubbling

`registerControllers` now supports `@Service({ scope: 'request' })`. It computes
each reachable class's **effective** scope: a class is request-scoped if it —
or any class in its transitive dependency graph — declares `scope: 'request'`
(scope bubbling). Request-effective services are bound to the container's request
(ContainerScoped) lifecycle, and a request-effective controller is resolved from
a fresh per-request child container on every request. Request-scoped instances
are fresh per request and shared within one; singletons stay shared.

Zero new per-request overhead when request scope is not used: a purely-singleton
controller keeps the lazy-memoized singleton path and creates no per-request
child. Works with both the default (shared) container and `isolate: true`.
Guards, interceptors, and filters are unaffected. See
`docs/RFC/RFC-NEXTRUSH-REQUEST-SCOPE.md`.
