---
'@nextrush/types': minor
---

Types: add `'request'` to the `Scope` union

`Scope` is now `'singleton' | 'transient' | 'request'`. The new `'request'`
lifecycle models one instance per request, shared within that request (backed
by a per-request child container). Additive and non-breaking — `singleton` and
`transient` are unchanged. See `docs/RFC/RFC-NEXTRUSH-REQUEST-SCOPE.md`.
