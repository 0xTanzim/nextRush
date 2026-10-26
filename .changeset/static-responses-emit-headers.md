---
'@nextrush/static': patch
---

**Static-file responses now actually carry the headers this middleware sets, and a conditional
request returns `304` instead of an empty `200`.**

**What changes.** `serveStatic()` records `Content-Type`, `ETag`, `Last-Modified`,
`Cache-Control`, `Accept-Ranges`, and `X-Content-Type-Options` through `ctx.set()`, then wrote the
file body with `ctx.raw.res.end(content)`. Recorded headers only reach the socket on the adapter's
flush, so the body arrived and **every header was dropped**: a served file went out with nothing but
`Content-Length`, which browsers answer by sniffing the type, and no validator, which forces a full
re-download of every asset on every request. The small-file body and the `304` are now committed with
`ctx.send()`, the same path every other response takes.

A matching `If-None-Match` also returned `200` with an empty body, because `ctx.status = 304` alone
never reached `res.statusCode`; it now returns a real `304` with its validators.

Two redundant syscalls went with it: the small-file branch called `handle.stat()` on a descriptor
`readFile()` had already fstat'd, purely to maintain a `Content-Length` header that the same branch
never sent.

**Measured.** 36-byte file on the Node adapter, paired A/B on server CPU per request: **143.59 →
126.04 µs (−13.6 %, 3/3 pairs)**, repeated at −12.4 % (3/3) before the `304` fix. The response gained
six headers over the same run. Against a hand-rolled `readFile` + `ctx.send` handler the same file
still costs 2.7× (46 µs), because the middleware additionally `lstat`s for the symlink policy and
`readFile()` issues a second read to reach EOF.

**Known limitation.** Range (`206`) and large-file streamed responses still write through
`ctx.raw.res` and so still land without the recorded headers; carrying them needs an adapter-level
"flush head, then stream" hook, which this package cannot add on its own.

**What does not change.** The public API, options, routing and prefix handling, dotfile and symlink
policy, path containment, `HEAD`/`416` status handling, range parsing, stream timeouts, and the
metadata cache. No dependency changes.
