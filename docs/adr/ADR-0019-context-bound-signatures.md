# ADR-0019 — Context-bound signature construction for signed cookies

- **Status:** `Accepted`
- **Date:** `2026-07`
- **Deciders:** `harden-security-boundaries change`
- **Governing RFC:** `docs/RFC/request-data/031-context-bound-signatures.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `—`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[██████████████░░░░░░]` **Accepted** — 2 / 3

---

## Context

`@nextrush/cookies`' `signCookie`/`unsignCookie` HMAC the bare cookie value with no binding to the
cookie's name or an issue time. A security audit (SEC-07, P2) found a value signed for one cookie
verifies successfully when presented under a different cookie name, and no signed value can be given
a lifetime shorter than the signing secret's own rotation. `@nextrush/csrf`'s `buildMessage()` already
signs a length-prefixed `<len>!field!<len>!field` tuple for exactly this reason — the codebase
currently has two standards for the same primitive.

## Decision

We will sign a length-prefixed `<len>!name!<len>!value!<len>!issuedAt` message in
`@nextrush/cookies`, reusing the construction already proven in `@nextrush/csrf`, and reject on name
mismatch or expiry at verification time. A time-boxed `acceptLegacySignatures` flag (default off)
accepts the previous value-only format during rotation.

Because unifying on the stronger, already-validated construction is lower-risk than either leaving
the weaker one in place or inventing a third format.

## Options considered

- **Length-prefixed message, reusing `csrf/token.ts`'s construction** — ✅ chosen: injective, proven,
  no new standard.
- **Delimiter-joined message** (`name:value:issuedAt`) — ❌ rejected: ambiguous when a field contains
  the delimiter — the exact bug class signature-confusion attacks exploit.
- **JWT as the signed-cookie format** — ❌ rejected: pulls in a JSON envelope (commonly a dependency)
  for a primitive already implemented correctly at the crypto level.

## Consequences

- **Positive:** a signed value cannot be replayed under a different cookie name; one signing standard
  across `csrf` and `cookies`.
- **Negative / cost:** breaking for existing signed cookies — `unsignCookie` requires a `name`
  argument; the wire format's *signed message* changes even though the wire *encoding* does not.
- **Neutral:** the rotation flag is itself deprecated-on-introduction, tracked to a removal target.
- **Follow-up:** `acceptLegacySignatures` removal is scheduled for the major release after this one.

## Compliance / enforcement

Unit tests assert cross-name replay fails and an expired signed value is rejected. The rotation
flag logs once per process when exercised, so lingering legacy acceptance is observable in
production logs, not silent.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one and two alternatives.
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [ ] Registered in `docs/adr/INDEX.md`.
