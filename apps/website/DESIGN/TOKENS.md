# NextRush Design Tokens

- **Version:** 2.0
- **Status:** Draft for implementation (supersedes the 1.0 foundation-only draft)
- **Owns:** WHAT the values are, and how they map to the platform. Philosophy lives in `DESIGN.md`; component usage lives in `DESIGN_PLAYBOOK.md`; the code migration lives in `MIGRATION.md`.

Tokens are decisions, not colors. Changing one token should improve every surface at once, never break one. Every value below is chosen so that its intended pairing meets **WCAG 2.2 AA**; the exact contrast ratios are tabulated and were computed, not assumed (see [Verified contrast](#verified-contrast)).

---

## 1. Token layers (the core architecture)

Tokens flow in one direction. A layer may only read from the layer directly above it. **A component never reads a Foundation token.**

```
Foundation   raw palette — every hex the system is allowed to contain
   ↓         (--brand-600, --neutral-100, --hue-emerald-500)
Semantic     role — what a value MEANS, theme-aware
   ↓         (--surface-card, --text-muted, --border-interactive, --status-danger-text)
Platform     the bridge — Fumadocs + Tailwind consume semantic tokens
   ↓         (--color-fd-card, tailwind theme aliases)
Component     one component's contract, only when semantic isn't enough
   ↓         (--callout-danger-bg, --code-line-highlight)
Application   a specific page instance (rare; last resort)
```

Why this matters: Foundation is the only place a literal hex may appear. Semantic is the only layer a human authors against day to day. Platform exists so Fumadocs never has a hand-set color. This is the layering the ADR mandated, made concrete.

**Hard rules**
- Never write a literal color in a component. `background: var(--surface-card)`, never `background: #fff`.
- Never expose a Foundation token to a component. Components read Semantic (or Component) tokens only.
- Never hand-set a `--color-fd-*` value. It is *derived* from a Semantic token in the Platform layer (§6).
- A new color that isn't already in Foundation is a change request, not an inline value.

---

## 2. Naming convention

```
--<category>-<role>[-<variant|state>]
```

| Category    | Examples                                                        |
| ----------- | --------------------------------------------------------------- |
| `surface`   | `--surface-page`, `--surface-card`, `--surface-elevated`        |
| `text`      | `--text-primary`, `--text-secondary`, `--text-muted`            |
| `border`    | `--border-subtle`, `--border-default`, `--border-interactive`   |
| `brand`     | `--brand-link`, `--brand-active`, `--brand-focus`               |
| `status`    | `--status-danger`, `--status-danger-text`, `--status-success`   |
| `learning`  | `--learning-application`, `--learning-router`                   |
| `space`     | `--space-4`, `--space-8`                                        |
| `radius`    | `--radius-md`, `--radius-pill`                                  |

Foundation tokens keep numeric scales (`--brand-600`, `--neutral-100`). Semantic tokens describe intent (`--surface-card`), never a color name. Banned: `--blue`, `--gray`, `--lightBlue`, `--color1`.

---

## 3. Foundation — the raw palette

These are theme-independent primitives. They are referenced *only* by the Semantic layer.

### 3.1 Brand (orange — the one interaction hue, anchored on the shipped logo `#F16913`)

> The 2.0 rebrand replaced the blue Electric Rush ramp with the orange ramp below. `#F16913` (500) matches the logo mark; 600/700 are the user-approved hover/active steps; 50–300 are light tints derived from 500. The ramp is deliberately lean — a documentation site doesn't need an 11-step brand scale. Semantic roles that need AA text contrast (link, hover) use dedicated darker shades beyond the ramp (see §4.4).

| Token         | Value     | Token         | Value     |
| ------------- | --------- | ------------- | --------- |
| `--brand-50`  | `#FFF2E6` | `--brand-500` | `#F16913` |
| `--brand-100` | `#FFE0C2` | `--brand-600` | `#DB5E10` |
| `--brand-200` | `#FFC48A` | `--brand-700` | `#C5530E` |
| `--brand-300` | `#FFA04D` |               |           |

### 3.2 Neutral (one canonical slate ramp, `50` = lightest → `950` = darkest, in **both** themes)

> The 1.0 draft renumbered the dark scale so `950` became lightest. That is confusing and error-prone. In 2.0 the numbers are fixed and universal; a theme changes *which step a role points at*, never the number→hex mapping.

| Token          | Value     | Token          | Value     |
| -------------- | --------- | -------------- | --------- |
| `--neutral-0`  | `#FFFFFF` | `--neutral-500`| `#64748B` |
| `--neutral-50` | `#F8FAFC` | `--neutral-600`| `#475569` |
| `--neutral-100`| `#F1F5F9` | `--neutral-700`| `#334155` |
| `--neutral-200`| `#E2E8F0` | `--neutral-800`| `#1E293B` |
| `--neutral-300`| `#CBD5E1` | `--neutral-900`| `#0F172A` |
| `--neutral-400`| `#94A3B8` | `--neutral-950`| `#020617` |

### 3.3 Ink (dark-theme surface steps — graphite, warmer than pure slate, for a calm deep feel)

Dark surfaces need finer steps than the slate ramp gives, so they live as their own primitives. Adopted from the 2.0 rebrand draft (was cool-slate `#0B1120…`).

| Token         | Value     | Used for (dark)     |
| ------------- | --------- | ------------------- |
| `--ink-page`  | `#0D1117` | page background     |
| `--ink-sidebar`| `#111827`| sidebar             |
| `--ink-card`  | `#161B22` | card / content well |
| `--ink-elevated`| `#1B2432`| popover, hover, inline code |
| `--ink-code`  | `#0A0F1C` | code block          |

### 3.4 Status hues (foundation)

Two shades per hue: a **base** (for icons, borders, fills — needs 3:1) and a **text** shade (for colored text on a light surface — needs 4.5:1). Dark theme uses lighter tints.

| Concept       | base (light UI) | text (light) | dark (text+UI) |
| ------------- | --------------- | ------------ | -------------- |
| success       | `#16A34A`       | `#15803D`    | `#22C55E`      |
| warning       | `#D97706`       | `#B45309`    | `#FBBF24`      |
| danger        | `#DC2626`       | `#DC2626`    | `#F87171`      |
| info          | `#0284C7`       | `#0369A1`    | `#38BDF8`      |
| experimental  | `#7C3AED`       | `#7C3AED`    | `#A78BFA`      |

### 3.5 Learning hues (foundation)

See [§5 Learning colors](#5-learning-colors) for the rules. Raw values only here.

| Concept       | light     | dark      |
| ------------- | --------- | --------- |
| application   | `#F16913` | `#FF8A34` |
| middleware    | `#7C3AED` | `#A78BFA` |
| router        | `#EA580C` | `#FB923C` |
| context       | `#0891B2` | `#22D3EE` |
| runtime *(ext)*| `#059669`| `#34D399` |
| extension *(ext)*| `#CA8A04`| `#FBBF24` |
| di *(ext)*    | `#9333EA` | `#C084FC` |

---

## 4. Semantic — the layer you author against

Every value below is theme-aware. This is the surface a human (or an AI) writes CSS against.

### 4.1 Surfaces (the depth ladder)

Adjacent layers are always visually distinct (the 1.0 draft made `page` and `card` both pure white — fixed here: the page is a hair off-white so cards *lift*).

| Semantic token       | Light      | Dark (ink) | Role                                   |
| -------------------- | ---------- | ---------- | -------------------------------------- |
| `--surface-page`     | `#FFF9F4`  | `#0D1117`  | outermost background — warm paper      |
| `--surface-sidebar`  | `#FFFCF9`  | `#111827`  | sidebar / secondary nav                |
| `--surface-card`     | `#FFFFFF`  | `#161B22`  | content card, the reading well         |
| `--surface-elevated` | `#F7EDE1`  | `#1B2432`  | popover, menu, hover, inline code chip |
| `--surface-code`     | `#FBF3EA`  | `#0A0F1C`  | code block                             |

Depth order (each step must read as a distinct plane): **page → sidebar → card → elevated → code**. Never place two identical surfaces adjacent.

### 4.2 Text

| Semantic token     | Light      | Dark       | Use                                        |
| ------------------ | ---------- | ---------- | ------------------------------------------ |
| `--text-primary`   | `#2A1208`  | `#F5F7FA`  | headings, body                             |
| `--text-secondary` | `#4E4038`  | `#D4D7DD`  | supporting body, text on tinted surfaces   |
| `--text-muted`     | `#7A6A60`  | `#99A2AF`  | metadata, captions — **on page/card only** |
| `--text-subtle`    | `#B4A79C`  | `#6B7280`  | **non-text only** — dividers, disabled, decorative |
| `--text-link`      | `#BC4E08`  | `#FF8A34`  | links (= `--brand-link`)                   |

> **Contrast rule that bites:** `--text-muted` passes AA on `--surface-page`/`--surface-card` but **still fails on `--surface-elevated`** in light mode (4.47:1 — warm paper improved it from 4.34 but not past 4.5). On any tinted surface, step up to `--text-secondary`. `--text-subtle` never carries meaning — it is decoration or disabled state, and always has a non-color backup (§7).

### 4.3 Borders

| Semantic token        | Light     | Dark      | Use                                              |
| --------------------- | --------- | --------- | ------------------------------------------------ |
| `--border-subtle`     | `#F6EBDD` | `#273142` | hairline reinforcement, table row dividers        |
| `--border-default`    | `#EFE3D7` | `#303B4C` | card / section edges (reinforcement, not sole cue) |
| `--border-strong`     | `#E0CCBA` | `#3A4A63` | emphasis dividers                                 |
| `--border-interactive`| `#8A7568` | `#64748B` | **form controls, toggles** — meets 3:1 (WCAG 1.4.11) |

> **Depth is not a border.** A `--border-default` hairline is ~1.2:1 against a white card — it cannot be the *sole* signal that something is a group or a control (it fails WCAG 1.4.11's 3:1). Grouping is carried by **surface delta + spacing** first; the border only reinforces. Only a real interactive control (input, checkbox) needs a boundary a user must find — those use `--border-interactive`, which is verified ≥3:1.

### 4.4 Brand (interaction only)

| Semantic token   | Light      | Dark       | Use                          |
| ---------------- | ---------- | ---------- | ---------------------------- |
| `--brand-link`   | `#BC4E08`  | `#FF8A34`  | links, current nav item      |
| `--brand-hover`  | `#8F3D08`  | `#FFA25C`  | link/nav hover               |
| `--brand-solid`  | `#C5530E`  | `#C5530E`  | primary button fill          |
| `--on-brand`     | `#FFFFFF`  | `#FFFFFF`  | text/icon on `--brand-solid` |
| `--brand-focus`  | `#DB5E10`  | `#F16913`  | focus ring (≥3:1 on page)    |
| `--brand-wash`   | `#FFF2E6`  | `color-mix(in srgb, var(--brand-500) 14%, transparent)` | selected/active nav background |

> **Why `--brand-solid` is `#C5530E`, not `#F16913`:** the identity orange fails AA for white text (3.10:1). The active-step `#C5530E` holds 4.55:1 with white (`--on-brand`) in both themes, so small primary buttons stay accessible while `#F16913` remains the identity/fill/large-text hue.
>
> **Why the text roles sit outside the ramp:** `--brand-link` (`#BC4E08`) and `--brand-hover` (`#8F3D08`) are dedicated shades darker than the ramp's `700` step, because AA-normal text on light surfaces demands more darkness than the interaction steps provide (4.96:1 / 7.40:1 on card). The ramp stays lean; these two are the only out-of-ramp brand values.

Brand color appears only for interaction and current-location. It never fills a hero, tints a card for decoration, or colors an icon that isn't a link. (Enforced by `DESIGN.md` §"Brand".)

### 4.5 Status (meaning only)

| Semantic token          | Light base (icon/border) | Light text  | Dark        |
| ----------------------- | ------------------------ | ----------- | ----------- |
| `--status-success`      | `#16A34A`                | —           | `#22C55E`   |
| `--status-success-text` | —                        | `#15803D`   | `#22C55E`   |
| `--status-warning`      | `#D97706`                | —           | `#FBBF24`   |
| `--status-warning-text` | —                        | `#B45309`   | `#FBBF24`   |
| `--status-danger`       | `#DC2626`                | `#DC2626`   | `#F87171`   |
| `--status-info`         | `#0284C7`                | —           | `#38BDF8`   |
| `--status-info-text`    | —                        | `#0369A1`   | `#38BDF8`   |
| `--status-experimental` | `#7C3AED`                | `#7C3AED`   | `#A78BFA`   |

Rule: use `-text` variants when the color is the *text* of a callout title or inline status word; use the base for icon + left border + fill. Never rely on the hue alone (§7).

### 4.6 Learning (educational visuals only)

`--learning-application`, `--learning-middleware`, `--learning-router`, `--learning-context` (+ extended: `--learning-runtime`, `--learning-extension`, `--learning-di`), each resolving to the theme value in §3.5. Rules in §5.

---

## 5. Learning colors

A framework's concepts become *recognizable* when each one keeps one immutable color everywhere it's taught. This is the system's most valuable teaching device — and its biggest rainbow risk. So it's bounded.

**Core 4 (locked, appear on the Introduction mental model and everywhere those concepts recur):**

| Concept     | Hue     | Icon pairing (never color-alone) |
| ----------- | ------- | -------------------------------- |
| Application | orange  | box / layers                     |
| Middleware  | violet  | layers / arrows                  |
| Router      | amber   | signpost / route                 |
| Context     | cyan    | package / dot                    |

**Extended (deep architecture diagrams only):** Runtime (emerald), Extension (gold), Dependency Injection (fuchsia).

**Rules**
1. Learning colors appear **only** in educational content: architecture diagrams, timelines, flowcharts, concept badges, teaching illustrations. Never page chrome, never decoration.
2. A single visual uses **≤ 5** learning hues. More than that is a rainbow — split the diagram.
3. **Never color-alone.** Every learning color is paired with an icon and a text label, so it survives colorblindness and grayscale print.
4. The map is **immutable.** `Router` is amber in the intro mental model, the request-lifecycle sequence diagram, and its concept-page badge — identically. Reassigning a concept's color is a versioned breaking change to this file.
5. `--learning-application` is the brand orange by design (the Application *is* the core). It only ever appears inside a diagram, never as interactive text, so it can't be mistaken for a link.

> **Rebrand note (2.0):** `application` moved blue → brand orange (`#F16913` light / `#FF8A34` dark) with the orange rebrand, aligning the core concept with the logo. `router` amber was deliberately kept — two different oranges in the same diagram would be confusing. This reassignment is itself versioned: any diagram is updated with the rest of the rebrand.

> **Reconciliation note:** an earlier page review suggested middleware=green / router=purple ad hoc. This file overrides that with the locked map above, because green is reserved for `success` + the `runtime` concept (a semantic collision), and consistency across every surface matters more than any one page's local choice. The Introduction page's per-step colors follow *this* table.

---

## 6. Platform layer — the Fumadocs bridge

Fumadocs renders from `--color-fd-*`. The design system **never hand-sets those**; it derives them from Semantic tokens. This is the abstraction layer the ADR required — change a Semantic token and Fumadocs follows for free.

```css
/* Platform bridge — set once per theme, derived from Semantic tokens. */
.light, .dark {
  --color-fd-background:         var(--surface-page);
  --color-fd-foreground:         var(--text-primary);
  --color-fd-card:               var(--surface-card);
  --color-fd-card-foreground:    var(--text-primary);
  --color-fd-popover:            var(--surface-elevated);
  --color-fd-popover-foreground: var(--text-primary);
  --color-fd-muted:              var(--surface-elevated);
  --color-fd-muted-foreground:   var(--text-muted);
  --color-fd-secondary:          var(--surface-elevated);
  --color-fd-secondary-foreground: var(--text-secondary);
  --color-fd-accent:             var(--brand-wash);
  --color-fd-accent-foreground:  var(--text-primary);
  --color-fd-border:             var(--border-default);
  --color-fd-primary:            var(--brand-link);
  --color-fd-primary-foreground: var(--on-brand);
  --color-fd-ring:               var(--brand-focus);
}
```

**Tailwind v4** reads the same Semantic tokens via `@theme` aliases (e.g. `--color-surface-card: var(--surface-card)`), so `bg-surface-card` and `var(--surface-card)` resolve identically. No component should reference a `--color-fd-*` token directly for new work — use the Semantic token; the bridge keeps Fumadocs' own chrome in sync.

---

## 7. Verified contrast (computed, not assumed)

Ratios below were computed with the WCAG relative-luminance formula. AA thresholds: **4.5:1** normal text, **3:1** large text (≥24px, or ≥19px bold) and UI components/graphical objects (1.4.11).

### Light (warm paper)

| Pair                                   | Ratio    | Threshold | Result |
| -------------------------------------- | -------- | --------- | ------ |
| text-primary `#2A1208` on card         | 17.67:1  | 4.5       | ✅     |
| text-secondary `#4E4038` on card       | 9.93:1   | 4.5       | ✅     |
| text-muted `#7A6A60` on card           | 5.17:1   | 4.5       | ✅     |
| text-muted `#7A6A60` on page           | 4.96:1   | 4.5       | ✅     |
| text-muted `#7A6A60` on **elevated**   | 4.47:1   | 4.5       | ❌ → use `--text-secondary` on tinted |
| text-secondary on elevated             | 8.59:1   | 4.5       | ✅     |
| text-subtle `#B4A79C` on card          | 2.35:1   | 4.5       | ⚠️ non-text only |
| brand-link `#BC4E08` on card           | 4.96:1   | 4.5       | ✅     |
| brand-link `#BC4E08` on page           | 4.75:1   | 4.5       | ✅     |
| brand-hover `#8F3D08` on card          | 7.40:1   | 4.5       | ✅     |
| on-brand `#FFFFFF` on brand-solid `#C5530E` | 4.55:1 | 4.5     | ✅     |
| brand-focus `#DB5E10` on page          | 3.58:1   | 3 (UI)    | ✅     |
| identity `#F16913` on card             | 3.10:1   | 4.5 text / 3 large | ⚠️ identity/large-text only |
| identity `#F16913` on page             | 2.97:1   | 3 large   | ⚠️ large-text only; not small |
| border-interactive `#8A7568` on card   | 4.35:1   | 3 (UI)    | ✅     |
| border-strong `#E0CCBA` on card        | 1.55:1   | 3 (UI)    | ⚠️ reinforcement only |
| border-default `#EFE3D7` on card       | 1.26:1   | 3 (UI)    | ⚠️ reinforcement only |
| status-danger `#DC2626` text on card   | 4.83:1   | 4.5       | ✅     |
| status-experimental `#7C3AED` on card  | 5.70:1   | 4.5       | ✅     |
| success **base** `#16A34A` on card     | 3.30:1   | 4.5 text / 3 icon | text ❌ → `-text` `#15803D` (5.02); icon ✅ |
| info **base** `#0284C7` on card        | 4.10:1   | 4.5 text / 3 icon | text ❌ → `-text` `#0369A1` (5.93); icon ✅ |
| warning-text `#B45309` on card         | 5.02:1   | 4.5       | ✅     |

### Dark (graphite)

| Pair                                   | Ratio    | Threshold | Result |
| -------------------------------------- | -------- | --------- | ------ |
| text-primary `#F5F7FA` on card         | 16.12:1  | 4.5       | ✅     |
| text-secondary `#D4D7DD` on card       | 12.00:1  | 4.5       | ✅     |
| text-muted `#99A2AF` on card           | 6.71:1   | 4.5       | ✅     |
| text-muted `#99A2AF` on elevated       | 6.05:1   | 4.5       | ✅ (ok on tinted in dark) |
| text-subtle `#6B7280` on card          | 3.58:1   | 4.5       | ⚠️ non-text only (doubles as functional border ≥3:1) |
| brand-link `#FF8A34` on card           | 7.36:1   | 4.5       | ✅     |
| brand-hover `#FFA25C` on card          | 8.71:1   | 4.5       | ✅     |
| on-brand `#FFFFFF` on brand-solid `#C5530E` | 4.55:1 | 4.5     | ✅ (same fill both themes) |
| brand-focus `#F16913` on page          | 6.10:1   | 3 (UI)    | ✅     |
| status-success `#22C55E` on card       | 7.59:1   | 4.5       | ✅     |
| status-danger `#F87171` on card        | 6.25:1   | 4.5       | ✅     |
| status-info `#38BDF8` on card          | 8.07:1   | 4.5       | ✅     |
| border-interactive `#64748B` on card   | 3.63:1   | 3 (UI)    | ✅     |
| learning router `#FB923C` on card      | 7.64:1   | 4.5       | ✅     |
| learning application `#FF8A34` on page | 8.05:1   | 4.5       | ✅     |

**Standing exceptions (by design, documented so an audit doesn't re-flag them):**
- `--text-subtle` is decoration/disabled only and always has a non-color backup — it is not required to meet 4.5.
- `--border-subtle`/`--border-default` are reinforcement, never the sole affordance — they are not required to meet 3:1. Real controls use `--border-interactive`.
- Every combination not listed must be re-verified by CI before shipping (the existing lighthouse a11y gate stays in force).

---

## 8. Spacing (8px system)

| Token | px | Token | px | Token | px |
| ----- | -- | ----- | -- | ----- | -- |
| `--space-1` | 4  | `--space-5` | 20 | `--space-12` | 48 |
| `--space-2` | 8  | `--space-6` | 24 | `--space-16` | 64 |
| `--space-3` | 12 | `--space-8` | 32 | `--space-20` | 80 |
| `--space-4` | 16 | `--space-10`| 40 | `--space-24` | 96 |

## 9. Radius

| Token | Value | Use |
| ----- | ----- | --- |
| `--radius-sm`  | 6px  | inline code, badges |
| `--radius-md`  | 10px | buttons, inputs |
| `--radius-lg`  | 12px | cards, code blocks |
| `--radius-xl`  | 16px | hero, large panels |
| `--radius-pill`| 9999px | pills, avatars |

## 10. Border width

| Token | Value |
| ----- | ----- |
| `--border-1` | 1px |
| `--border-2` | 2px (focus ring, active nav marker) |

## 11. Elevation / shadow

Depth is surfaces first. Shadows are allowed in exactly **one** situation: a true overlay that floats above content (popover, dropdown, dialog, command menu), where a surface change alone can't establish that it's on a higher plane.

| Token | Value | Use |
| ----- | ----- | --- |
| `--shadow-none`    | none | default for in-flow cards |
| `--shadow-overlay` | `0 8px 28px -12px rgba(2,6,23,0.28)` (light) / `0 12px 40px -12px rgba(0,0,0,0.55)` (dark) | popovers, menus, dialogs only |

Banned: glow, neon, pulsing shadows, decorative drop shadows on in-flow cards (see `DESIGN.md` "Things we never do").

## 12. Motion

| Token | Value | Use |
| ----- | ----- | --- |
| `--duration-fast`   | 100ms | hover, focus, small state |
| `--duration-normal` | 150ms | expand/collapse, nav |
| `--duration-slow`   | 250ms | overlay enter/exit |
| `--ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)` | default |
| `--ease-out`        | `ease-out` | enter |

**Reduced motion is a token-level requirement, not an afterthought:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Motion only communicates state (expand, collapse, navigate, appear). No decorative or looping animation (kills the current `pulse-glow`).

## 13. Z-index

| Token | Value | Token | Value |
| ----- | ----- | ----- | ----- |
| `--z-base` | 0 | `--z-overlay` | 300 |
| `--z-dropdown` | 100 | `--z-modal` | 400 |
| `--z-sticky` | 200 | `--z-toast` | 500 |

## 14. Breakpoints & reading widths

| Breakpoint | Value | | Width tier | Value | Use |
| ---------- | ----- |-| ---------- | ----- | --- |
| `--screen-sm` | 640px  | | `--width-prose`     | 68ch (~720px) | body text column |
| `--screen-md` | 768px  | | `--width-technical` | 1024px | prose + inline code/tables |
| `--screen-lg` | 1024px | | `--width-full`      | 100% (max 1280px) | wide tables, diagrams, API refs |
| `--screen-xl` | 1280px | | | | |
| `--screen-2xl`| 1536px | | | | |

> **Width strategy (resolves the 900→1020 conflict):** there is no single global width. Prose stays at `--width-prose` for a comfortable ~66–72 characters/line; code blocks, tables, and diagrams **break out** to `--width-technical`/`--width-full`. Reference pages default to `--width-technical`.

---

## 15. Implementation skeleton (how the layers stack in CSS)

```css
:root {
  /* Layer 1 — Foundation (theme-independent primitives) */
  --brand-600: #DB5E10;  --brand-700: #C5530E;  /* …full ramps… */
  --neutral-0: #FFFFFF;  --neutral-900: #0F172A; /* … */
  --ink-page: #0D1117;   --ink-card: #161B22;   /* … */
}

.light {
  /* Layer 2 — Semantic (roles point at Foundation) */
  --surface-page: #FFF9F4;  --surface-card: var(--neutral-0);
  --text-primary: #2A1208;  --text-muted: #7A6A60;
  --border-default: #EFE3D7; --border-interactive: #8A7568;
  --brand-link: #BC4E08;       --brand-focus: #DB5E10;
  /* Layer 3 — Platform bridge (§6) */
  --color-fd-card: var(--surface-card); /* … */
}

.dark {
  --surface-page: var(--ink-page);  --surface-card: var(--ink-card);
  --text-primary: #F5F7FA;          --text-muted: #99A2AF;
  --brand-link: #FF8A34;   /* … */
  --color-fd-card: var(--surface-card); /* … */
}
```

**The one rule that keeps this alive:** author against Semantic tokens. Foundation is edited by the design-system owner; `--color-fd-*` is edited by nobody (it's derived). If you're typing a hex into a component, stop — the value belongs in Foundation and the role belongs in Semantic.
