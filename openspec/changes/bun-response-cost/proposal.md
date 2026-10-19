# Proposal

## Why

On Bun, hello-world is 17 % slower than Hono in-process (`3.48` vs `2.97` µs) and 12 % slower over the
socket, and the only framework-attributable cost a profile still names is **response construction**:
`Response` at 18.7 % self-time, ahead of `JSON.stringify` (5.1 %), context construction (3.7 %) and
routing (1.8 %). Every other item RFC-039's P0 verdict named has been closed or gated. This is the
last measured one, and it sits outside RFC-039 P3, whose gate is about JSON _encoding_, not about the
`Response` object.

The mechanism is visible in source: `WebResponseBuilder` allocates a `Headers` instance eagerly for
every request (`response-builder.ts:39`), `json()` writes the default content-type into it, and
`getResponse()` hands that instance to `new Response(body, { status, headers })`, so the platform
copies a header record that, for a hello-world response, has exactly one entry. Hono passes a plain
object literal.

## What Changes

- **Spike first, and it can cancel the change.** Measure, on Bun and Node with the real header shapes,
  whether the platform's JSON fast path (`Response.json`) is cheaper than `new Response(string,
{ status, headers })`, and whether an empty-or-default header record is cheaper as a shared frozen
  literal than as a `Headers` instance. The spike result decides whether anything else happens.
- **Lazy response header record.** If the spike says the record costs, `WebResponseBuilder` allocates
  no header record until a header outside the default set is written, and the built response is
  byte-identical: same status, same `Content-Type` string, same body bytes, same HEAD/204/304 body
  suppression, same accumulated `Set-Cookie`.
- **A measured accept/reject gate.** The change is adopted only if the Bun `inproc.nextrush.vs_hono`
  ratio improves beyond this machine's run-to-run spread. A null result is recorded and the change is
  parked rather than merged on aesthetics.
- No public API, no routing, no middleware-order, no adapter-contract change.

## Capabilities

### New Capabilities

None. The response builder is already owned by `web-adapters`; a new capability here would be a
change-shaped name, not a durable one.

### Modified Capabilities

- `web-adapters`: the response builder gains a stated allocation contract — no eager header record,
  byte-identical output, and adoption gated on a measured improvement.

## Impact

- `packages/runtime/src/response-builder.ts` and the Web contexts that call `getResponse()`.
- `apps/benchmark/scripts/dev-check` (the Bun `inproc.nextrush.vs_hono` gate supplies the evidence;
  the Node ratio stays ungated for the reason recorded in the previous change).
- No dependency, no public export, no `.d.ts` change.

**RFC note:** not RFC-gated (no public-API or observable-behaviour change). RFC-039 owns the analysis;
its §3.9 findings table and P3 verdict must record the outcome before this change is archived, and
RFC-040 keeps ownership of the gates.

**Sibling change:** `rfc-041-recorded-response` redesigns the same builder's ownership of the outgoing
response (it moves the builder's state into a shared record flushed by the runner). The two are
independent — this change trims an allocation and the sibling changes who owns the state — so either
can land first. If the sibling lands first, the spike's `current` variant is re-measured against the
new builder before this change's gate is read.
