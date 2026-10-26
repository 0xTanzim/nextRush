---
'@nextrush/runtime': minor
'@nextrush/adapter-bun': patch
'@nextrush/adapter-deno': patch
'@nextrush/adapter-edge': patch
---

**A request that declares a non-empty body arms its handler deadline immediately instead of
spinning four microtask turns first; a bodyless request keeps the window.**

**Why the window was there, and why it no longer helps this shape.** The Web runner gives a dispatch
a bounded number of microtask turns (`SETTLE_TURNS = 4`) before registering a deadline, so a handler
that settles quickly never pays for the shared timer. A body read cannot settle inside that window:
it waits on I/O, which is a macrotask on every supported runtime. The turns therefore only delay the
deadline arm; they cannot avoid it. With one shared deadline timer the trade has flipped — register
plus cancel costs about 0.2–0.3 µs, while four turns cost about 1.5 µs of server CPU on a POST on the
wire. The window was measured when every request armed its own timer, and its cost was justified
then; that premise no longer holds for body-bearing requests.

**What changes.** `WebContextBase` now exposes `ctx.bodyLength` — the `content-length` the body
source already parses — and `createWebRunner` passes it through the new `settleTurnsFor()` helper:
a declared, non-empty body means zero turns, anything else keeps `SETTLE_TURNS`. Asking
`request.body` for the same answer would initialise the body stream and cost more than the window
saves (measured: about +0.6–0.8 µs on Bun before the body is read). A POST that declares
`content-length: 0`, a chunked body with no declared length, and every bodyless method keep the
window. `timeout: 0` still disables the race entirely.

**Compatibility.** `bodyLength` is additive: a `readonly number | undefined` on `WebContextBase`
and an optional member of `WebRunnerContext`. Timeout semantics are unchanged — 504 when nothing was
committed, a committed response still wins, and a settled dispatch still cancels its deadline. The
only observable difference is that a body-bearing request's timeout clock starts at dispatch rather
than after four microtask turns (microseconds earlier, on a window measured in seconds). The Node
adapter is untouched: it owns a callback runner with per-request timers, so arming remains the
expensive outcome there and it keeps the window for every request.

**Measured (Bun 1.4.3, JSON POST 1 KB through `bodyParser`, `wrk -t2 -c64`, server pinned, CPU per
request from `/proc/<pid>/stat`, 5 interleaved rounds).** Paired median **−2.7 % server CPU per
request (4/5 pairs)** against the same bundle with `SETTLE_TURNS = 4`; level medians 28.08 → 26.47 µs,
and 27.05 → 25.51 µs with 30.5 → 32.5 k rps in an earlier window (5/5). The Bun POST gap to Hono
measured in the same run narrowed from 1.31× to **1.23×**. A GET/async shape is unchanged by construction; always-arming it
was measured at about +3.5 % CPU, which is why the rule is shape-scoped rather than global.
