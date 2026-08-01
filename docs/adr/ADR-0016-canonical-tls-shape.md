# ADR-0016 — Canonical nested TLS shape and ALPN-negotiated HTTP/2 for server adapters

- **Status:** `Proposed`
- **Date:** `2026-07`
- **Deciders:** `NextRush core (pending maintainer approval — see RFC-028 status)`
- **Governing RFC:** `docs/RFC/runtime-adapters/028-tls-transport-negotiation.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0007` (serverless adapter and enforced contract — same "adapters own transport" precedent)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███░░░░░░░░░░░░░░░░░]` **Proposed** — 1 / 3

---

## Context

`@nextrush/adapter-node` has no TLS support; `@nextrush/adapter-bun` and `@nextrush/adapter-deno`
already have TLS, but with two incompatible option shapes (nested `tls: {}` on Bun, flat
`cert`/`key` on Deno with no `ca`). Deno's `Deno.serve()` negotiates HTTP/1.1 vs HTTP/2
automatically via ALPN once a cert is supplied; Bun's documented HTTP/2 path is a separate
`node:http2` API, not its native `tls` option, so the three adapters are not symmetric. This was
surfaced during a scoped architecture review of runtime transport support (three RFC drafts
reviewed; see RFC-028's revision history) and forces a decision on both the canonical option
shape and whether HTTP/2 is exposed as an explicit choice or a negotiated outcome.

---

## Decision

We will standardize all three server adapters' TLS configuration on Bun's existing nested
`tls: { cert, key, ca? }` shape, add that shape (plus ALPN-negotiated HTTP/2 via `node:http2`)
to the Node adapter for the first time, and deprecate Deno's flat `cert`/`key` fields with a
one-minor-version window. HTTP/2 is never selected via an explicit `protocol` option — it is
negotiated automatically via ALPN wherever the underlying runtime supports it, reported through
`RuntimeCapabilities.secureServing`/`http2`.

Because Bun's shape is the richer of the two existing ones (it already has `ca`), standardizing
onto it means only one adapter (Deno) needs a breaking change instead of two, and because an
explicit protocol option would reintroduce exactly the transport-leakage problem the existing
capability-negotiation model (`runtime-capability-negotiation`) already solves for every other
runtime-varying behavior.

---

## Options considered

- **Bun's nested `tls: { cert, key, ca? }` shape** — ✅ chosen: richer existing shape; minimizes which adapter must break.
- **Deno's flat `cert`/`key` shape** — ❌ rejected: no `ca` support; standardizing onto it would break both Bun and Node's Buffer-typed fields for no gain.
- **A new, third shape neither adapter has today** — ❌ rejected: breaks two existing adapters instead of one, for no added benefit.
- **Explicit `protocol: 'http2'` option** — ❌ rejected: leaks a transport concept into the public API that ALPN already negotiates automatically in real deployments.
- **Do nothing** — ❌ rejected: Node stays without TLS/HTTP2 indefinitely, and the Bun/Deno shape divergence persists and likely compounds the next time an adapter needs TLS config.

---

## Consequences

- **Positive:** One TLS shape to learn across Node/Bun/Deno; Node gains a previously-missing capability; HTTP/2 arrives without any new application-facing API.
- **Negative / cost:** Deno consumers using flat `cert`/`key` must migrate within the deprecation window — a real, if narrow and time-boxed, disruption. Node's adapter gains nontrivial implementation complexity bridging `node:http2`'s stream shape into the existing `Context` construction.
- **Neutral:** Bun's `http2` capability flag may end up `false` after empirical verification — the shape is unified across all three adapters, but the underlying HTTP/2 *capability* is not assumed symmetric.
- **Follow-up:** A `node:http2`-based HTTP/2 path for Bun, if verification concludes its native `tls` option cannot negotiate `h2` — tracked separately, not silently folded into this decision's scope.

---

## Compliance / enforcement

Enforced by: (1) the existing `no-runtime-identity-capability` ESLint rule, which continues to
reject any `runtime === 'node'`-style branch for a transport decision; (2) the extended
cross-adapter conformance suite (`packages/adapters/conformance`), which must pass HTTP/1.1,
HTTPS/1.1, and negotiated-HTTP/2 scenarios before any `secureServing`/`http2` capability flag is
allowed to report `true` for an adapter; (3) `@deprecated` JSDoc on Deno's flat `cert`/`key`
fields, checked by code review during the deprecation window.

---

## Checklist

- [x] One decision only (canonical TLS shape + negotiated-not-selected HTTP/2 — a single, coupled decision).
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names concrete mechanisms.
- [x] Lifecycle progress bar reflects the current Status field (`Proposed`).
- [x] Governing RFC linked (RFC-028).
- [x] All guidance blocks deleted; document is terse.
- [ ] Registered in docs/adr/INDEX.md — pending this write.
