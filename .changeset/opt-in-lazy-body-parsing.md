---
'@nextrush/body-parser': minor
'@nextrush/types': minor
'@nextrush/runtime': minor
'@nextrush/adapter-node': minor
'@nextrush/class': patch
'@nextrush/csrf': minor
'@nextrush/validation': patch
'@nextrush/testing': patch
---

Opt-in lazy body parsing: `bodyParser({ lazy: true })` defers the read and the parse until the
application calls `await ctx.readBody()`, so a request whose body is never read costs no body work.

```ts
app.use(bodyParser({ lazy: true }));

app.post('/hooks', async (ctx) => {
  const payload = await ctx.readBody<{ action: string }>(); // the only trigger
  return ctx.json({ received: payload.action });
});
```

Eager parsing remains the default and its behaviour is unchanged: same error codes, statuses,
envelopes, `verify` ordering, and `rawBody` timing.

On a request a lazy parser claimed, `ctx.body` throws `BODY_NOT_READ` until `readBody()` succeeds,
so a missing await fails loudly instead of looking like an empty body. `readBody()` exists in both
modes, reads the stream once, shares an in-flight read between concurrent callers, and caches a
failure for the rest of the request. A write to `ctx.body` (a validation coercion, a terminal
framework write) settles the body: a later `readBody()` returns the written value.

`@nextrush/validation`, `@nextrush/class` guards and `@Body()` parameters, and `@nextrush/csrf`'s
default extractor now consume the body through `readBody()`, so they work in both modes.

**Implementer note (release classification).** `Context.readBody()` is a required member of the
public contract. Applications are unaffected, but a custom `Context` implementation — an external
adapter or a hand-written test double — must add it or stop compiling. Whether that warrants a
major bump of `@nextrush/types` (and, through the fixed group, the whole framework) or a minor
with a documented implementer note is a maintainer call; this changeset proposes minor.

The evidence for the minor reading: every first-party context is either `WebContextBase`-derived (the
Web adapters) or `NodeContext`, and both implement `readBody()` now. No package, example, or guide
implements `Context` from scratch — the adapter documentation describes adapters as extending the
shared base — so the break reaches hand-written test doubles and hypothetical from-scratch adapters,
not applications. Adding a required member to `Context` also has precedent here (`ctx.cookies`,
RFC-034). A major is still defensible if the project treats the interface as an implementable
contract; the difference is a policy decision, not a technical one.

Measured on Bun 1.4.4 with a 1 KB JSON `POST`: an unread lazy request drops from 9.39 µs to
6.45 µs (−31 %); a request that reads pays ~0.4–0.5 µs more than eager. Details in RFC-047 §14.
