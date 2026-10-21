# ADR-0034 — One JSON media type, and a plain init record for the Web response

- **Status:** `Accepted · Shipped`
- **Date:** `2026-10`
- **Deciders:** `NextRush maintainers`
- **Governing RFC:** `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0030`, `RFC-041`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[████████████████████]` **Shipped** — 3 / 3

---

## Context

Every Web response was built through a freshly allocated `Headers` instance, even when the response
carried nothing but a content type — the dominant response shape. On top of that, every JSON body
was labelled `application/json; charset=utf-8`, a value RFC 8259 §8.1 does not define for that
type, and one Deno's `Response` constructor explicitly does not accept.

Deno's constructor has a static fast path that skips header-list validation and the native header
re-map, but it is entered only for a plain init record whose single `content-type` value is one of
three literals it hard-codes. The framework satisfied neither condition, so no JSON response ever
took it.

The previous investigation into this (`report/performance/web-response-materialization.md`) rejected
the construction change on Bun allocation bytes and Bun wall-clock noise, and never measured Deno,
where the fast path exists.

---

## Decision

**We will emit `application/json` — with no `charset` parameter — for every framework-generated JSON
response, on every adapter, and we will build the Web response from a plain init record whenever the
recorded response carries no header beyond its content type.**

Because RFC 8259 §8.1 registers `application/json` with no parameters, and because Hono 4.13.0 and
Express 5.2.1 already send the bare value — the framework's own primary benchmark baseline included.
Routing every adapter through the one shared helper that emits it keeps the cross-adapter uniformity
the earlier F-05 rule was protecting, while removing the drift the rule was written against.

The plain init record and the bare media type are kept **together** because Deno's fast path
requires both: the shape (a plain object) and the value (`application/json`). Measured alone on
Deno GET, the shape change is worth −2.14 µs of server CPU per request, the media type alone
−0.15 µs, and the pair −2.26 µs. The `Headers` path stays for every response that carries an extra
header, because both Bun and Node silently join a repeated field supplied through an object literal.

---

## Options considered

- **`application/json; charset=utf-8` everywhere** — ❌ rejected: a value RFC 8259 does not define,
  and one Deno's fast path rejects.
- **Plain init record only, media type unchanged** — ❌ rejected: forfeits the fast path and keeps the
  undefined media type.
- **Runtime-branching construction** — ❌ rejected: AGENTS.md §4 forbids behaviour that depends on
  runtime identity.
- **`pairs` construction (`[['content-type', value]]`)** — ❌ rejected: a sequence init is not a plain
  object, so it cannot enter the fast path; the archived spike measured it as Node's worst default
  shape.
- **One JSON media type + plain init record** — ✅ chosen: spec-correct, matches the ecosystem
  majority, unlocks the platform's cheapest construction, and measured −16.6 % server CPU per request
  on Deno GET with no regression on Bun or Node.
- **Do nothing** — ❌ rejected: 0.79 µs of response construction per JSON response on Deno alone,
  and a media type that contradicts the framework's own standards.

---

## Consequences

- **Positive:** Deno server CPU per request falls 16.6 % (GET) and 8.1 % (POST); one fewer
  per-request allocation on every Web adapter; one JSON media type on every adapter; a media type the
  framework's standards and the ecosystem majority agree on.
- **Negative / cost:** the wire header value changes — a breaking change at a major boundary, with a
  migration note for applications that assert the exact string; and the response path now has two
  constructions whose behavioural equivalence must be maintained and pinned by tests.
- **Neutral:** the `declare` change on the context fields shipped with this decision; its effect is
  below the measurement floor, and it is kept because it removes a provably dead per-instance write.
- **Follow-up:** the static-file MIME table still maps `.json` to the parameterised value — a
  separate surface, deferred to a future change with its own evidence.

---

## Compliance / enforcement

How this is kept true: the cross-adapter conformance suite pins the media type on Node, Bun, Deno,
Edge, and serverless (436 in-process scenarios), and the real-runtime runners prove it on Bun
(56/56), Deno (56/56), and `workerd` (16/16). The two response constructions are pinned by
unit tests — a content-type-only response carries exactly one header, an extra header takes the
general path, and two `Set-Cookie` values stay two values. The measured cost is recorded in
`report/performance/json-media-type-and-response-construction.md` with its protocol and raw data.

---

## Checklist

- [x] One decision only (the media type and the construction it enables are one decision — neither
      has value without the other).
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
