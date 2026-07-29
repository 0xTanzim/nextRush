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

### 3.1 Brand (blue — the one interaction hue, unchanged from Electric Rush)

| Token         | Value     | Token         | Value     |
| ------------- | --------- | ------------- | --------- |
| `--brand-50`  | `#EFF6FF` | `--brand-500` | `#3B82F6` |
| `--brand-100` | `#DBEAFE` | `--brand-600` | `#2563EB` |
| `--brand-200` | `#BFDBFE` | `--brand-700` | `#1D4ED8` |
| `--brand-300` | `#93C5FD` | `--brand-800` | `#1E40AF` |
| `--brand-400` | `#60A5FA` | `--brand-900` | `#1E3A8A` |
|               |           | `--brand-950` | `#172554` |

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

### 3.3 Ink (dark-theme surface steps — bluer than pure slate, for a calm ink feel)

Dark surfaces need finer steps than the slate ramp gives, so they live as their own primitives.

| Token         | Value     | Used for (dark)     |
| ------------- | --------- | ------------------- |
| `--ink-page`  | `#0B1120` | page background     |
| `--ink-sidebar`| `#0E1524`| sidebar             |
| `--ink-card`  | `#151D2E` | card / content well |
| `--ink-elevated`| `#1E2739`| popover, hover, inline code |
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
| application   | `#2563EB` | `#60A5FA` |
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
| `--surface-page`     | `#FBFCFE`  | `#0B1120`  | outermost background                   |
| `--surface-sidebar`  | `#F7F9FC`  | `#0E1524`  | sidebar / secondary nav                |
| `--surface-card`     | `#FFFFFF`  | `#151D2E`  | content card, the reading well         |
| `--surface-elevated` | `#F1F5F9`  | `#1E2739`  | popover, menu, hover, inline code chip |
| `--surface-code`     | `#F8FAFC`  | `#0A0F1C`  | code block                             |

Depth order (each step must read as a distinct plane): **page → sidebar → card → elevated → code**. Never place two identical surfaces adjacent.

### 4.2 Text

| Semantic token     | Light      | Dark       | Use                                        |
| ------------------ | ---------- | ---------- | ------------------------------------------ |
| `--text-primary`   | `#0F172A`  | `#F1F5F9`  | headings, body                             |
| `--text-secondary` | `#334155`  | `#CBD5E1`  | supporting body, text on tinted surfaces   |
| `--text-muted`     | `#64748B`  | `#94A3B8`  | metadata, captions — **on page/card only** |
| `--text-subtle`    | `#94A3B8`  | `#64748B`  | **non-text only** — dividers, disabled, decorative |
| `--text-link`      | `#2563EB`  | `#60A5FA`  | links (= `--brand-link`)                   |

> **Contrast rule that bites:** `--text-muted` passes AA on `--surface-page`/`--surface-card` but **fails on `--surface-elevated`** in light mode (4.34:1). On any tinted surface, step up to `--text-secondary`. `--text-subtle` never carries meaning — it is decoration or disabled state, and always has a non-color backup (§7).

### 4.3 Borders

| Semantic token        | Light     | Dark      | Use                                              |
| --------------------- | --------- | --------- | ------------------------------------------------ |
| `--border-subtle`     | `#EEF2F7` | `#1E293B` | hairline reinforcement, table row dividers        |
| `--border-default`    | `#E2E8F0` | `#273449` | card / section edges (reinforcement, not sole cue) |
| `--border-strong`     | `#CBD5E1` | `#3A4A63` | emphasis dividers                                 |
| `--border-interactive`| `#7C8797` | `#64748B` | **form controls, toggles** — meets 3:1 (WCAG 1.4.11) |

> **Depth is not a border.** A `--border-default` hairline is ~1.2:1 against a white card — it cannot be the *sole* signal that something is a group or a control (it fails WCAG 1.4.11's 3:1). Grouping is carried by **surface delta + spacing** first; the border only reinforces. Only a real interactive control (input, checkbox) needs a boundary a user must find — those use `--border-interactive`, which is verified ≥3:1.

### 4.4 Brand (interaction only)

| Semantic token   | Light      | Dark       | Use                          |
| ---------------- | ---------- | ---------- | ---------------------------- |
| `--brand-link`   | `#2563EB`  | `#60A5FA`  | links, current nav item      |
| `--brand-hover`  | `#1D4ED8`  | `#93C5FD`  | link/nav hover               |
| `--brand-solid`  | `#2563EB`  | `#2563EB`  | primary button fill          |
| `--on-brand`     | `#FFFFFF`  | `#FFFFFF`  | text/icon on `--brand-solid` |
| `--brand-focus`  | `#3B82F6`  | `#3B82F6`  | focus ring (≥3:1 on page)    |
| `--brand-wash`   | `#EFF6FF`  | `color-mix(in srgb, var(--brand-500) 14%, transparent)` | selected/active nav background |

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
| Application | blue    | box / layers                     |
| Middleware  | violet  | layers / arrows                  |
| Router      | amber   | signpost / route                 |
| Context     | cyan    | package / dot                    |

**Extended (deep architecture diagrams only):** Runtime (emerald), Extension (gold), Dependency Injection (fuchsia).

**Rules**
1. Learning colors appear **only** in educational content: architecture diagrams, timelines, flowcharts, concept badges, teaching illustrations. Never page chrome, never decoration.
2. A single visual uses **≤ 5** learning hues. More than that is a rainbow — split the diagram.
3. **Never color-alone.** Every learning color is paired with an icon and a text label, so it survives colorblindness and grayscale print.
4. The map is **immutable.** `Router` is amber in the intro mental model, the request-lifecycle sequence diagram, and its concept-page badge — identically. Reassigning a concept's color is a versioned breaking change to this file.
5. `--learning-application` is the brand blue by design (the Application *is* the core). It only ever appears inside a diagram, never as interactive text, so it can't be mistaken for a link.

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

### Light

| Pair                                   | Ratio    | Threshold | Result |
| -------------------------------------- | -------- | --------- | ------ |
| text-primary `#0F172A` on card         | 17.85:1  | 4.5       | ✅     |
| text-secondary `#334155` on card       | 10.35:1  | 4.5       | ✅     |
| text-muted `#64748B` on card           | 4.76:1   | 4.5       | ✅     |
| text-muted `#64748B` on page           | 4.64:1   | 4.5       | ✅     |
| text-muted `#64748B` on **elevated**   | 4.34:1   | 4.5       | ❌ → use `--text-secondary` on tinted |
| text-secondary on elevated             | 9.45:1   | 4.5       | ✅     |
| text-subtle `#94A3B8` on card          | 2.56:1   | 4.5       | ⚠️ non-text only |
| brand-link `#2563EB` on card           | 5.17:1   | 4.5       | ✅     |
| brand-hover `#1D4ED8` on card          | 6.70:1   | 4.5       | ✅     |
| on-brand `#FFFFFF` on brand-solid      | 5.17:1   | 4.5       | ✅     |
| status-danger `#DC2626` text on card   | 4.83:1   | 4.5       | ✅     |
| status-experimental `#7C3AED` on card  | 5.70:1   | 4.5       | ✅     |
| success **base** `#16A34A` on card     | 3.30:1   | 4.5 text / 3 icon | text ❌ → `-text` `#15803D` (5.02); icon ✅ |
| info **base** `#0284C7` on card        | 4.10:1   | 4.5 text / 3 icon | text ❌ → `-text` `#0369A1` (5.93); icon ✅ |
| warning-text `#B45309` on card         | 5.02:1   | 4.5       | ✅     |
| border-default `#E2E8F0` on card       | 1.23:1   | 3 (UI)    | ⚠️ reinforcement only |
| border-interactive `#7C8797` on card   | 3.64:1   | 3 (UI)    | ✅     |
| focus-ring `#3B82F6` on page           | 3.58:1   | 3         | ✅     |

### Dark

| Pair                                   | Ratio    | Threshold | Result |
| -------------------------------------- | -------- | --------- | ------ |
| text-primary `#F1F5F9` on card         | 15.37:1  | 4.5       | ✅     |
| text-secondary `#CBD5E1` on card       | 11.34:1  | 4.5       | ✅     |
| text-muted `#94A3B8` on card           | 6.57:1   | 4.5       | ✅     |
| text-muted `#94A3B8` on elevated       | 5.83:1   | 4.5       | ✅ (ok on tinted in dark) |
| text-subtle `#64748B` on card          | 3.54:1   | 4.5       | ⚠️ non-text only (doubles as functional border ≥3:1) |
| brand-link `#60A5FA` on card           | 6.62:1   | 4.5       | ✅     |
| status-success `#22C55E` on card       | 7.39:1   | 4.5       | ✅     |
| status-danger `#F87171` on card        | 6.09:1   | 4.5       | ✅     |
| status-info `#38BDF8` on card          | 7.86:1   | 4.5       | ✅     |
| border-interactive `#64748B` on card   | 3.54:1   | 3 (UI)    | ✅     |
| focus-ring `#3B82F6` on page           | 5.12:1   | 3         | ✅     |

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
  --brand-600: #2563EB;  --brand-400: #60A5FA;  /* …full ramps… */
  --neutral-0: #FFFFFF;  --neutral-900: #0F172A; /* … */
  --ink-card: #151D2E;   /* … */
}

.light {
  /* Layer 2 — Semantic (roles point at Foundation) */
  --surface-page: #FBFCFE;  --surface-card: var(--neutral-0);
  --text-primary: var(--neutral-900);  --text-muted: var(--neutral-500);
  --border-default: var(--neutral-200); --border-interactive: #7C8797;
  --brand-link: var(--brand-600);       --brand-focus: var(--brand-500);
  /* Layer 3 — Platform bridge (§6) */
  --color-fd-card: var(--surface-card); /* … */
}

.dark {
  --surface-page: var(--ink-page);  --surface-card: var(--ink-card);
  --text-primary: #F1F5F9;          --text-muted: #94A3B8;
  --brand-link: var(--brand-400);   /* … */
  --color-fd-card: var(--surface-card); /* … */
}
```

**The one rule that keeps this alive:** author against Semantic tokens. Foundation is edited by the design-system owner; `--color-fd-*` is edited by nobody (it's derived). If you're typing a hex into a component, stop — the value belongs in Foundation and the role belongs in Semantic.
