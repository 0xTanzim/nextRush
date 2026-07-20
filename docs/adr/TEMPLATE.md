<!--
============================================================================
 NextRush ADR TEMPLATE  —  copy this file, do not edit it in place.
============================================================================

WHAT AN ADR IS (and is NOT)
  An ADR records ONE architectural DECISION and the reasoning behind it, tersely.
  It is the terse final record — the RFC (docs/RFC/) is the multi-revision design
  exploration, the ADR is the one-page "this is what we decided and why". If you
  find yourself writing pages of design here, it belongs in an RFC; link it.

HOW TO USE
  1. Copy to docs/adr/ADR-NNNN-<kebab-title>.md with the next sequential number
     (flat directory, no subfolders — see docs/adr/INDEX.md).
     e.g. docs/adr/ADR-0008-cookie-signing-algorithm.md
  2. Fill every field/section. Keep it SHORT — an ADR that runs long is an RFC
     wearing the wrong hat.
  3. Delete every guidance block (HTML comments + "> 📝" lines).
  4. Register it in docs/adr/INDEX.md (one row).
  5. Never renumber or delete an accepted ADR. A reversed decision gets a NEW ADR
     that supersedes this one by reference; this file stays for history.
============================================================================
-->

# ADR-NNNN — <Decision, stated as a noun phrase>

<!--
> 📝 Title = the decision, not the problem. "Enforced adapter contract", not
>    "How should adapters be validated?". Must match the docs/adr/INDEX.md row.
-->

- **Status:** `Proposed` <!-- Proposed → Accepted → (Accepted · Shipped) → Superseded / Deprecated / Rejected -->
- **Date:** `YYYY-MM` <!-- when decided -->
- **Deciders:** `<who made the call>`
- **Governing RFC:** `docs/RFC/<group>/<nnn>-<title>.md` <!-- or "—" if no RFC (small/process decision) -->
- **Supersedes:** `—` <!-- ADR number this replaces, or "—" -->
- **Superseded by:** `—` <!-- filled in later if reversed -->
- **Related:** `ADR-000x` <!-- adjacent decisions a reader should know about -->

---

## Lifecycle progress

<!--
> 📝 One-glance status of this decision. Advance the marker and redraw the bar as
>    it moves. Bar = 20 cells, one █ per 5% (same convention as the RFC/audit
>    templates). Proposed = 1/3, Accepted = 2/3, Shipped = 3/3. A reversed
>    decision ends at "Superseded / Rejected" — say so instead of a bar.
-->

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███████░░░░░░░░░░░░░]` **Proposed** — 1 / 3

---

## Context

<!--
> 📝 The forces at play, in a few sentences. What situation demands a decision?
>    What constraints (technical, ownership, timeline, the package hierarchy) box
>    it in? State facts, not the answer — the answer goes in Decision. Include
>    the concrete trigger (an audit finding, an RFC, a recurring bug).
-->

_What's the situation and why does it force a decision now._

---

## Decision

<!--
> 📝 The decision, in the active voice: "Adopt X." / "Enforce Y." / "Reject Z."
>    Then the WHY in 1–3 short paragraphs or a tight list. This is the load-
>    bearing section — a reader must leave knowing exactly what was chosen and the
>    single most important reason. Number sub-decisions if there's more than one.
-->

_We will `<the decision>`._

_Because `<the primary reason it beats the alternatives>`._

---

## Options considered

<!--
> 📝 Terse — one line each, including the chosen one and "do nothing". The full
>    comparison lives in the RFC; here it's just enough that the reader sees the
>    decision wasn't made in a vacuum.
-->

- **`<Chosen option>`** — ✅ chosen: _`<one-line reason>`_.
- **`<Alternative>`** — ❌ rejected: _`<one-line reason>`_.
- **Do nothing** — ❌ rejected: _`<cost of status quo>`_.

---

## Consequences

<!--
> 📝 Honest ledger. Positives AND negatives — an ADR with only upsides isn't
>    trusted. Include the cost we're accepting and any follow-up work the decision
>    creates.
-->

- **Positive:** _`<what gets better>`._
- **Negative / cost:** _`<what we accept — breaking change, added complexity, perf cost>`._
- **Neutral:** _`<notable but not good/bad>`._
- **Follow-up:** _`<work this decision spawns — a follow-up ADR/RFC, a hardening task>`._

---

## Compliance / enforcement

<!--
> 📝 How the decision stays true over time. A decision with no enforcement erodes.
>    Name the mechanism: a lint rule, a `satisfies` guard, a conformance test, a
>    CI check, a review gate. "By convention / code review" is a valid answer, but
>    say so explicitly. N/A only for pure process decisions.
-->

_How this is kept true: `<lint rule / type guard / conformance test / CI gate / review>`._

---

<!--
============================================================================
 DONE CHECKLIST — tick each before setting Status to "Accepted":
============================================================================
-->
## Checklist

- [ ] One decision only (if it's really two, split into two ADRs).
- [ ] Context states the forces/trigger without pre-empting the decision.
- [ ] Decision is in the active voice with its primary reason.
- [ ] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [ ] Consequences include at least one real negative/cost.
- [ ] Compliance/enforcement names a concrete mechanism (or explicit "by review").
- [ ] Lifecycle progress bar reflects the current Status field.
- [ ] Governing RFC linked (or "—" justified for a small/process decision).
- [ ] All guidance blocks deleted; document is terse (fits on ~1 screen-plus).
- [ ] Registered in docs/adr/INDEX.md.
