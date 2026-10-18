---
'@nextrush/core': minor
'@nextrush/runtime': minor
'@nextrush/adapter-node': minor
---

A request is now always answered, and a body is serialized before it is committed.

**Nothing can leave a request unanswered.** When the error path itself fails to produce a response,
the framework answers instead of leaving the socket open. This covers a custom error handler that
completes without writing (it returned early, or took a path that forgot to respond), an error
handler that throws while writing, and a handler that set an error status and wrote no body at all:

| What happened                                             | Body sent now                                |
| --------------------------------------------------------- | -------------------------------------------- |
| A handler throws and `setErrorHandler` writes nothing      | `500` + the default JSON error body          |
| `setErrorHandler` throws while writing                     | `500` + the default JSON error body          |
| A handler sets an error status and writes nothing          | that status + `{ "error": "<status message>" }` |
| A handler responds with a success status and no body       | unchanged — the documented empty response    |

The guarantee holds at three layers — the application error path (`@nextrush/core`), each adapter's
response finalizer, and the shared Web response builder (`@nextrush/runtime`) — precisely so no
configuration and no handler bug can reach the client as a hanging request. Previously a custom
error handler that returned without responding ended the request with whatever status the handler
had set and an empty body; a handler could also be answered by an adapter finalizer before its own
error path ran.

**A body is serialized before the response is marked sent.** `ctx.json()` (and the object branch of
`ctx.send()`) no longer flips the responded flag before calling `JSON.stringify`. A value JSON has
no representation for — a `BigInt`, a circular structure, a function, a `Symbol`, or a top-level
`undefined` — now throws a `TypeError` naming the value class with the response still unwritten, so
the error path above answers it with a `500`. On Node this was the difference between a `500` and a
socket that received no bytes at all; on Bun, Deno, and Edge it was the difference between a `500`
and an empty `200` carrying a success status. A value that serializes to `undefined` is rejected
the same way instead of producing an empty body.

Adapters no longer distinguish a body method's failure from a handler's: both are answered. Code
that currently swallows a serialization failure and sends its own fallback should keep doing that —
the framework guarantee only applies once nothing has written.

`@nextrush/runtime` additionally exports the pieces both families now share:
`serializeJson()`, `prepareBody()`, `PreparedBody`, `measureBodyLength()`,
`unansweredErrorBody()`, and `LAST_RESORT_ERROR_STATUS`. `assertHeaderSafe()` and
`isBodylessResponse()` moved to a `header-guards` module with no change to their behavior or to
their public export path. The response-body classification moved out of the Web response builder,
so a body is resolved by a pure function and committed afterwards.
