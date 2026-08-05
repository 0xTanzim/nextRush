# RFC-033: Homepage Hero + Proof architecture — layered homepage composition

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Status**           | `Proposed`                                                            |
| **RFC number**       | `033`                                                                 |
| **Date**             | `2026-08-05`                                                          |
| **Author(s)**        | Tanzim Hossain                                                        |
| **Group**            | `documentation`                                                       |
| **Packages touched** | `none` — affects only `apps/website/src/components/home/**` (homepage composition), no `@nextrush/*` package |
| **Framework impact** | `Internal-only` — no runtime code, no public API, no package changes |
| **Supersedes**       | `—`                                                                   |
| **Superseded by**    | `—`                                                                   |
| **Related**          | `ADR-0022` (layered design-token architecture & orange identity — this RFC composes those tokens into the homepage), `RFC-025` (docs-site IA — the docs IA this homepage funnels into) |

---

## Progress Tracker

**Overall:** `[███░░░░░░░░░░░░░░░░░]` 15% — 0 / 4 phases complete · Doc status: `Proposed`

| Phase | Part / deliverable | Status |
| ----- | ------------------ | ------ |
| P0    | RFC approved + Hero/Proof component split documented | ⬜ Not started |
| P1    | `ProofSection` extracted from `Hero` (proof + trust + platforms as its own layer) | ⬜ Not started |
| P2    | Visual funnel applied (header 1280 → hero 760 → proof 900 → content 1180) | ⬜ Not started |
| P3    | Whitespace rhythm + visual-weight map implemented; viewport-fit verified | ⬜ Not started |

---

## 0. Revision History

- **v1 (`2026-08-05`)** — Initial draft. Written after the Hero V3 viewport-fit change (which reordered the hero to `Badge → Brand → Headline → Supporting → Description → CTA → Proof → Trust → Platforms`) surfaced the deeper structural insight: the homepage is really **three layers** (Hero, Proof, Documentation), and treating the code example as "part of the hero" overloads one component. This RFC separates them into a durable architecture.

---

## 1. Summary

The homepage hero has evolved through V2 (gradient wordmark) → V3 (viewport-fit, reordered to identity→value→action→proof→trust). This RFC makes the **structural** conclusion explicit: split the homepage into a **Hero layer** (identity + value + action — "convince the developer to continue") and a **Proof layer** (code example + trust + platforms — "demonstrate the promise"). The two are separate components with separate jobs, composed into one page, with a **visual funnel** (wide header → narrow hero → slightly wider proof → full-width content) and a **continuously decreasing visual weight** from logo down to platform logos.

## 1a. Terminology

- **Hero** — the top layer: badge, brand, headline, supporting statement, description, CTA. One job: convince the developer to continue.
- **Proof** — the second layer: `<> Quick example` label, documentation-style code block, trust bar, platform row. One job: demonstrate the promise (it's easy + it's production-ready).
- **Visual funnel** — the max-width progression (header 1280 → hero 760 → proof 900 → content 1180) that gives the page a natural sense of narrowing then widening.
- **Visual weight map** — the intended continuous decrease in emphasis: logo (strongest) → headline → CTA → code → trust → platforms (lightest).

## 2. Decision Summary

- **D1 — Split `Hero` and `Proof` into separate components.** The code example is NOT part of the hero; it's the first proof. `Hero` ends at the CTA; `ProofSection` (label + code + trust + platforms) follows.
- **D2 — Visual funnel widths.** Header `max-w-1280`, Hero `max-w-760`, Proof `max-w-900`, content sections `max-w-1180` — a widening funnel that focuses the hero and gives code room.
- **D3 — Continuous visual-weight decrease.** Logo (strongest) → headline → CTA → code → trust → platforms (lightest). Nothing below the code competes with the CTA.
- **D4 — Whitespace rhythm.** A fixed ladder (24/20/16/16/32/64/40/24/80) so each layer breathes and the hero fits 1366×768.
- **D5 — One section, one question.** Each layer answers exactly one user question (see §8 table); no component mixes stories.

## 2a. Decision Drivers

- The V3 reorder surfaced that the code example + trust + platforms are a **cohesive proof unit** that shouldn't live inside the hero component (it makes `Hero` do two jobs).
- Premium docs sites (Stripe/Linear/Vercel) separate "what it is" from "show me it works" — the psychological difference between "the code is the hero" and "the code is the first proof."
- The design system (ADR-0022) already provides the tokens; this RFC composes them into a page architecture.

## 3. Problem & Motivation

The current `Hero.tsx` (post-V3) contains the badge, brand, headline, supporting statement, description, CTA, **and** the code example + trust pills + platform row. That's two jobs in one component:

1. **Convince** (identity/value/action)
2. **Prove** (code/trust/platforms)

This overloads the hero: it's hard to evolve the code proof (a new tab, a new status line) without touching the hero's identity content, and the visual weight can't decrease cleanly because the code (heavy) sits inside the hero. The fix is architectural: split the layers.

## 4. Goals & Non-Goals

**Goals:**
- Split `Hero` (identity/value/action) and `ProofSection` (code/trust/platforms) into separate components.
- Apply the visual funnel widths (1280 → 760 → 900 → 1180).
- Continuous visual-weight decrease; whitespace rhythm ladder.
- Keep the V3 viewport-fit (1366×768).

**Non-Goals:**
- No framework/token changes.
- No new content sections (Install/Principles/Architecture/Next-steps/Packages/Footer stay as-is).
- No two-column hero (stays centered).
- Not changing the docs-site content IA (RFC-025 owns that).

## 5. Impact

- **Affected:** `apps/website/src/components/home/hero.tsx` (split), new `apps/website/src/components/home/proof-section.tsx` (code + trust + platforms), `apps/website/src/app/(home)/page.tsx` (compose Hero + ProofSection), possibly `src/app/global.css` (funnel width utility if needed).
- **Not affected:** framework `packages/**`, other home sections, nav/header, token values, `content/docs/**`.
- **Dependencies:** none new.

## 6. Proposed Solution

```text
<HomePage>
├── Header
├── Hero                (badge, brand, headline, supporting, description, CTA)
├── ProofSection        (<> Quick example, code block, trust bar, platform row)
├── InstallationSection
├── PrinciplesSection
├── ArchitectureSection
├── NextStepsSection
├── PackagesSection
└── Footer
```

The `Hero` ends at the CTA group. `ProofSection` owns everything below: the `<> Quick example` label, the documentation-style code block (syntax highlight + copy + status footer), the three trust pills, and the platform row. This is the "Hero + Proof Architecture" — Hero communicates, Proof demonstrates, Documentation teaches.

## 6a. Trade-offs

- **Splitting components adds a file** → pays off in evolvability: the code proof can grow (tabs, run output) without touching hero identity.
- **The funnel narrows the hero** (`max-w-760`) → the hero feels more focused, but content is narrower; the CTA/code still fit because the proof widens to 900.
- **Visual-weight decrease means the code is smaller than the CTA** → that's the intent (nothing competes with the CTA); the code is still readable proof.

## 7. Architecture

```text
Wide Header (1280)
      ↓
Narrow Hero (760)       ← focus, identity + value + action
      ↓
Slightly Wider Proof (900)  ← room for readable code
      ↓
Full-width Content (1180)   ← documentation sections expand
```

The funnel is the page's spine: narrowing focuses the eye on the hero's one message, widening gives the proof code room, and the content sections expand to teach. Visual weight decreases continuously from the logo (strongest) to the platform row (lightest).

## 7a. Architecture Invariants

- `Hero` NEVER contains the code example, trust bar, or platform row — those live in `ProofSection`.
- The CTA is the last interactive element in `Hero`; nothing in `ProofSection` competes with it.
- The visual weight map (logo > headline > CTA > code > trust > platforms) holds on desktop and tablet.
- The hero + proof fit 1366×768 without internal scrolling.

## 8. Detailed Design

### 8.1 Hero layer

```text
Runtime Badge
Brand (logo 15-20% larger + wordmark)
Headline
Supporting Statement
Description
CTA Group (Get Started / View on GitHub, min-h-11)
```

Max-width `760px`, centered. Whitespace: Badge→Brand 32, Brand→Headline 20, Headline→Supporting 16, Supporting→Description 16, Description→CTA 32.

### 8.2 Proof layer

```text
<> Quick example
[ TypeScript ................. Copy ]
[ code: createApp/createRouter/routing/listen ]
[ ✓ Listening on :8080 ]
────────────────────────────
✓ Zero runtime deps   ✓ MIT Licensed   ✓ Web Standard APIs
────────────────────────────
Runs Everywhere: Node.js Bun Deno Edge Cloudflare Vercel Railway
```

Max-width `900px`. Whitespace: CTA→Proof 64, label→code 16, code→trust 24, trust→platforms 24, platforms→next section 80.

### 8.3 Visual weight map

```
███████████████  Logo
████████████    Headline
████████        CTA
██████          Code
████            Trust
███             Platforms
```

### 8.4 One section, one question

| Section | User Question |
| ------- | ------------- |
| Runtime Badge | Where does it run? |
| Logo | What is this? |
| Headline | What kind of framework? |
| Supporting Statement | Why is it different? |
| CTA | What should I do next? |
| Code Example | How simple is it? |
| Trust | Is it production-ready? |
| Platform Logos | Will it work with my stack? |

## 9. Alternatives

- **Keep Hero monolithic (status quo)** — simpler file structure, but overloads the hero and blocks clean evolution of the proof.
- **Full two-column hero** — rejected (V3 spec + this RFC both keep it centered).
- **Proof as part of Documentation layer** — rejected: the code is *proof* (marketing-adjacent), not *teaching* (docs); the Installation section owns teaching.

## 10. Rejected Ideas

- **A large capability card in the hero** — rejected (V3 spec §"Things to Avoid").
- **Trust pills above the CTA** — rejected (V3 spec: nothing competes with the CTA).
- **Decorative terminal instead of a doc-style code block** — rejected (proof must read like documentation).

## 11. Risks

- **Splitting Hero could regress the V3 viewport fit** → the split preserves the exact V3 content + spacing; verified by 1366×768 screenshot gate.
- **The funnel's `max-w-760` hero could feel too narrow** → the proof widens to 900 right below, and the CTA/code fit; mitigates the focus-vs-width trade.
- **New `ProofSection` file could drift from the hero's rhythm** → both consume the same tokens + the whitespace ladder in §8.

## 12. Backward Compatibility

No public API, no framework surface. The homepage is a static composition — the split is internal component structure; the rendered output is equivalent or better (same content, layered architecture).

## 13. Cross-Cutting Concerns

- **Accessibility** — CTAs ≥44px (already), keyboard focus on code copy (already), WCAG AA contrast (tokens already verified in ADR-0022).
- **Performance** — no new deps; the split is a component boundary, zero runtime cost.

## 14. Success Metrics

- The hero + proof fit 1366×768 without scroll.
- The visual weight decreases continuously (logo > headline > CTA > code > trust > platforms).
- A developer understands within 5s: what NextRush is, why it exists, where to start, that the API is simple, that it's production-ready.
- `Hero` contains no proof content (code/trust/platforms) — enforceable by code review / the component boundary.

## 15. Phased Implementation

- **P0 — RFC approved.** ⬜
- **P1 — Extract `ProofSection`** from `Hero` (label + code + trust + platforms move to `src/components/home/proof-section.tsx`; `Hero` ends at the CTA; `page.tsx` composes both). ⬜
- **P2 — Visual funnel widths** (hero `max-w-760`, proof `max-w-900`, content `max-w-1180`; header already 1280). ⬜
- **P3 — Whitespace rhythm + weight + viewport gate** (ladder per §8, screenshot at 1366×768). ⬜

## 16. Rollback Plan

Each phase is independently revertible: P1 is a component extraction (git revert restores the monolithic hero), P2/P3 are width/spacing changes (single-file revert). No data migration, no runtime risk.

## 17. Future Work

- A second proof variant (e.g. a streaming/SSE tab in the code block) — now easy, since `ProofSection` owns the code independently.
- Promoting the Hero/Proof distinction into `DESIGN.md` / `DESIGN_PLAYBOOK.md` as a page-composition pattern (after this RFC ships).

## 18. Open Questions

- None blocking. Exact px for the funnel widths (760/900/1180) are design details confirmed during P2.

## 19. Decisions Log

| # | Decision | Date | Rationale |
| --- | --- | --- | --- |
| D1 | Split Hero and ProofSection | 2026-08-05 | One component = one job; the code is proof, not hero |
| D2 | Visual funnel 1280/760/900/1180 | 2026-08-05 | Focus the hero, room for code, expand to teach |
| D3 | Continuous visual-weight decrease | 2026-08-05 | Nothing competes with the CTA |
| D4 | Whitespace rhythm ladder | 2026-08-05 | Consistent breathing + 1366×768 fit |
| D5 | One section, one question | 2026-08-05 | No component mixes stories |

## 20. References

- `docs/adr/ADR-0022` — layered design-token architecture & orange identity (the tokens this composes).
- `docs/RFC/025` — docs-site IA (the documentation layer this funnels into).
- `apps/website/DESIGN/DESIGN.md` — the design system's hero-wash + hierarchy rules.
