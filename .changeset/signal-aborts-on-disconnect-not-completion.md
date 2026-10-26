---
'@nextrush/adapter-node': minor
---

**`ctx.signal` on Node now stays un-aborted when a request completes normally, and every stream
response is ~22 % cheaper.**

The Node adapter wired the request signal to both `req` and `res` `'close'`. A normal response also
emits `'close'` after it finishes, and a fully received request is also destroyed when the connection
tears down — so the signal aborted on *every* completed request, not just abandoned ones. The
`'close'` handlers now check premature-close state: `res` counts as a disconnect only without
`writableFinished`, `req` only without `complete`.

- **What changes:** a handler that reads `ctx.signal` after a normal response (or after
  `await ctx.stream(...)` resolves) observes `aborted === false`. A real client disconnect —
  mid-stream, mid-body, or before the response — still aborts exactly as before, and the
  backpressured-pump settle contract is unchanged.
- **Why:** the old wiring made the signal lie about client abandonment, and the abort teardown it
  forced on every completed stream cost ~8.4 µs of server CPU per streamed response (paired,
  order-flipped, wrk `-t2 -c64`, Node 26: 39.55 → 31.17 µs CPU/req median, −21.9 %, 7/7 pairs;
  16-chunk streams 52.00 → 45.46 µs, −14.7 %).
- **If you relied on it:** clean up in the code after `await ctx.stream(...)` or in a `finally`
  block instead — that path always ran on normal completion anyway. For disconnect-only work, guard
  on `ctx.signal.aborted`.

Also in this change: a request body that arrives as a single chunk — which every body up to ~64 KB
does over a normal socket — is returned without a `Buffer.concat` copy, since Node's HTTP parser
allocates each `data` chunk in its own exactly-sized backing buffer. Measured −5.2 % CPU/req on
16 KB POSTs (53.47 → 50.59 µs, 6/7 pairs); bytes, limits, and error semantics are unchanged.
