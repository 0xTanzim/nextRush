# ADR-0038 — Settle a handler's returned value into the response

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** Tanzim Hossain
- **Governing RFC:** `docs/RFC/runtime-adapters/050-handler-return-settlement.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0030`, `ADR-0034`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

Route dispatch never reads the matched handler's resolved value, so `return rows` answers an empty
`200` on every adapter. The class executor does read it but JSON-serializes anything object-like,
turning a returned `Response` into `{}` and a `Uint8Array` into a digit-keyed object. The "Next.js
array response fail" reproduced during the Next.js 16 real-server work is this dispatch gap, not
an adapter defect: documented `ctx.json([...])`/`ctx.send([...])` arrays pass end-to-end.

---

## Decision

We will **settle a matched handler's resolved value into the response** through one shared helper
in `@nextrush/router`, used by both the router executor and the class-controller executor, under a
fixed table: `Response` adopted; bytes/streams forwarded; string as text; array/plain object as
JSON; `null` as JSON `null`; other primitives stringified. Settlement is skipped when
`ctx.responded` is true, and middleware returns stay ignored.

Because the two executors already disagree, a shared table removes the corruption and prevents
drift; the native `void` path keeps its synchronous fast path and adds only one comparison.

---

## Options considered

- **Settle with one shared table** — ✅ chosen: fixes the silent drop and the class corruption with
  one contract and no new dependency.
- **Dev-only warning on a returned value** — ❌ rejected: the response still ships empty.
- **Support only `Response` returns** — ❌ rejected: leaves `return rows` broken.
- **Duplicate the table in `@nextrush/class`** — ❌ rejected: two copies drift (today's bug).
- **Do nothing** — ❌ rejected: every `return`-style handler stays a silent empty `200`.

---

## Consequences

- **Positive:** `return [...]`, `return Response.json(...)`, bytes and streams mean what they say
  on every adapter and in class controllers; one test suite covers both executors.
- **Negative / cost:** a handler that returned a value by accident now sends it (return
  `undefined` to keep an empty success); returned `Response` bodies are buffered.
- **Neutral:** `RouteHandler`'s type is unchanged; settlement is a runtime courtesy, so a
  TypeScript handler that returns a value needs a cast (`ctx.json`/`ctx.send` stay fully typed).
- **Follow-up:** consider a dev diagnostic for `ctx.body =` response attempts; document the
  contract in the router and Next.js adapter READMEs and the wiki quick start.

---

## Compliance / enforcement

How this is kept true: router and class unit tests cover every table row, committed-response
precedence, middleware exclusion, thenable adoption, and the synchronous marker; the
`packages/adapters/conformance` suite pins cross-adapter parity; the Next.js 16 real-server
fixture asserts returned-array and returned-`Response` routes over HTTP; the `router` capability
spec holds the requirement.

---

## Checklist

- [x] One decision only (if it's really two, split into two ADRs).
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism (or explicit "by review").
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked (or "—" justified for a small/process decision).
- [x] All guidance blocks deleted; document is terse (fits on ~1 screen-plus).
- [x] Registered in docs/adr/INDEX.md.
