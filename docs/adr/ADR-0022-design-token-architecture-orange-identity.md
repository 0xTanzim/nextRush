# ADR-0022 — Layered Design-Token Architecture & Orange Identity

- **Status:** `Accepted · Shipped`
- **Date:** `2026-08`
- **Deciders:** Design consult (3/3 locked), engineering review
- **Governing RFC:** `—` (docs-site/process decision; the design system spec lives in `apps/website/DESIGN/`, not a framework RFC)
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `—`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███████████████░░░░░]` **Shipped** — 3 / 3

---

## Context

The NextRush docs site shipped a blue "Electric Rush" identity with flat `--rush-*` CSS variables and hand-set Fumadocs (`--color-fd-*`) overrides. Two forces forced a decision:

1. **The logo became canonical** — the shipped orange mark (`#F16913`) is the single source of brand truth; the docs identity must match it.
2. **The token layer was ad-hoc** — components referenced raw hexes and `--rush-*` directly, contrast was asserted not verified, and Fumadocs chrome was hand-colored, so retuning a brand hue meant hunting every usage.

## Decision

Adopt a **layered design-token architecture** (`Foundation → Semantic → Platform → Component`) with the **orange `#F16913` identity** (warm-paper light / graphite dark surfaces), and make it **CI-enforced**.

- **Foundation** (`:root`) holds theme-independent primitives: a lean 7-step orange brand ramp (`#FFF2E6`→`#C5530E`), the neutral slate ramp, graphite ink steps, status hues, and the locked learning map. The only place a literal hex may appear.
- **Semantic** (`.light`/`.dark`) maps roles to Foundation: warm surfaces (`#FFF9F4` page), warm-ink text, warm borders, `#BC4E08` light / `#FF8A34` dark brand links, `#C5530E` solid (AA with white). Theme-aware; the layer humans author against.
- **Platform** derives `--color-fd-*` from Semantic — never hand-set.
- **Enforcement:** the `docs:verify` harness gained `token-check` (no raw hex in components, no hand-set `--color-fd-*`, no retired `--rush-*`/blue) and `token-values` (live CSS matches `DESIGN/TOKENS.md`).

_Because a component that reads Semantic tokens is retuned by editing one value; a spec with computed (not asserted) WCAG ratios makes accessibility a property of the system; and CI gates keep the docs from silently rotting back to literals._

## Options considered

- **In-place rename `--rush-*` → orange values** — ❌ rejected: a breaking visual change with no intermediate safe state; components still scattered hexes.
- **Keep cool-slate surfaces, re-theme brand only** — ❌ rejected (at review): the draft's warm-paper/graphite surfaces were adopted for a fuller identity match; contrast was recomputed for them.
- **Do nothing** — ❌ rejected: docs said orange while the live site stayed blue — a shipped divergence.

## Consequences

- **Positive:** one canonical token source; WCAG 2.2 AA verified in both themes; Fumadocs chrome follows Semantic for free; the orange identity matches the logo everywhere.
- **Negative / cost:** a visible visual shift on the live site (the intended point); a leaner brand ramp means `--brand-link`/`--brand-hover` are out-of-ramp AA text shades; some data-viz palettes (benchmark charts) legitimately stay literal hex and are allowlisted.
- **Neutral:** the neutral slate ramp was kept as the Foundation neutral (warm paper is expressed via Semantic surfaces); syntax-highlight palettes remain a distinct domain.
- **Follow-up:** `DESIGN2.md/` was folded and removed; the `docs-design-system-orange` change tracks the rollout.

## Compliance / enforcement

Kept true by the `docs:verify` token gates: `token-check` fails on a raw hex in a component, a hand-set `--color-fd-*`, or any `--rush-*`/Electric-Rush blue; `token-values` fails if `global.css` drifts from `DESIGN/TOKENS.md`. `DESIGN/TOKENS.md` §7 ships the computed contrast matrix.
