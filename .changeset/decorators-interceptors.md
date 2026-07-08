---
'@nextrush/decorators': minor
---

Add interceptor decorators: `@UseInterceptor` and the `Interceptor` interface.

`Interceptor` is a class-based, Promise-based around-advice hook
(`intercept(ctx, next)`): it runs code before calling `next()`, awaits the
downstream result, and may transform or replace it. `@UseInterceptor(...interceptors)`
attaches interceptor classes at the controller or method level (mirroring
`@UseGuard` / `@UseFilter`). New metadata readers `getClassInterceptors`,
`getMethodInterceptors`, and `getAllInterceptors` (class-then-method onion order)
expose the metadata to the controllers runtime. The `INTERCEPTORS` metadata key
was reinstated in `DECORATOR_METADATA_KEYS`.

Additive and opt-in — no existing behavior changes.
