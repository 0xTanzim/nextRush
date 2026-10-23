---
'@nextrush/runtime': minor
'@nextrush/adapter-node': minor
'@nextrush/adapter-bun': minor
'@nextrush/adapter-deno': minor
'@nextrush/adapter-edge': minor
'@nextrush/adapter-serverless': minor
'@nextrush/adapter-nextjs': minor
'nextrush': minor
---

**The framework's default text media type is now written `text/plain;charset=UTF-8`** — no space
after the separator, upper-case charset value — instead of `text/plain; charset=utf-8`.

**What changes.** Exactly one header value, on the responses the framework types for you: `ctx.send()`
with a string or primitive, and the `text/plain` body `ctx.redirect()` sends by default. It is the
same value on every adapter, including Node's native response path, so cross-adapter output stays
byte-identical to itself.

**Why.** Deno's `Response` constructor has a static fast path for a small set of exact literals.
`text/plain;charset=UTF-8` is one of them; the conventional `text/plain; charset=utf-8` spelling is
not, and pays for header-list validation plus a native re-map on every response. Priced in isolation
on Deno 2.9.7, constructing the response costs **612 ns with the old spelling and 197 ns with this
one**. `application/json` was already corrected for the same reason; `text/plain` was the remaining
common media type outside the fast path.

**Migration.** Applications that _parse_ the media type are unaffected. RFC 9110 §5.6.1 makes the
whitespace around `;` insignificant, and the charset value was already case-insensitive, so this is
the same media type — not a new one. Only an **exact-string** comparison needs updating:

```diff
- expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
+ expect(res.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
```

One assertion update covers every adapter, because they all emit the same value.

**What does not change.** The status, the body bytes, `Content-Length`, the header set and ordering,
multi-value `Set-Cookie`, `application/json`, `text/html`, the redirect status and `Location`, and
`ctx.stream()`/SSE/NDJSON defaults (the stream package sets its own media types and is untouched).
Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes, UTF-8
handling, response commitment, caching, streaming, timeouts, and error mapping are all untouched.
`text/html` keeps the conventional spelling deliberately: it has no fast path to enter (measured 622
vs 602 ns on Deno — noise), so changing it would be wire churn with nothing behind it.

**Why the bump is minor, not major.** Semantically the two spellings are the same media type, so no
client that parses `Content-Type` can observe a difference. The bump signals a wire-visible byte
change in case a consumer asserts the exact string — the same class of change as the earlier
`application/json` one, which was released as a major because it also _removed_ a parameter. A
maintainer who considers exact-string assertions part of the contract can promote this changeset to
`major` before release; no code change is needed.

**Measured.** Deno text workload, paired A/B on server CPU per request: median **−2.3 %** over 7
pairs (mean −4.3 %, 5/7 pairs faster), consistent with the −415 ns at the `Response` boundary.
Bun neutral (median +0.1 %, 2/4) and Node neutral (+0.8 %, 1/2) — neither has a matching fast path,
and neither is expected to move. Full numbers, harness, and the rejected alternatives are in
`report/performance/campaign-scoreboard.md` §9.
