---
'@nextrush/controllers': minor
---

Controllers now support interceptors. When a route declares `@UseInterceptor(...)`,
the per-request handler wraps the controller-method call in an interceptor onion
after guards, controller resolution, and parameter resolution.

Class interceptors are the outermost layers and method interceptors are inner
(closest to the handler); each interceptor is resolved from the DI container. An
interceptor may transform the returned value (its return value replaces the
result that flows into `@HttpCode` / `@SetHeader` / `@Redirect` / `ctx.json`
handling) and may wrap `next()` in try/catch to observe or recover from handler
errors. An unhandled interceptor error propagates and is catchable by a
`@UseFilter` exception filter, which wraps the whole handler.

Opt-in and non-breaking: a route with no interceptor invokes the method directly,
behaviorally identical to before.
