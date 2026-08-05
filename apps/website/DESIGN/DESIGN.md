# NextRush Documentation Design System

- **Version:** 2.0
- **Status:** Draft for implementation
- **Owns:** WHY — philosophy, principles, personality, the hybrid strategy, accessibility philosophy, lifecycle, governance.
- **Companions:** `TOKENS.md` (WHAT — values + platform bridge), `DESIGN_PLAYBOOK.md` (HOW — components + patterns), `MIGRATION.md` (the non-breaking rollout). Decision of record: `docs/adr/` (see [Governance](#governance)).

Each topic is owned by exactly one document. This file states principles; it does not list component rules (that's the playbook) or hex values (that's tokens). If you find the same rule in two files, the duplicate is a bug.

---

## Versioning

This design system is versioned like an API (values live in `TOKENS.md`; a change that alters a token's meaning is a versioned, breaking change per `Governance`).

- **Patch** — may clarify documentation but must not redefine the visual language.
- **Minor** — may extend the system with new components or tokens.
- **Major** — may introduce breaking changes to the brand or visual identity.

---

## Purpose

NextRush documentation is a **learning environment**, not a marketing site. It exists so developers can understand, build, debug, and master the framework with the least friction. The content is the product; the interface exists to get out of its way.

A reader should leave remembering the explanations, the architecture, the mental models, and the examples — not the colors.

## Product personality

Documentation should feel **technical, calm, precise, trustworthy, and predictable.** It should not feel playful, trendy, decorative, or marketing-driven. Confidence comes from consistency, not from expressiveness.

---

## Hybrid design strategy (the central decision)

NextRush runs **two visual modes** on one brand. Brand identity and documentation usability are separate concerns, and conflating them is what created the cognitive-load problems this system fixes.

| | **Brand Mode** | **Documentation Mode** |
| --- | --- | --- |
| **Goal** | Create emotion, build recognition, communicate innovation | Reduce cognitive load, optimize reading, support learning |
| **Applies to** | Landing, homepage, marketing, release announcements, showcase, community landing | Docs, guides, concepts, tutorials, API reference, architecture, RFCs, package reference, migration guides, changelog |
| **Allowed** | Hero gradients, decorative illustration, expressive layout, brand storytelling, motion for delight | Neutral surfaces, surface hierarchy, typography-first layout, minimal and purposeful color |
| **Owner** | Brand identity (see `BRAND.md`) | This design system |

The brand identity (defined in `BRAND.md`) becomes the **marketing identity**. It is not deleted — it is scoped. Documentation Mode is the default for everything under `/docs/**` and the other content surfaces above.

**What stays (unchanged by this system):** the NextRush logo, the brand color (orange `#F16913`), brand personality, the documentation's information architecture, and all learning content. Only the *presentation* of documentation evolves.

### Acceptable gradient usage

Gradients are a Brand-Mode device. In Documentation Mode:
- ❌ No gradient text, gradient buttons, gradient borders, gradient section underlines, gradient rules, or decorative gradient background blobs.
- ✅ One exception: a **single, near-invisible** brand wash may sit behind a page hero (a flat tint or a ≤6% radial), because a hero is a labeled "you are here" band, not body content. It must never reduce text contrast below AA and must not repeat down the page.

---

## Core principles

Six principles, each with the failure it prevents.

1. **Content first.** The interface never competes with the content. *Prevents:* decorative chrome that pulls the eye off the prose.
2. **Reading first.** Optimize for long sessions — line length, rhythm, contrast, and navigation over visual interest. *Prevents:* dense, tiring layouts.
3. **Calm by default.** Reduce visual noise. Reach for whitespace, typography, spacing, and hierarchy *before* color. *Prevents:* the "every idea becomes another card/callout/color" sprawl.
4. **Consistency over creativity.** Every page behaves the same way. Predictability builds trust. *Prevents:* one-off layouts a reader has to re-learn per page.
5. **Progressive disclosure.** Show what's needed now; reveal complexity gradually. *Prevents:* overwhelming beginners while still serving experts.
6. **Learn through recognition.** Concepts become visually memorable through consistent diagrams, terminology, and locked learning colors — **never color alone.** *Prevents:* inconsistent, un-memorable teaching.

### The visual-hierarchy order

Build hierarchy in this order. Only descend when the current tool can't do the job.

```
Layout → Whitespace → Typography → Surface → Border → Color
```

Color is the **last** tool, never the first. Most hierarchy problems are solved by the time you reach "Surface."

### Surface philosophy

Depth is created by **surfaces and spacing**, not shadows. Every layer has a purpose and is visually distinct from its neighbor: `page → sidebar → card → elevated → code → callout`. Shadows are reserved for true floating overlays only (values in `TOKENS.md` §11). Adjacent surfaces never share a value.

### Color philosophy

A documentation page is approximately:

```
90%  Neutral    — builds the entire interface
 8%  Brand      — interaction and current location only
 2%  Semantic   — meaning (success/warning/danger/info/experimental)
     Learning   — concept recognition, inside educational visuals only
```

- **Brand** color exists for interaction: links, focus, active navigation, the current page, primary actions. It never decorates.
- **Semantic** color communicates state and always pairs with an icon and text.
- **Learning** colors reinforce mental models and appear only in diagrams, timelines, and concept badges — bounded and locked in `TOKENS.md` §5.

### Typography

Typography is the strongest communication tool. Build hierarchy with **size, weight, spacing, and line length** before color. Color supports typography; it never replaces it. A heading is a heading because of its size and weight, not its hue.

---

## Accessibility philosophy

Accessibility is a design requirement, not a review step, and it constrains the tokens themselves (`TOKENS.md` §7 ships verified ratios).

- **Never communicate with color alone.** Every color cue is backed by typography, icon, label, shape, or position. A colorblind reader and a grayscale printout lose nothing.
- **WCAG 2.2 AA is the floor**, verified in both themes: 4.5:1 for body text, 3:1 for large text and for UI components/graphical objects (1.4.11). Combinations that fail are documented exceptions with a non-color backup, never silent.
- **Keyboard first.** Every interactive control is reachable and operable by keyboard, in a logical order, with a **visible focus ring** (`--brand-focus`, verified ≥3:1 on the page surface).
- **Motion is optional.** `prefers-reduced-motion` is honored globally (`TOKENS.md` §12). No essential information is conveyed by motion alone.
- **Both themes are first-class.** Light and dark provide equivalent usability and both pass the contrast floor — dark mode is not a dimmed afterthought.
- **Structure is semantic.** Headings form a correct outline (never skip a level for visual weight — use an eyebrow label instead), landmarks are labeled, and interactive elements use the right element (`<button>`, `<a>`) with an accessible name.
- **Targets are comfortable.** Interactive targets meet a minimum hit area (24×24 CSS px per WCAG 2.2 2.5.8; prefer larger) and show `cursor: pointer`.

---

## Documentation lifecycle principles

Docs are a living product, so the design accounts for change over time, not just a first render.

- **Every state is designed.** Empty, loading, error, and "no results" states each explain what happened and what to do next — a blank region is a defect (patterns in the playbook).
- **Staleness is visible, not hidden.** Version, "last updated," and deprecation are surfaced with consistent tokens (badges, callouts), never buried.
- **Deprecation is graceful.** A deprecated page/section is clearly marked and links forward to its replacement before it is removed.
- **Additive over destructive.** New patterns extend the system; they don't fork it. A page that needs a brand-new component is a signal to add it to the playbook, not to improvise locally.

---

## AI-generated-content guidelines

Much of this documentation is authored or edited by AI agents. They are held to the same bar as a human contributor, plus a few rules that address AI-specific failure modes.

- **Consume tokens, never invent values.** An AI-authored component uses Semantic tokens (`var(--surface-card)`), never a raw hex, a new color, or a new spacing value. A needed value that doesn't exist is a change request against `TOKENS.md`, not an inline literal.
- **No new components without a playbook entry.** If a page needs a pattern the playbook doesn't define, add the entry (and get it reviewed) — don't ship a bespoke one-off.
- **Cite the decision, don't restate it.** Reference the relevant `TOKENS.md`/playbook section rather than paraphrasing its rationale into the component (see `.kiro/steering/comments.instructions.md`).
- **Pass the same gates.** AI-authored docs clear `pnpm docs:verify` (terminology, banned marketing words, link/code checks) and the design review checklist (playbook) — no exceptions for machine authorship.
- **Honesty over polish.** Never fabricate an example, an API, a benchmark, or a contrast ratio. Verify against source; if unverified, say so.

---

## Governance

- **Ownership.** This system is a single source of truth for documentation surfaces. Changes to any of the four documents are reviewed like code.
- **Decision of record.** The adoption of this system is recorded as an ADR under `docs/adr/` (promoted from the accepted `ADR-001 — Documentation Design System Architecture`; per AGENTS.md §21 the durable decision lives there, authored from `docs/adr/TEMPLATE.md`, not in `feedback/`).
- **Versioning.** These documents are versioned together (currently `2.0`). A change that alters a token's meaning, a locked learning color, or a component contract is a **breaking** change and bumps the major version with a migration note.
- **Change process.** Foundation tokens and new components are added by the design-system owner via review; `--color-fd-*` bridge values are never edited by hand (they're derived). A change that touches framework public API, routing, or adapters is out of scope here and remains RFC-gated (AGENTS.md §20).
- **Definition of done for any UI change.** It consumes tokens (no literals), passes the playbook checklist, passes WCAG AA in both themes, honors reduced motion, and is keyboard-operable.

---

## Things we never do (owned here; the playbook enforces per component)

In **Documentation Mode**:

- ❌ Decorative gradients (text, buttons, borders, rules, background blobs)
- ❌ Glassmorphism / backdrop blur on content surfaces
- ❌ Glow, neon, or pulsing/looping decorative animation
- ❌ Large or decorative drop shadows on in-flow cards (overlays only, one soft token)
- ❌ Multiple decorative accent colors / rainbow interfaces
- ❌ Random icon colors, random spacing, random radii
- ❌ Color used without meaning, or color as the sole signal
- ❌ Marketing-style layouts, banners, or hero sales copy
- ❌ Skipping a heading level for visual weight

These effects remain available in **Brand Mode**.

---

## Decision framework

Before adding any visual element:

```
Does it improve understanding?  ── no ──▶ remove it
        │ yes
Can typography solve it?         ── yes ─▶ don't add color
        │ no
Can spacing solve it?            ── yes ─▶ don't add color
        │ no
Can surface/hierarchy solve it?  ── yes ─▶ don't add color
        │ no
Use color — intentionally, from a token, with a non-color backup.
```

## Guiding principle

Documentation should feel like a professional development environment — not a marketing site, a portfolio, or a landing page. Developers should remember how easy it was to learn, not how the interface looked. The content is the product; everything else exists to help them understand it faster.
