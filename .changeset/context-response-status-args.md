---
'@nextrush/types': minor
'@nextrush/runtime': minor
'@nextrush/adapter-node': minor
---

`ctx.json()`, `ctx.html()` and `ctx.send()` accept a second argument: a numeric status or a
`ResponseOptions` object.

```ts
ctx.json({ users });                                    // unchanged
ctx.json({ id: 'u_123' }, 201);
ctx.json({ id: 'u_123' }, { status: 201, headers: { Location: '/users/u_123' } });
```

- An explicit status overrides the carried `ctx.status` for that response and is recorded back onto
  it, so post-handler middleware (logging, metrics) sees the status that was actually sent.
- Accepted statuses are integers 200-599; anything else throws a `RangeError` before the response is
  committed.
- Supplied headers merge with recorded headers: an ordinary field overrides its earlier value,
  `Set-Cookie` accumulates, an array replaces then appends, and a supplied `Content-Type` wins over
  the helper's automatic media type. `Content-Length` is derived from the body and is rejected.
- `ctx.status = code` is unchanged and remains supported.

Behavior fix included: an explicitly recorded `Content-Type` now wins over a body method's default
media type in both orders, which is the behavior the adapter contract already documented.
