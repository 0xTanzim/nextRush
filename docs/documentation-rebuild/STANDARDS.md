# Documentation Page Standards

Contributor-facing reference for writing or rebuilding any page in `apps/docs`. This file
governs which template to start from and what the verification harness (T2) checks before a
page merges. It does not restate writing style rules — see
`.kiro/steering/docs-standards.instructions.md` (voice, tiering, word budgets) and
`.kiro/steering/docs-mdx-ui.instructions.md` (component usage) for those; this file is the
short index and the rules specific to template selection and enforcement.

## 1. Source of Truth

**Framework source code and each package's README are authoritative — not
`.kiro/steering/*.instructions.md`.**

`.kiro/steering/v3-architecture.instructions.md` says this explicitly of itself: it is a
best-effort historical overview, and "if this file and the source disagree, the source
wins — fix this file." The same rule applies to every page you write: before publishing a
claim about a signature, default value, or behavior, verify it against the real
`packages/*/src` code or the package's README, not against a steering file's memory of it.
Steering files describe *how to write*, not *what is true* — treat them as style guides, not
as specs.

If you find a steering file that disagrees with source, flag it or fix it in the same change
— do not silently document the steering file's version of reality.

## 2. The 7 Templates

All templates live in `docs/documentation-rebuild/templates/`. Copy one into
`apps/docs/content/docs/**` and fill in every `[PLACEHOLDER: ...]` marker before publishing —
a shipped page with an unfilled placeholder is a defect, not a draft.

| Template | Use when | Lives under |
| -------- | -------- | ----------- |
| `concept-template.mdx` | Explaining **why** a subsystem exists and how to think about it (middleware, DI, routing, modules, guards). No task, no exhaustive signatures. | `content/docs/concepts/` |
| `guide-template.mdx` | Solving **one specific task** in an existing app ("add JWT auth", "enable CORS"). Step-by-step, ends with a verification step. | `content/docs/guides/` |
| `reference-template.mdx` | **Lookup only** — signatures, parameters, options, return types, errors. No narrative, no "why." | `content/docs/reference/` (formerly `api-reference/`) |
| `tutorial-template.mdx` | Taking a reader from **zero to a running result**, teaching concepts in the order they're needed. Onboarding only — one entry point, not a general how-to. | `content/docs/start/` |
| `production-template.mdx` | An **operational concern** for a team already shipping — deployment, observability, security hardening, caching, scaling. | `content/docs/production/` |
| `recipe-template.mdx` | A **narrow, copy-paste** solution to a specific problem — shorter than a guide, no multi-step flow. | `content/docs/recipes/` |
| `migration-template.mdx` | Moving from **another framework**, or from a **deprecated NextRush API** to its replacement, or a **version upgrade**. | `content/docs/migrate/` |

If a page doesn't fit any of the 7 cleanly, it is probably two pages — split it rather than
force-fitting or inventing an eighth template. Don't invent a new page-type template when an
existing one already covers the need (same anti-sprawl rule as
`~/.kiro/steering/loop-engineering.md` applies to knowledge artifacts, not just prose).

## 3. Terminology Rules

These are enforced by the T2 lint check, not just style suggestions:

- **"segment trie," never "radix tree."** NextRush's router (`@nextrush/router`) is a segment
  trie. "Radix tree" is a stale term that leaked from an earlier design; it must not appear in
  any new or rewritten page.
- **Teach with `nextrush` / `nextrush/class` imports.** Concept, Guide, Tutorial, Production,
  and Recipe pages import from the meta package (`import { createApp, listen } from
  'nextrush'`) or its class subpath (`import { Controller, Get } from 'nextrush/class'`).
  Never introduce a granular `@nextrush/core`, `@nextrush/router`, `@nextrush/di`, etc. import
  in a teaching page — that's an implementation detail the reader doesn't need to know yet.
- **Granular `@nextrush/*` imports belong in Reference pages only.** A Reference page
  documenting a specific package's API legitimately imports from that package directly
  (`import { cors } from '@nextrush/cors'`) because the reader is there specifically to look
  up that package's surface.
- **Real package/version facts.** 35 publishable packages total. Core packages (`nextrush`,
  `core`, `router`, `class`, `di`, `errors`, `types`, `runtime`, `stream`) are at `3.1.0`.
  Newer middleware (`dev`, `cookies`, `csrf`, `logger`, `multipart`, `openapi`, `rate-limit`,
  `request-id`, `static`, `template`, `timer`, `validation`) are at `1.0.0`. Never state a
  single framework-wide version number — verify per-package against its `package.json`.
  `@nextrush/decorators` and `@nextrush/controllers` are deprecated compatibility shims for
  `@nextrush/class` — never present them as the primary way to do class-based development.

## 4. What the Verification Harness Enforces (T2)

The T2 harness lints every `.mdx` page under `apps/docs/content/docs/**` (and, once wired,
these templates) for:

- **Forbidden words** — the list in `.kiro/steering/docs-standards.instructions.md` §"Forbidden
  Words and Patterns": `simply`, `just`, `easy`, `obviously`, `straightforward`, `powerful`,
  `flexible`, `robust`, `enterprise-ready`, `etc.`, "This module provides…", "As mentioned
  above/below", a paragraph-leading "Note:", and marketing superlatives.
- **Heading-intent** — headings must describe intent, not structure. "Why middleware order
  matters" passes; "Details," "More information," and "Overview" fail.
- **Import-style** — teaching pages (Concept/Guide/Tutorial/Production/Recipe) must not import
  from a granular `@nextrush/*` package when `nextrush` or `nextrush/class` covers it; Reference
  pages are exempt from this specific check per §3 above.
- **Callout density** — max 3 callouts per page, never two back-to-back (per
  `.kiro/steering/docs-mdx-ui.instructions.md`).
- **Internal link resolution** — every relative link inside the page must resolve to a real
  page in the built site.
- **Terminology** — "radix tree" and any other retired term flagged in `.kiro/steering/
  v3-architecture.instructions.md`'s changelog is rejected.

See `apps/docs/scripts/` (once built under T2) for the actual lint implementation and exact
rule set — this section summarizes intent; the script is the executable source of truth for
what currently passes or fails.

## 5. Before You Publish

- [ ] Every `[PLACEHOLDER: ...]` in the template is filled in or the surrounding block is deleted.
- [ ] Every code example is copy-paste runnable and uses the correct import style for the page type (§3).
- [ ] Every factual claim (signature, default, behavior) is checked against real source, not memory or a steering file.
- [ ] The page passes the T2 lint check (`pnpm docs:verify` once available).
- [ ] Cross-links point at real pages — no placeholder or dead links remain.
