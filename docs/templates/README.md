# NextRush Templates

Canonical, professional-standard templates for the project's recurring documents. Copy the
template, fill it in, delete its guidance blocks (HTML comments + `> 📝` lines), and follow its
built-in **done-checklist** before publishing.

## The set

| Template | Location | Use for | Renders on |
| -------- | -------- | ------- | ---------- |
| **Package README** | [`package-readme.template.md`](./package-readme.template.md) | Every package's `README.md` (the npm page) | npm + GitHub |
| ↳ README authoring guide | [`package-readme-authoring-guide.md`](./package-readme-authoring-guide.md) | The rules behind the README template — read once before writing | — |
| **Package ARCHITECTURE** | [`package-architecture.template.md`](./package-architecture.template.md) | Every package's `ARCHITECTURE.md` (internal design) | GitHub |
| **RFC** | [`../RFC/TEMPLATE.md`](../RFC/TEMPLATE.md) | A design proposal / architectural change | GitHub |
| **ADR** | [`../adr/TEMPLATE.md`](../adr/TEMPLATE.md) | A terse final decision record | GitHub |
| **Audit report** | [`../../report/TEMPLATE.md`](../../report/TEMPLATE.md) | A point-in-time review / audit | GitHub |

> The package README template is the **clean skeleton** (placeholders + one-line hints, modelling
> the real README shape). All the depth — section-order rationale, tier matrix, callout
> conventions, the "what renders where" table, and the done-checklist — lives in its **authoring
> guide** so the template stays uncluttered.

## The README ≠ ARCHITECTURE split (read before writing either)

- **README.md** = *how to use it*. Published to npm, so it is a product surface. It must render
  perfectly on **npmjs.com**, which means **no Mermaid** (npm shows raw code) and **no relative
  images** (they break on npm — use absolute `raw.githubusercontent.com` URLs). Diagrams in the
  README are ASCII, or a link to ARCHITECTURE.md.
- **ARCHITECTURE.md** = *how it works and why*. Read on GitHub, which renders Mermaid natively —
  so this is where the sequence/flow/state diagrams and design-decision tables live.

Each package ships **both**, and they cross-link.

## Depth follows package tier

Both package templates scale by tier (`.kiro/steering/documentation.instructions.md`):

- **Tier 1** (core: `core`, `runtime`, `router`, `di`, `class`, `types`, `errors`) — full treatment.
- **Tier 2** (middleware / extensions / stream) — problem → usage → options → integration.
- **Tier 3** (adapters / dev / testing / create-nextrush) — lean: purpose → install → one example.

## Conventions shared by all templates

- Guidance lives in HTML comments and `> 📝` lines — **delete all of it** before shipping.
- Every template ends with a `- [ ]` **done-checklist** — tick it before publishing.
- Prefer a reference over a copy: link the RFC/ADR/steering that owns a fact, don't restate it.
- Advanced-markdown support differs by surface — the README template carries the authoritative
  "what renders where" table; consult it before using any GitHub-only feature in a published file.
