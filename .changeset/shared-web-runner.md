---
'@nextrush/runtime': minor
'@nextrush/adapter-bun': patch
'@nextrush/adapter-deno': patch
'@nextrush/adapter-edge': patch
---

**One shared Web request runner, and no timeout timer for a handler that already settled.**

Bun, Deno, and Edge each owned a copy of the same per-request flow — boot
barrier, dispatch, timeout race, not-found finalize, error handling — so every
fix to it had to be made three times. `@nextrush/runtime` now exports
`createWebRunner`, which owns that flow once; each adapter supplies only its
context factory (which decides how the client address is resolved) and its
timeout policy. Next.js and serverless already route through the Edge handler,
so they get the same runner.

The race also stopped paying for a timer it does not need: a dispatch that
settles within a few microtasks — the common case — is awaited without ever
calling `setTimeout`, and a timer is armed only when the handler is still
pending. Timeout interval, 504 body, cooperative cancellation via `ctx.signal`,
the not-found body, and the Edge timeout warning are unchanged.

Measured on the committed `dev-check` stages (same machine, same run, versus the
previous commit): in-process cost 5.9 → 4.05 µs/request on Bun (-31%) and
17.9 → 13.3 µs/request on Node (-25%), with no probe regression. Most of that
comes from the two laziness changes in this group; the runner removes the
triplication that made the third fix necessary.
