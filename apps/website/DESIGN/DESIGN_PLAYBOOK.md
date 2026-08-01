# NextRush Documentation Design Playbook

- **Version:** 2.0
- **Status:** Draft for implementation
- **Owns:** HOW — layouts, navigation, components, states, page-type recipes, responsive/accessibility patterns, and the review checklist.
- **Reads from:** `DESIGN.md` (principles), `TOKENS.md` (values). This file never redefines a principle or a hex — it applies them. All colors below are **token names**; resolve them in `TOKENS.md`.

If `DESIGN.md` is the constitution and `TOKENS.md` is the vocabulary, this is the field manual: open it when you're building a component and need to know exactly what to do.

---

## How to use this file

1. Building a page → start at [Page anatomy](#page-anatomy) and the matching [page-type recipe](#page-type-recipes).
2. Building/using a component → find it in [Components](#components); every entry has **Purpose · Tokens · States · A11y · Do/Don't**.
3. Before opening a PR → run the [Review checklist](#review-checklist). A page isn't done until it's green *and* `pnpm docs:verify` passes.

## Golden rules (applied, not re-argued — see `DESIGN.md`)

1. Content outranks UI. 2. Reduce load before adding style. 3. Whitespace over decoration. 4. Typography over color. 5. Surface over shadow. 6. Consistency over creativity. 7. Every component has one purpose. 8. Every color cue has a non-color backup.

---

## Page anatomy

Standard Documentation-Mode page, top to bottom:

```
Breadcrumb            (where am I)
Title (H1)  ······  Page actions (Copy / View)   ← one row, actions right-aligned
Description
─────────────────────────────────────────────
Content
  Concept / prose        →  --width-prose
  Code / tables / diagrams →  break out to --width-technical/full
Callouts (inline, sparse)
Related links / next steps
Previous / Next pager
Feedback widget
```

Rules:
- **One page-actions toolbar**, on the title row, right-aligned — never duplicated at top *and* bottom. (If the platform injects a second one, suppress one; a reader must never wonder "why are there two?")
- Do not invent per-page layouts. A page that needs a new arrangement is a playbook change, not a local improvisation.

### Width application

| Content | Width tier |
| ------- | ---------- |
| Body prose, headings | `--width-prose` (~68ch) |
| Code blocks, tables, tab groups | break out to `--width-technical` (1024px) |
| Wide API tables, architecture diagrams | `--width-full` (≤1280px) |
| Reference pages (default) | `--width-technical` |

Prose stays narrow for line-length comfort; technical content breaks out. There is no single global width.

### Vertical rhythm

Space on the 8px system (`TOKENS.md` §8). Typical: H2 top `--space-12`, H3 top `--space-8`, paragraph gap `--space-4`, block (code/table/callout) `--space-6`–`--space-8`. Whitespace creates the section boundaries — not rules or color.

---

## Navigation

### Sidebar
- **Surface:** `--surface-sidebar` (distinct from `--surface-page`). **Purpose:** location, not branding.
- Active item: `--brand-link` text + `--brand-wash` background + a 2px `--brand-focus` left marker. Inactive: `--text-secondary`.
- Current section expanded; **max three indentation levels**. Group labels use `--text-muted`, uppercase, small.
- Collapsible on tablet; drawer on mobile. Every toggle is a real `<button>` with an `aria-label` and `cursor: pointer`.

### Header
- Quiet: logo, primary nav, search trigger, theme toggle, version. No marketing CTAs in Documentation Mode.
- Sticky; height feeds `--fd-nav-height` so Fumadocs' offset math stays correct.

### Table of contents (TOC)
- Right column. Active heading highlighted with `--brand-link`; inactive `--text-muted`.
- **Nest sub-sections** (H3 indented under H2) so the tree shows hierarchy — a flat TOC hides structure.
- Hidden on tablet/mobile (available via a "On this page" disclosure on mobile).

### Breadcrumbs
- Always visible on content pages. Separator `--text-subtle`; current page `--text-primary` (not a link); ancestors `--text-secondary` links.

### Pagination (Previous / Next)
- End of every sequential page. Two cards: label ("Previous"/"Next") in `--text-muted`, page title in `--text-primary`, directional chevron. Full keyboard focus + visible ring.

---

## Hero

- **Purpose:** orient — title, one-line description, metadata. Not a sales banner.
- **Surface:** `--surface-card` with an optional single `--brand-wash` tint (Documentation Mode's one allowed wash — flat or ≤6% radial, never repeated, never lowering text contrast).
- **Metadata pills** are ordered consistently: **Difficulty → Reading time → Runtime → Requirements** (`DocHeroPill`, `--surface-elevated` bg, `--text-secondary`).
- ❌ No large gradient banners, no glow, no decorative illustration in Documentation Mode.

---

## Components

Each entry: **Purpose · Tokens · States · A11y · Do/Don't.**

### Links
- **Purpose:** navigation. **Tokens:** `--brand-link`, hover `--brand-hover`.
- **States:** default (no underline in body prose is acceptable *only* if links are otherwise distinguishable; underline on hover always), hover (underline + `--brand-hover`), focus (visible ring), visited (no separate color needed).
- **A11y:** external links get an icon + "(opens in new tab)" affordance; link text is descriptive (never "click here").
- ✅ Underline on hover; descriptive text. ❌ Color-only links with no hover/focus affordance.

### Buttons
- **Purpose:** actions. **Tokens:** primary = `--brand-solid` fill + `--on-brand` text; secondary = `--surface-elevated` + `--text-primary` + `--border-interactive`; danger = `--status-danger`.
- **States:** default / hover (slightly darker) / active / focus (2px `--brand-focus` ring, offset) / disabled (`--text-subtle`, `cursor: not-allowed`).
- **A11y:** real `<button>`; name describes the action; ≥24px hit area; `cursor: pointer`.
- ✅ Flat fills, `--radius-md`. ❌ Gradient or glowing buttons; shadow on rest.

### Cards
- **Purpose:** group related information. **Tokens:** `--surface-card` on `--surface-page` (the surface delta does the lifting), `--border-default` as reinforcement, `--radius-lg`.
- **States:** static, or hover (border → `--border-strong`, `--duration-fast`) if the whole card is a link.
- **A11y:** if clickable, the whole card is one focusable link with a real accessible name; grouping is conveyed by heading + spacing, not the hairline alone.
- ✅ Subtle border + surface delta + spacing. ❌ Decorative cards, glow, translate-on-hover as decoration, floating shadows.

### Tables
- **Purpose:** structured comparison/reference. **Tokens:** header bg `--surface-elevated`, row divider `--border-subtle`, hover `--surface-elevated` at low mix, links `--brand-link`.
- **Rules:** left-align text, right-align numbers, sticky header when long, soft borders, light hover. Break out to `--width-technical`/`--width-full`.
- **A11y:** real `<th scope>`, `<caption>` where helpful; never a layout-only table.
- ✅ Soft dividers, readable density. ❌ Heavy zebra striping, hard black gridlines.

### Callouts
- **Purpose:** context / warning / risk. **Five types:** info, success, warning, danger, experimental.
- **Tokens:** left border = the status base hue (`--status-*`), icon = same hue, background = a low-mix tint of that hue on `--surface-card`, **body text = `--text-secondary`/`--text-primary`** (not the hue — it fails contrast on tinted bg). Slightly stronger left border (`--border-2`).
- **A11y:** icon + title text carry the meaning; color is reinforcement. Never color-only.
- **Density:** no back-to-back callouts; a page drowning in callouts has a structure problem (enforced by `docs:verify`).
- ✅ Icon + title + one clear message. ❌ Callout used for normal emphasis; stacked callouts.

### Badges
- **Purpose:** metadata (runtime, version, stability, difficulty, audience). **Tokens:** `--surface-elevated` bg + `--text-secondary`, or a status tint for stability (Stable/Experimental/Deprecated).
- **A11y:** the label is real text, not an icon alone.
- ✅ Sparingly, for metadata. ❌ Badges as decoration.

### Tabs
- **Purpose:** parallel alternatives (runtimes, functional vs class) — never sequential steps (use Steps).
- **Tokens:** active tab `--text-primary` + 2px `--brand-focus` underline; inactive `--text-muted`.
- **A11y:** ARIA tablist/tab/tabpanel; arrow-key navigation; selected state not by color alone (underline + weight).

### Code blocks & inline code
- **Purpose:** first-class content. **Tokens:** block bg `--surface-code`, border `--border-default`, title bar `--surface-elevated`; inline code `--surface-elevated` chip + `--radius-sm` + `--text-primary` (not muted — muted fails on the chip).
- **Every block:** language label, copy button, optional filename, highlighted-line support, horizontal scroll.
- **A11y:** copy button is a real `<button>` with `aria-label`; syntax colors are not the only signal of meaning; never pure `#000` background.
- ✅ Calm syntax theme from `--code-*` tokens. ❌ Saturated/neon syntax themes, pure black.

### Search
- **Purpose:** the fastest path to an answer — treat as a primary feature.
- **Result item:** page title (`--text-primary`), description (`--text-muted`), breadcrumb, matched section; **highlight matched text** with `--brand-wash`.
- **A11y:** full keyboard operation (open, arrow, enter, escape); results announced; visible focus on each result.

### Diagrams
- **Purpose:** replace hard-to-hold prose. Use the **precise** Mermaid type, not a generic flowchart (repo standard EDS-012; renderer = mermaid 11):

| Subject | Type |
| ------- | ---- |
| System/topology | `architecture-beta` |
| Request lifecycle, middleware order | `sequenceDiagram` |
| Connection/app lifecycle states | `stateDiagram-v2` |
| Data model | `erDiagram` / `classDiagram` |
| Component/module structure | `block-beta` |
| Genuine branching logic | `flowchart` (only here) |

- **Learning colors** in diagrams follow the locked map (`TOKENS.md` §5), always with icon + label. ≤5 hues per diagram.
- **A11y:** every diagram has a text alternative / caption that conveys the same information.

### Images
- Every image supports learning (architecture, screenshots, diagrams, timelines). Real `alt` text. No decorative illustration in Documentation Mode.

### Learning visuals (mental model, timeline)
- **Purpose:** teach the framework's shape. **Tokens:** per-concept `--learning-*` (locked), on `--surface-card`.
- **Timeline connector:** one continuous line touching each node (structural, not a dashed decoration). Nodes carry the concept's learning color + icon + label.
- **Concept cards** (Application/Middleware/Router/Context): color + icon + 2–3 short "what it owns/does" lines + a tiny (≤4-line) example. One section-level deep-dive link at the end — not a repeated "Learn more" after every step.

---

## States (never leave a blank region)

| State | Must show |
| ----- | --------- |
| **Empty** | what happened, why, and the next action (with a link/button) |
| **Loading** | skeleton loaders matched to the content shape; no large spinners |
| **Error / 404** | plain explanation, a search box, and links back to Docs home + popular pages |
| **No search results** | the query, a "no matches" message, and suggested/nearby pages |

Tokens: text `--text-secondary`, supporting `--text-muted`, illustration kept to a small neutral icon.

---

## Page-type recipes

Every page type uses the same language; the recipe sets width, surfaces, and which components appear.

| Page type | Mode | Default width | Signature components |
| --------- | ---- | ------------- | -------------------- |
| Landing / home | **Brand** | full | hero (Electric Rush), feature grid, CTA |
| Learn / Start | Docs | technical | hero, mental-model visual, next-steps journey |
| Guide | Docs | technical | steps, code, callouts, related links |
| Tutorial | Docs | technical | steps, code groups, checkpoints |
| Concept | Docs | prose (code breaks out) | short prose, diagrams, learning colors, one deep-dive link |
| Reference | Docs | technical | AutoTypeTable, option tables, minimal prose |
| Architecture | Docs | technical | sequence/architecture diagrams, prose |
| RFC | Docs | prose | structured prose, status badge |
| Package | Docs | technical | install, options table, examples (tiered per `documentation.instructions.md`) |
| Community | **Brand** | full | community cards, author cards |
| Blog | Brand-leaning | prose | title, author card, prose, share |
| Release notes / Changelog | Docs | technical | version headers, change lists, badges |
| Migration guide | Docs | technical | before/after code, callouts, checklist |
| 404 / Search results | Docs | technical | the state patterns above |

Rule: **Brand-Mode surfaces may express Electric Rush; every Docs-Mode surface follows this playbook exactly.** The boundary is the route, not the author's mood.

---

## Responsive behavior

| Breakpoint | Layout |
| ---------- | ------ |
| **Desktop** (≥1024px) | three columns: sidebar · content · TOC |
| **Tablet** (768–1023px) | collapsible sidebar, TOC hidden (disclosure), single content column |
| **Mobile** (<768px) | drawer navigation, single column, "On this page" as a disclosure, page-actions collapse into a menu |

- Content reflows to `--width-prose` naturally; code/tables gain horizontal scroll rather than shrinking text.
- Touch targets ≥24px (prefer ~44px on mobile); no hover-only affordances.

---

## Accessibility examples (concrete)

**Color is never the only cue**

```
✅  <span class="badge badge--experimental"><FlaskIcon/> Experimental</span>
❌  <span style="color: var(--status-experimental)">Experimental</span>   (hue only)
```

**Heading structure over visual weight**

```
✅  <DocSectionEyebrow>Fit check</DocSectionEyebrow>
    <h3>When NextRush fits</h3>            (eyebrow is visual; h3 keeps the outline)
❌  <p class="big-bold">When NextRush fits</p>   (looks like a heading, isn't one)
```

**Visible focus, real controls**

```
✅  <button aria-label="Copy code" class="… focus-visible:ring-2 …">
❌  <div onclick=…>                         (not focusable, no name, no ring)
```

**Muted text respects its surface**

```
✅  metadata in --text-muted on --surface-card / --surface-page
❌  --text-muted on --surface-elevated       (4.34:1, fails — use --text-secondary)
```

---

## Motion usage

Use motion only to communicate state: expand/collapse, navigation, overlay enter/exit, focus. Durations from `TOKENS.md` §12 (100–250ms). Honor `prefers-reduced-motion` (already global). No looping, no decorative parallax, no glow pulse.

---

## Do / Don't (consolidated)

| Do | Don't |
| --- | --- |
| Build depth from surface + spacing | Rely on a hairline border for grouping |
| Use one page-actions toolbar, title-right | Duplicate it top and bottom |
| Give each concept one locked learning color + icon | Recolor concepts per page, or use color alone |
| Keep concept-page code to ≤4–8 lines | Paste reference-sized code into a concept |
| One section-level deep-dive link | A "Learn more →" after every block |
| Order hero pills consistently | Random pill order per page |
| Break code/tables out; keep prose narrow | One global width for everything |
| Neutral 90 / brand 8 / semantic 2 | Multiple decorative accents |
| Callout = icon + title + one message | Stacked callouts / callout-as-emphasis |

---

## Review checklist

A documentation UI change is done only when every box is checked (and `pnpm docs:verify` is green).

**Layout & rhythm**
- [ ] Consistent 8px spacing; prose at `--width-prose`, technical content breaks out
- [ ] One page-actions toolbar; standard page anatomy
- [ ] Clear hierarchy built by layout/typography/surface before color

**Typography & content**
- [ ] Correct, unbroken heading outline (eyebrows for visual weight, not skipped levels)
- [ ] No banned marketing words; intent-describing headings (CI-enforced)
- [ ] Concept pages stay conceptual (short code, one deep-dive link)

**Navigation**
- [ ] Current location obvious (sidebar active, breadcrumb, TOC)
- [ ] TOC nests sub-sections; sidebar ≤3 levels

**Components**
- [ ] Every component consumes tokens — zero literal hex/spacing
- [ ] Callout density within limit; badges/callouts carry meaning with icon + text
- [ ] Diagrams use the precise Mermaid type + text alternative

**Color**
- [ ] Brand only for interaction/current location; semantic only for meaning
- [ ] Learning colors only in educational visuals, locked map, ≤5 per visual, never color-alone
- [ ] Neutrals dominate

**Accessibility (both themes)**
- [ ] WCAG 2.2 AA contrast verified; muted text not on tinted surfaces
- [ ] Keyboard operable, visible focus ring, real semantic controls, ≥24px targets
- [ ] Reduced motion honored; no color-only cues
- [ ] Empty/loading/error/no-results states designed

## Final test

Every element answers one question: **what problem does this solve for the developer?** If it doesn't improve learning, navigation, readability, or understanding — remove it.
