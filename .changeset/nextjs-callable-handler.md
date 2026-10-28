---
'@nextrush/adapter-nextjs': minor
'nextrush': minor
---

`handle()` now returns a callable handler set, so a route module can assign each method directly
instead of destructuring one call. Repeated calls with the same app source and equivalent options
share one initialized engine.

```ts
// app/api/[[...route]]/route.ts
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app); // unchanged

// or, one export per method — still one engine
export const GET = handle(app);
export const POST = handle(app);
```

- `handle()` returns `NextRouteHandlerSet` — a function that also carries `GET`…`OPTIONS` as
  properties. All seven names are the same dispatcher reference.
- Handler sets are cached per app source in a `WeakMap`, matched on `timeout` value and `onError`
  identity. A different timeout or error handler gets its own set and engine.
- The cache is weakly keyed, so a discarded app (including a route-module reload under HMR) does
  not leak its engine.
- A failed boot still retries on the next request; the failure is not cached permanently.
- Destructuring is unchanged and remains the recommended single-call form.

`NextRouteHandlerSet` is also re-exported from `nextrush/nextjs`.
