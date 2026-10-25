---
'@nextrush/runtime': minor
'@nextrush/adapter-node': patch
'@nextrush/adapter-bun': patch
'@nextrush/adapter-deno': patch
'@nextrush/adapter-edge': patch
---

**A request whose handler never reads `ctx.query` no longer pays to parse it.**

`WebContextBase` (Bun/Deno/Edge) and `NodeContext` parsed the query string in the constructor,
before any handler could ask for it. Many query-bearing requests never read the bag, and middleware
that does read it (logging, validation) is enabled per app rather than per request. The parse is now
deferred to the first read of `ctx.query` and memoized: a request that reads the bag performs
exactly the parse it performed before, and one that never reads it performs none. A query-less
context still returns the shared frozen empty bag on first read.

Measured same-process, paired and order-flipped, server CPU per request (negative is faster):

| Workload                                      |      Change | Pairs |
| --------------------------------------------- | ----------: | ----: |
| Bun full request, `?limit=10&offset=0` unread | **−947 ns** |   9/9 |
| Node context, query unread                    | **−720 ns** |   9/9 |
| Deno full request, query unread               | **−816 ns** |   9/9 |
| Bun request, query read                       |     −105 ns |   5/9 |
| Node context, query read                      |      −24 ns |   6/9 |

The query-less control arm moved −11 ns on Bun (6/9) and +10 ns on Node (2/9), inside each run's
noise. Values, decoding, the 256-parameter/2048-character limits, denied keys and the shared frozen
empty bag are byte-identical to the eager implementation across a 25-target differential corpus on
both context classes.

`ctx.query` keeps its typed read-only contract, exposes the same memoized bag on every read, and is
now a prototype accessor instead of an own data property; assigning to it was outside that contract.
