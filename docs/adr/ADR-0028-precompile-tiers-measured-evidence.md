# ADR-0028 — Precompile tiers ship only on measured evidence

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/039-precompile-per-request-tax.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0029`, `RFC-042`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[██████████████░░░░░░]` **Accepted** — 2 / 3

---

## Context

RFC-039 proposed four precompile tiers: lazy context fill (P1), compiled request validation (P2),
compiled response serialization (P3), and scoped-middleware DX / Rust (P4). P2 and P3 would add
new request-path code paths that must stay byte- and behavior-identical to the generic ones. The
temptation is to build them because the shape is knowable at boot; the risk is shipping a second
path that is slower, buggier, or both, and maintaining it forever. The closure session added the
missing entries — a real Zod schema POST, a same-middleware identity-schema control, a 400-object
`ctx.json` response, and a 100 KiB POST — so each tier could be judged on a profile instead of an
assumption.

## Decision

**A precompile tier ships only when a CPU profile attributes at least 5 % of sampled request CPU
to the framework-attributable cost it would remove, and the implementation then beats the generic
path in a re-run.** Otherwise the tier closes evidence-negative and ships no code.

Because the bar is measurement, not intent, the results are part of the decision:

- **P2 closed evidence-negative.** Schema POST 30.702 µs vs identity-schema control 30.248 µs
  (0.454 µs / 1.5 %); the wrapper's own self time is 0.0–0.1 % and the schema library totals ≈1 %.
- **P3's gate tripped** (`JSON.stringify` 88.1 % on the large-response profile), but the
  byte-identical fixed-key prototype measured 4.4× slower (75 s vs 17 s), so it was rejected —
  see RFC-042.
- **P1 was already shipped** and **P4 needed docs, not runtime code**.

## Options considered

- **Measured gate per tier** — ✅ chosen: the profile decides, and a failed implementation is
  still a valid close.
- **Build P2/P3 unconditionally** — ❌ rejected: would optimize an unmeasured wrapper and ship a
  measured-slower serializer.
- **Do nothing** — ❌ rejected: leaves the tiers ambiguous and invites a future speculative retry.

## Consequences

- **Positive:** the request path keeps one generic implementation per concern; no second path to
  keep byte-identical.
- **Negative / cost:** a genuinely useful optimization may wait for a workload that trips the bar;
  the gate itself must be measured with the right shape.
- **Neutral:** P3's rejection is recorded in RFC-042, so a future retry starts from evidence.
- **Follow-up:** re-run the profile only when a new workload changes the attribution.

## Compliance / enforcement

The `dev-check` profile entries live in `apps/benchmark/scripts/dev-check/entries/`; RFC-039 §3.11
records the commands and profile files. No lint rule — the gate is a review requirement backed by a
reproducible command.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
