---
'@nextrush/validation': minor
'@nextrush/errors': minor
---

`validate()` exposes coerced query/params and accepts a failure status.

```ts
const Query = z.object({ limit: z.coerce.number().int().min(1).default(50) });

app.get('/items', validate({ query: Query }, { errorStatus: 422 }), (ctx) => {
  const { query } = validated(ctx);  // { limit: number } — coerced
  ctx.json({ limit: query.limit });
});
```

- **Coerced query/params are no longer discarded.** They are written to `ctx.state.validated` and
  read back with the new `validated(ctx)` accessor, which returns `{}` when no `validate()` ran so a
  destructure never throws. Only targets that were configured *and* passed appear. Nothing is written
  on failure, so the existing atomicity guarantee holds.
- `ctx.query` and `ctx.params` are still left unmodified. They are declared as string maps, so writing
  a coerced number back would make the type disagree with the runtime. The coerced values live on
  `ctx.state` (which is `unknown`-valued) instead.
- **`ValidationError` accepts an optional status**, defaulting to `400`, so `new ValidationError(issues)`
  is unchanged for every existing caller. `validate(arg, { errorStatus })` threads it through.
- The error `code` stays `VALIDATION_ERROR` at any status: the code names the kind of failure, the
  status names its class. A `422` validation failure still aggregates every issue across every target.

- **`errorStatus` is validated at construction** and must be an integer 400-499, so a typo throws a
  `RangeError` at startup instead of producing an invalid status at request time. Without this guard an
  out-of-range value reached `res.writeHead()`, whose asynchronous `ERR_HTTP_INVALID_STATUS_CODE` is an
  uncaught exception that takes the whole process down — a config typo became a remote DoS.
- **Stacking `validate()` on one route merges** the coerced targets instead of the second call
  clobbering the first, so `validate({ params })` then `validate({ query })` keeps both.
- **A `body` schema without a body parser now names the real cause.** Previously a request that carried
  a body but had no parser installed failed with "expected object, received undefined", which blames the
  schema. It now throws an error naming the missing `bodyParser()`; the client still receives an opaque
  5xx and the developer gets the cause in the log.
- **A misspelled or unknown schema target is rejected at construction.** `validate({ querys: Schema })`
  used to validate *nothing* and silently pass every request through — the worst failure mode for a
  validation middleware, because it looks like it works. Unknown keys, and targets whose value is not a
  Standard Schema, now throw a `TypeError` naming the offending key. An empty map stays a documented
  pass-through.
