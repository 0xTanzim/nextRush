# NextRush Documentation Design System — Migration

- **Version:** 2.0
- **Status:** Plan (no code migrated yet — design documents first, per ADR Phase 1)
- **Owns:** the audit of the current `apps/docs/src/app/global.css` and the incremental, non-breaking rollout. Values live in `TOKENS.md`; rules in `DESIGN.md`/`DESIGN_PLAYBOOK.md`.

This plan is deliberately **additive-first**: new token layers are introduced *before* anything consumes them, Electric Rush is *scoped* (not deleted) into Brand Mode, and every phase is independently shippable and revertible. Nothing here is a big-bang rewrite.

---

## Classification legend

| Verb | Meaning |
| ---- | ------- |
| **Keep** | Correct as-is; may just be renamed/aliased to a token |
| **Migrate** | Value is fine, but it moves into the layered token model (Foundation/Semantic) |
| **Replace** | Behavior stays, implementation changes (e.g. gradient button → flat brand fill) |
| **Remove (→ Brand)** | Leaves Documentation Mode; remains available only on Brand-Mode routes |

---

## `global.css` audit

### Color variables

| Current | Verdict | Target |
| ------- | ------- | ------ |
| `--rush-blue` | **Migrate** | `--brand-600`/`--brand-400` (Foundation) → `--brand-link` (Semantic). Brand hue unchanged. |
| `--rush-purple`, `--rush-cyan`, `--rush-green` | **Migrate / Remove (→ Brand)** | Map to `--learning-*` + `--status-*` where they carry meaning; decorative uses go to Brand Mode. |
| `--rush-gradient`, `--rush-gradient-accent` | **Remove (→ Brand)** | No gradients in Documentation Mode. |
| `--success`, `--warning`, `--danger`, `--info` | **Migrate** | `--status-*` (Foundation hues) + add the `-text` AA-safe variants (`TOKENS.md` §3.4/§4.5). |
| `--text-primary/-secondary/-muted/-subtle` | **Keep / Migrate** | Keep the names (already semantic + AA-fixed). Re-point values to the canonical ramp; note the dark **secondary** shifts `#94A3B8 → #CBD5E1` and dark muted takes `#94A3B8` (a real step-up, see `TOKENS.md` §4.2). |
| `--bg-base/-card/-hover/-border` | **Migrate** | `--surface-page/-card/-elevated` + `--border-*`. Fix the page≠card distinction. |
| `--code-bg/-header/-border`, `--code-keyword…` | **Keep** | Map to `--surface-code` + calm syntax tokens; keep the non-black, non-neon theme. |
| `--color-fd-*` (hand-set overrides) | **Replace** | Derive from Semantic tokens via the Platform bridge (`TOKENS.md` §6). Never hand-set again. |
| `--color-fd-muted-foreground` overrides | **Replace** | Comes from `--text-muted` through the bridge. |
| `--color-fd-success` | **Keep** | Now sourced from `--status-success`. |

### Utilities & effects

| Current | Verdict | Notes |
| ------- | ------- | ----- |
| `.gradient-text`, `.gradient-text-accent`, `.gradient-border`, `.card-gradient-border` | **Remove (→ Brand)** | Decorative gradients banned in Docs Mode. |
| `.glow`, `.glow-hover`, `.code-glow`, `@keyframes pulse-glow`, `.animate-pulse-glow` | **Remove** | Glow + looping animation banned everywhere in Docs Mode. |
| `.card-glow` (dark: `backdrop-filter: blur(12px)`) | **Replace** | Glassmorphism → flat `--surface-card` + `--border-default`. |
| `.btn-primary` (gradient fill) | **Replace** | Flat `--brand-solid` + `--on-brand`, `--radius-md`, no rest shadow. |
| `.btn-outline` | **Migrate** | Token-driven (`--surface-elevated` + `--border-interactive`). |
| `.card-hover` (translateY + `border: --rush-blue`) | **Replace** | Subtle token hover (`--border-strong`), motion only if the whole card is a link. |
| `.dot-grid`, `.noise-overlay` | **Remove (→ Brand)** | Decorative backgrounds. |
| `#nd-docs-layout::before/::after` (radial gradient blobs) | **Remove** | Decorative background blobs — the ADR names these explicitly. |
| `.prose h2::after` (gradient underline) | **Replace** | Flat, quiet marker or none; no gradient rule. |
| `.prose hr` (gradient) | **Replace** | Flat `--border-strong` rule. |
| `.prose blockquote` (left border `--rush-blue`) | **Migrate** | Keep the left border; source from a token (brand or neutral per role). |
| `.animate-fade-up`, `.animate-fade-in` | **Keep** | Short enter animations; already covered by the global reduced-motion block. |
| `::-webkit-scrollbar*` | **Keep** | Re-point to `--surface-*`/`--border-*`. |
| `::selection` (`--rush-blue` mix) | **Keep** | Source from `--brand-*`. |
| `cursor: pointer` fixes (aria-label buttons) | **Keep** | Accessibility fix, still valid. |
| Sidebar tweaks, `--fd-nav-height: 56px` | **Keep** | Layout-critical for Fumadocs. |
| `[class*='max-w-[900px]']{max-width:1020px}` + `[grid-area:toc]` pad | **Migrate** | Replace with the width tiers (`--width-prose` prose, `--width-technical` breakout). Resolves the 900↔1020 tension deliberately rather than by override. |

**Net:** most tokens **Migrate** (values are fine, they just enter the layered model); the Electric Rush decorative layer is **Removed from Docs Mode but preserved in Brand Mode**; `--color-fd-*` is the one block that must be **Replaced** (hand-set → derived).

---

## Rollout phases (each independently shippable + revertible)

### Phase 0 — Design documents *(this deliverable)*
The four `DESIGN/` docs. No code change. **Done-condition:** docs reviewed and accepted.

### Phase 1 — Foundation + Semantic tokens (additive, invisible)
Add the Foundation and Semantic token layers to `global.css` **alongside** the existing `--rush-*`/`--bg-*` variables. Nothing consumes them yet. **Done-condition:** build green, zero visual diff (verify with a screenshot compare on `/docs/start`).

### Phase 2 — Platform bridge (first visible calm shift, docs layout only)
Point `--color-fd-*` at Semantic tokens (`TOKENS.md` §6) and remove the decorative background blobs on `#nd-docs-layout`. This is the first intended visual change and it's scoped to the docs layout. **Done-condition:** `pnpm docs:verify` green, lighthouse a11y ≥ its current score, contrast table re-verified in both themes.

### Phase 3 — Migrate components to Semantic tokens
Component-by-component (`doc-page.tsx`, `mental-model.tsx`, `page-actions.tsx`, tables, callouts…), swap literals/`--rush-*` for Semantic tokens and drop gradient/glow utility usage on docs surfaces. One small PR per component. **Done-condition per PR:** no literal hex remains in the touched component; playbook checklist passes.

### Phase 4 — Mode boundary
Scope the Electric Rush utilities (`.gradient-*`, `.glow*`, `.dot-grid`, `.noise-overlay`, blobs) to Brand-Mode routes only (`(home)`, `showcase`, `community`, blog) via a wrapper class/layout; ensure they no longer resolve on `/docs/**`. **Done-condition:** grep shows zero Brand-Mode utility usage under docs layout; home page visually unchanged.

### Phase 5 — Learning colors
Implement the locked learning map (`TOKENS.md` §5) in the mental-model component, concept badges, and diagrams — always icon + label. **Done-condition:** every concept renders its locked color+icon identically across intro page, lifecycle diagram, and concept badge.

### Phase 6 — Remove dead utilities
Once nothing under docs references them, delete the Docs-Mode-removed utilities (keeping Brand-Mode copies). **Done-condition:** dead-code check clean; bundle CSS shrinks.

### Phase 7 — Accessibility re-audit
Run lighthouse + the contrast matrix across all page types (light + dark), fix any combination not already a documented exception, confirm reduced-motion and keyboard/focus across components. **Done-condition:** WCAG 2.2 AA verified on every page type, both themes.

### Phase 8 — Governance
Promote the accepted ADR to `docs/adr/` (from `docs/adr/TEMPLATE.md`), and add CI guards: a token-lint that fails on raw hex in components and on any new hand-set `--color-fd-*`, plus contrast verification in `docs:verify`. **Done-condition:** CI blocks a raw-hex component and a hand-set fd token.

---

## Success criteria (from the ADR, made checkable)

- [ ] Every documentation page uses one design language (Docs Mode).
- [ ] Brand vs documentation responsibilities separated by route, enforced by the Mode boundary.
- [ ] Tokens are the single source of truth; no literal colors in components (CI-enforced).
- [ ] Platform mappings eliminate duplicated values; `--color-fd-*` is derived, never hand-set.
- [ ] Learning colors consistent and locked across every surface.
- [ ] Every component follows the playbook checklist.
- [ ] WCAG 2.2 AA passes in light and dark, verified — not asserted.
- [ ] Documentation reads calm, technical, predictable; marketing keeps the NextRush identity without affecting docs usability.

## Risk & rollback

- Each phase is a separate PR; reverting one phase never breaks an earlier one (additive ordering).
- Phase 1 ships zero visual change, so token values can be tuned before any surface depends on them.
- The highest-risk phase is Phase 2 (the visible shift) — it is gated on a re-verified contrast table and the existing lighthouse gate, and it touches only the docs layout, so a revert is a single-file change.
