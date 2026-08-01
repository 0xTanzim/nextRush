# EDS-016 — MDX & Interactive Components

> Components are structured teaching tools, not decoration. The same rule that governs diagrams (EDS-012) governs every component: if it does not lower the reader's cognitive load, it does not belong on the page.

Modern docs (React, Next.js, Stripe, Astro, Cloudflare) read nothing like a wall of Markdown. They use tabs, steps, callouts, cards, and tabbed code groups to let a reader *scan*, *branch*, and *act*. This standard is how you use those components well — and how you avoid the far more common failure of drowning a page in them.

This standard is **tool-agnostic**. It names each component by its *job*, with the common names used by Fumadocs, Nextra, Docusaurus, Mintlify, and Starlight. Which components actually exist in this repo's site are listed in `.kiro/steering/documentation.instructions.md` — check availability there before using one.

---

## The one rule

A component earns its place only when the plain-Markdown alternative would be **harder to scan, harder to follow, or longer**. Prose is the default. Reach for a component when it beats prose at a specific job — never because the page "looks bare."

Three failure modes to avoid from the start:

- **Component soup** — every paragraph wrapped in a Callout, three Tabs and a Card in one screen. The eye has nowhere to rest and nothing stands out.
- **Wrong tool** — Tabs used for sequential steps, a Callout used for ordinary prose, an Accordion hiding content the reader needs.
- **Decoration** — a Card grid that only repeats the sidebar, a diagram that says what the sentence above it already said.

---

## The component catalog

### Callouts / Admonitions
*Common names:* `Callout`, `Aside`, `Admonition`, `Note`. **Use for** a single high-value aside the reader must not miss. Map the type to intent and keep it consistent site-wide:

| Type | Means | Use for |
|---|---|---|
| `note` / `info` | context | a clarification or a useful side fact |
| `tip` | best practice | the recommended path, a shortcut |
| `warning` | common mistake | a footgun that bites real users |
| `danger` / `caution` | risk | data loss, security, irreversible actions |

**Density:** at most one or two per screen. If a page has a callout every paragraph, the callouts have become the prose — demote most of them back to text. A callout that contains three paragraphs is no longer an aside; make it a section.

### Tabs
*Common names:* `Tabs`/`Tab`, `TabItem`. **Use for** genuinely *parallel* alternatives the reader picks between: runtime (Node/Bun/Deno/Edge), package manager, language (TS/JS), or a functional-vs-class API showing the *same* outcome. **Never** use tabs for sequential steps (use Steps) or to hide content the reader needs regardless of choice. Keep the tab order identical everywhere, and make the first tab the recommended default.

### Steps
*Common names:* `Steps`/`Step`. **Use for** an ordered procedure where each step depends on the last — the backbone of tutorials and guides. Each step has a short imperative heading, the action, and a way to verify it worked. Don't use Steps for an unordered list of options.

### Code blocks (the most important surface)
Plain fenced code, elevated. Always: a **language tag** for highlighting, and a **filename/title** when the file matters. Use, where the renderer supports it:

- **Line highlighting** to draw the eye to the 1–2 lines that matter (`{3,7-9}`).
- **Diff** (`+`/`-`) to show a change, not the whole file again.
- **Focus/dim** to fade boilerplate so the point stands out.
- A **copy button** (usually automatic) — which means the block must be copy-paste-runnable (EDS-013): real imports, no `...`.

### Code groups / tabbed code
*Common names:* `CodeGroup`, `Tabs` of code, `<CodeBlock>` sets. **Use for** the same example across languages/managers, or a multi-file example (`app.ts` + `router.ts` + `package.json`) shown as one unit. Keep files in dependency order.

### Package-install block
*Common names:* `PackageInstall`, `Tabs` of install commands. **Use for** any install line, so the reader's manager (pnpm/npm/yarn/bun) is one click away. Replaces hand-written `pnpm add …` blocks. (In a repo README destined for npm, this component won't render — fall back to a plain block; see the npm-vs-docs-site note below.)

### Type / property tables
*Common names:* `TypeTable`, `PropertyTable`, `ParamField`/`ResponseField`. **Use for** options, props, parameters, and return fields in reference pages — name, type, default, required, description. Far more scannable than prose for structured data, and the backbone of a Stripe-grade reference.

### Cards / card grids
*Common names:* `Card`/`Cards`, `LinkCard`, `Feature`/`FeatureGrid`. **Use for** navigation choices: the "where do I start" grid on a landing page, or a "next steps" grid at the end of a page. **Not** for prose, and not to duplicate the sidebar. A card = a title, one line, a link.

### Accordions / collapsibles
*Common names:* `Accordion`, `<details>`, `Disclosure`. **Use for** genuinely optional content: FAQ answers, a long log/output dump, an advanced tangent. **Never** hide something the reader needs on the happy path — collapsed content is content most readers never see.

### API / endpoint blocks
*Common names:* `APIPage`, `<endpoint>`, `Request`/`Response`, OpenAPI-generated blocks. **Use for** HTTP reference: method + path, params, an example request, and a real example response. Prefer generating from a schema (OpenAPI) when available, so the docs can't drift from the API.

### Diagrams
Owned by **EDS-012**. Mermaid renders on the docs site (mermaid 11 — all core + modern types: architecture, block, packet, sankey, xychart, treemap, radar, …) and GitHub, but **not on npm** — keep diagrams out of package READMEs (use ASCII or link out). Choose the most precise type (C4/architecture/sequence/state/ER over a generic flowchart) and **load the `mermaid` skill** (`~/.kiro/skills/mermaid/SKILL.md`) for the syntax. Note: **ZenUML is not wired into the `<Mermaid>` component yet** (needs a plugin) and **C4 is experimental** — see EDS-012's renderer table.

### Badges, tooltips, glossary terms
*Common names:* `Badge`, `Tooltip`, glossary `<Term>`. **Use sparingly** for status (`Beta`, `Deprecated`, `v3.2+`) and to define a term inline without derailing the sentence.

### Interactive: live code, sandboxes, embeds
*Common names:* live-code MDX, Sandpack, StackBlitz/CodeSandbox embeds, asciinema. **Use only** when *running* the example teaches something static code can't (an interactive API surface, a visual result). The cost is real: load weight, maintenance, and accessibility. A correct, copy-paste-runnable static block beats a fragile embed for almost everything. Never make understanding *depend* on an embed that may fail to load.

---

## Composition & density rules

- **One primary component per idea.** Let the reader finish one before the next begins.
- **Don't nest interactive components.** Tabs inside Steps inside a Callout is a maze. One level deep.
- **Alternate rhythm.** Prose → component → prose. Two components back-to-back with no connective sentence reads as a dump (same rule as diagrams in EDS-012).
- **Text carries the meaning; components carry the structure.** A reader with components stripped out (reader mode, a failed render, a screen reader) must still understand the page. This is both an accessibility requirement (EDS-017) and a portability one.

---

## Portability — components are not guaranteed to render

MDX components are renderer-specific. The same file may render richly on the docs site, as raw JSX on GitHub, and as broken text on npm.

- **Docs site (Fumadocs/Nextra/etc.):** full component set — the target for teaching pages.
- **GitHub (`.md` in-repo):** GFM only. Mermaid and alerts render; custom components do not.
- **npm (package README):** the most restricted — **no Mermaid, no relative images, custom components don't render.** Author READMEs in plain GFM with graceful fallbacks (see the package README template).

Rule: **never let comprehension depend on a component that the page's target surface can't render.** Put the meaning in text and structure; let the component enhance it.

---

## Accessibility (summarized here, owned by EDS-017)

- Tabs, Accordions, and Steps must be keyboard-navigable and screen-reader-labelled — use the framework's real component, never a `div` styled to look like one.
- A Callout's *type* (warning/danger) must not be the only signal — the text itself must state the severity, because color alone fails WCAG.
- Any image/diagram inside a component needs alt text or an adjacent written explanation.
- Collapsed content is invisible to search and to many readers — don't hide essentials.

---

## Anti-patterns (reject on sight)

- A Callout wrapping ordinary prose, or stacked callouts — the page is shouting, so nothing is heard.
- Tabs used for sequential steps, or hiding content that applies to every reader.
- A Card grid that just mirrors the left nav.
- An Accordion hiding a required step or a critical warning.
- A live/interactive embed where a static runnable block would teach the same thing more reliably.
- Components with no connective prose between them (component soup).
- Raw, unrendered component tags shipped because the target surface doesn't support them.

---

## Success criteria

A page uses components well when a reader can **scan it in seconds, branch to their exact case (runtime, language, manager) in one click, and copy code that runs** — and when removing every component still leaves a page that teaches. Components should make the page feel *faster*, never busier.
