---
title: Context API
type: topic
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [context, api, dx]
---
# Context API

Unified request/response object (`ctx`) — the framework's DX-first design pillar. Never use raw `req`/`res` directly; always go through `ctx`.

## Input (Request)
- `ctx.method`, `ctx.path`, `ctx.params`, `ctx.query`, `ctx.body`, `ctx.headers`, `ctx.get('header')`
- `ctx.state` — mutable bag for sharing data between middleware

## Output (Response)
- `ctx.status = 201`
- `ctx.json(data)`, `ctx.send(text)`, `ctx.html(content)`
- `ctx.redirect(url)`
- `ctx.set('header', 'value')`

## Middleware
- `ctx.next()` — modern syntax (also supports traditional `(ctx, next) => {...}`)
- `ctx.throw(status, message)` — throws typed HttpError

## Error Handling Pattern
```ts
app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});
```

## Related
- [[topics/architecture]] — error hierarchy detail.
