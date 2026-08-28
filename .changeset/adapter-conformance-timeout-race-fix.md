---
'@nextrush/adapter-conformance': patch
---

Conformance runtime driver: decouple the Node socket-level slow-client guard from
the handler-race timeout so the F-04 clean-504 assertion stops flaking under CI
CPU contention.

`serve()` feeds its single `timeout` to both the handler-race timer (the
clean-504 producer) and Node's independent `server.timeout` socket guard. The
conformance timeout case races a handler with `timeout: 10ms`, so the socket
guard was armed at the same 10ms and — on a contended runner, where the socket
timer starts a beat before the request's handler timer — could destroy the idle
socket (surfacing as `ECONNRESET` on the client) before the 504 was written.
The node driver now gives the socket guard generous, independent time (5s) so
only the handler race decides the outcome.
