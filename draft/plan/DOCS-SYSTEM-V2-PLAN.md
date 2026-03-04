# NextRush Documentation System v2 — Architecture & Implementation Plan

> **Status**: APPROVED — Ready for implementation
> **Date**: March 4, 2026
> **PRD Source**: `/guide.md`
> **Decision**: Stay with Fumadocs. Build custom AI/agent layer on top.

---

## Executive Summary

Transform NextRush docs from a traditional documentation site into a **structured knowledge platform** that serves humans, AI agents, IDE integrations, and MCP-compatible tools. The system stays on Fumadocs v16 + Next.js 16 (static export) but adds machine-readable endpoints, page action bars, agent skills, build-time validation, and a premium UI overhaul.

**Key Insight**: Fumadocs already has `LLMCopyButton`, `ViewOptions`, content negotiation, and per-page `.mdx` route primitives. We integrate these rather than reinvent them.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State Audit](#2-current-state-audit)
3. [Feature Priority Matrix](#3-feature-priority-matrix)
4. [Technical Decisions](#4-technical-decisions)
5. [Implementation Phases](#5-implementation-phases)
6. [New File Structure](#6-new-file-structure)
7. [Risk Assessment](#7-risk-assessment)
8. [UI/UX Overhaul Plan](#8-uiux-overhaul-plan)
9. [Agent & MCP Strategy](#9-agent--mcp-strategy)
10. [Content Standards Enforcement](#10-content-standards-enforcement)
11. [Competitor Analysis](#11-competitor-analysis)
12. [Success Criteria](#12-success-criteria)

---

## 1. Architecture Overview

```
NextRush Documentation System v2
=================================

                     ┌─────────────────────────────────────────────┐
                     │              Content Layer                   │
                     │                                             │
                     │  apps/docs/content/docs/**     (MDX pages)  │
                     │  apps/docs/content/skills/**   (Agent skills)│
                     │  Frontmatter enforced by contract validator  │
                     └──────────────────┬──────────────────────────┘
                                        │
                     ┌──────────────────▼──────────────────────────┐
                     │          Build-Time Pipeline                 │
                     │                                             │
                     │  scripts/docs/build-docs.ts                 │
                     │  ├── Scan all MDX + skills                  │
                     │  ├── Validate contract compliance            │
                     │  ├── Generate llms.txt (spec-compliant)     │
                     │  ├── Generate skills/index.json             │
                     │  ├── Generate agent-spec.json               │
                     │  └── FAIL BUILD if violations found         │
                     └──────────────────┬──────────────────────────┘
                                        │
                     ┌──────────────────▼──────────────────────────┐
                     │          Next.js Static Export               │
                     │          (apps/docs)                         │
                     │                                             │
                     │  Human Endpoints:                            │
                     │  ├── /docs/**              (Fumadocs UI)    │
                     │  ├── /skills               (Skills browser) │
                     │  └── /                     (Landing page)   │
                     │                                             │
                     │  Machine Endpoints:                          │
                     │  ├── /llms.txt             (llmstxt.org)    │
                     │  ├── /llms-full.txt        (full concat)    │
                     │  ├── /docs/<path>.mdx      (per-page raw)  │
                     │  ├── /skills/index.json    (skills index)   │
                     │  ├── /skills/<name>.md     (skill raw)      │
                     │  ├── /agent-spec.json      (API spec)       │
                     │  └── /mcp.json             (MCP discovery)  │
                     │                                             │
                     │  Page Actions Bar (every docs page):         │
                     │  ├── Copy Markdown                           │
                     │  ├── View as Markdown                        │
                     │  ├── Open in ChatGPT                         │
                     │  ├── Open in Claude                          │
                     │  └── Connect to Cursor / VS Code             │
                     └──────────────────┬──────────────────────────┘
                                        │
                     ┌──────────────────▼──────────────────────────┐
                     │       Optional: MCP Server (Future)          │
                     │       apps/mcp-docs/                         │
                     │                                             │
                     │  Tools:                                      │
                     │  ├── search_docs(query)                     │
                     │  ├── get_page(slug)                         │
                     │  ├── list_skills()                          │
                     │  ├── get_skill(name)                        │
                     │  └── get_api_spec(package)                  │
                     └─────────────────────────────────────────────┘
```

### Data Flow

```
MDX Content → fumadocs-mdx (parse) → source loader → Static Routes
                                                    → Build-time generator
                                                    → Machine endpoints
```

### Key Constraint

**Static export** (`output: 'export'`). All endpoints must be statically generatable. No runtime server. This constraint shapes every technical decision.

---

## 2. Current State Audit

### Quality Score: 7.8/10

| Section         | Score | Pages | Key Issues                                                |
| --------------- | ----- | ----- | --------------------------------------------------------- |
| Getting Started | 8.5   | 3     | Clean                                                     |
| Concepts        | 9.0   | 7     | Flagship content — near-perfect                           |
| Architecture    | 8.5   | 6     | Minor overlap with concepts                               |
| Packages        | 7.5   | ~37   | Broken Mermaid tag, some missing Troubleshooting sections |
| Guides          | 8.0   | 8     | Practical and well-structured                             |
| Examples        | 7.5   | 6     | Some overly long                                          |
| Benchmarks      | 7.0   | 1     | Thin, no reproduction scripts                             |
| Community       | 6.5   | 4     | Sparse changelog, version inconsistency                   |
| Landing         | 8.0   | 1     | Hardcoded colors, marketing language                      |

### Critical Bugs (Must Fix First)

| #   | Bug                                             | File                                                         | Severity |
| --- | ----------------------------------------------- | ------------------------------------------------------------ | -------- |
| 1   | OG image says "My App" not "NextRush"           | `apps/docs/src/app/og/docs/[...slug]/route.tsx` (line 15)    | HIGH     |
| 2   | Broken Mermaid `"/>` renders as visible text    | `apps/docs/content/docs/packages/index.mdx` (line 83)        | HIGH     |
| 3   | Version inconsistency (alpha vs stable)         | `changelog.mdx`, `hero.tsx`                                  | HIGH     |
| 4   | "Blazing Fast" marketing language (7 instances) | `hero.tsx`, `features.tsx`, `layout.tsx`, `feature-grid.tsx` | MEDIUM   |
| 5   | Hardcoded hex colors (no CSS vars)              | `page.tsx`, `hero.tsx`, `features.tsx`                       | MEDIUM   |
| 6   | No favicon or logo in public/                   | Missing files                                                | MEDIUM   |

### Existing Primitives We Keep

| Primitive                        | File                         | Purpose                      |
| -------------------------------- | ---------------------------- | ---------------------------- |
| `getText('processed')`           | `source.ts` → `getLLMText()` | Markdown extraction per page |
| `/llms-full.txt` endpoint        | `llms-full.txt/route.ts`     | Full concatenated text       |
| `includeProcessedMarkdown: true` | `source.config.ts`           | Enables markdown export      |
| Static search API                | `api/search/route.ts`        | Orama search                 |
| `createRelativeLink`             | `page.tsx`                   | MDX relative links           |

---

## 3. Feature Priority Matrix

### P0 — Ship Blockers (Must land for v2 launch)

| Feature                                          | Effort | What Exists                            | What to Build                                             |
| ------------------------------------------------ | ------ | -------------------------------------- | --------------------------------------------------------- |
| Fix audit bugs (OG, Mermaid, version, marketing) | **S**  | Broken code                            | Patches only                                              |
| llms.txt (spec-compliant)                        | **L**  | `/llms-full.txt` (non-spec)            | New `/llms.txt` route with proper H1/H2/blockquote format |
| Per-page Markdown endpoint                       | **M**  | `getText('processed')` exists          | New `[...slug].mdx/route.ts`                              |
| Copy Page as Markdown button                     | **M**  | Fumadocs `LLMCopyButton` exists        | Integrate into page template                              |
| Build-time contract validator                    | **XL** | Docs standards instruction file exists | `scripts/docs/build-docs.ts` + CI enforcement             |

### P1 — AI/Agent Core

| Feature                         | Effort | What Exists            | What to Build                                             |
| ------------------------------- | ------ | ---------------------- | --------------------------------------------------------- |
| View as Markdown (link)         | **S**  | Per-page endpoint (P0) | Add link to page actions                                  |
| Agent Skills Directory          | **L**  | Nothing                | Content collection + `/skills/` UI + `/skills/index.json` |
| agent-spec.json                 | **L**  | Nothing                | Schema definition + generator                             |
| Open in ChatGPT / Claude        | **M**  | Nothing                | Deep link construction + buttons                          |
| Copy MCP Server URL + /mcp.json | **M**  | Nothing                | Discovery document + UI button                            |

### P2 — Premium UX

| Feature                             | Effort | What Exists                            | What to Build                              |
| ----------------------------------- | ------ | -------------------------------------- | ------------------------------------------ |
| UI/UX overhaul (CSS vars, theming)  | **L**  | CSS vars defined but unused in landing | Replace hardcoded colors, add brand assets |
| Connect to VS Code / Cursor buttons | **M**  | Nothing                                | Extension deep links                       |
| Versioning (/v1, /v2)               | **XL** | Nothing                                | Dual source loaders, versioned routes      |
| Favicon + Logo + Brand assets       | **S**  | Nothing                                | Add to `app/` and `public/`                |

### P3 — Future

| Feature                                  | Effort | What Exists | What to Build                       |
| ---------------------------------------- | ------ | ----------- | ----------------------------------- |
| MCP Server (separate app)                | **XL** | Nothing     | `apps/mcp-docs/` with tool handlers |
| CLI integration (`nextrush docs --json`) | **L**  | Nothing     | CLI command in `@nextrush/dev`      |

---

## 4. Technical Decisions

### Decision 1: Use Fumadocs Built-in AI Components

**Options**: (A) Build custom copy/view components, (B) Use Fumadocs `LLMCopyButton` + `ViewOptions`
**Chosen**: **(B)** — Fumadocs already provides these components with clipboard API, markdown URL fetching, and GitHub link integration.
**Trade-offs**: Coupled to Fumadocs component API; acceptable since we're committed to the platform.

### Decision 2: Per-page .mdx Endpoints via Next.js Route Handlers

**Options**: (A) Content negotiation middleware, (B) Separate `[...slug].mdx/route.ts`
**Chosen**: **(B)** — Static export requires pre-generated routes. Content negotiation is runtime-only.
**Trade-offs**: Extra route files; but clean separation and guaranteed static export compatibility.

### Decision 3: llms.txt as Build-Time Static File

**Options**: (A) Route handler generating at request time, (B) Build script writes `public/llms.txt`
**Chosen**: **(A)** — Route handler with `export const revalidate = false` + `generateStaticParams`. Same pattern as existing `/llms-full.txt`. Next.js static export pre-renders it.
**Trade-offs**: None significant; keeps consistency with existing patterns.

### Decision 4: Contract Validation as Separate Script (Not MDX Plugin)

**Options**: (A) MDX remark plugin that fails on missing sections, (B) Standalone script scanning content
**Chosen**: **(B)** — Standalone script is testable, debuggable, and doesn't couple validation logic to the MDX pipeline. Runs in `prebuild` hook.
**Trade-offs**: Doesn't fail at the exact MDX compilation step; but faster feedback loop.

### Decision 5: Skills as Fumadocs Collection (Not Custom Loader)

**Options**: (A) Raw file scanning, (B) Fumadocs `defineDocs` / `defineCollections` with custom schema
**Chosen**: **(B)** — Reuse Fumadocs' content management for skills. Get frontmatter validation, hot reload, and source API for free.
**Trade-offs**: Skills content must follow Fumadocs conventions.

### Decision 6: agent-spec.json Schema is Hand-Defined (Not Auto-Generated from Code)

**Options**: (A) Auto-generate from TypeScript source, (B) Hand-define schema, populate from MDX frontmatter
**Chosen**: **(B)** for v2 launch — Auto-generation from TS source requires AST parsing infrastructure that's out of scope. The spec is populated from structured MDX sections that the contract validator enforces.
**Trade-offs**: Manual sync risk; mitigated by contract validation failing builds.

### Decision 7: No Versioning in v2.0 Launch

**Options**: (A) Ship with /v1 + /v2, (B) Ship single version, add versioning later
**Chosen**: **(B)** — There is no v1 docs to version. The current docs ARE v1. Versioning adds route complexity and content duplication with zero user value right now.
**Trade-offs**: Must implement versioning before any breaking docs changes post-v2 launch.

### Decision 8: MCP Server Deferred to v2.1

**Options**: (A) Build MCP server now, (B) Ship /mcp.json discovery now, build server later
**Chosen**: **(B)** — The `/mcp.json` discovery endpoint is trivial to ship. The actual MCP server (protocol handling, tool definitions, deployment) is XL effort and the protocol is still evolving.
**Trade-offs**: "Connect to Cursor/VS Code" buttons show the URL but can't auto-connect until MCP server exists.

---

## 5. Implementation Phases

### Phase 0: Bug Fixes (Day 1) — Effort: S

Fix all 6 audit bugs before any new features. Clean foundation.

| Task                      | File(s)                                  | Change                                   |
| ------------------------- | ---------------------------------------- | ---------------------------------------- |
| Fix OG site name          | `og/docs/[...slug]/route.tsx`            | `site="My App"` → `site="NextRush"`      |
| Fix Mermaid tag           | `packages/index.mdx`                     | Remove trailing `"/>`                    |
| Fix version labels        | `changelog.mdx`, `roadmap.mdx`           | Align to `3.0.0-alpha.2`                 |
| Remove marketing language | `hero.tsx`, `features.tsx`, `layout.tsx` | Replace "Blazing Fast" with factual copy |
| Replace hardcoded colors  | `page.tsx`, `hero.tsx`, `features.tsx`   | Use CSS variables from `global.css`      |
| Add favicon               | `app/icon.svg` or `app/favicon.ico`      | Create NextRush logo asset               |

**Validation**: `pnpm --filter docs build` succeeds. Visual smoke test.

---

### Phase 1: Machine Endpoints (Week 1) — Effort: L

Build the foundation that all AI features depend on.

#### 1.1 — llms.txt (Spec-Compliant)

Create `apps/docs/src/app/llms.txt/route.ts`:

```typescript
// Format per llmstxt.org specification:
// # NextRush
// > High-performance modular Node.js framework
//
// ## Docs
// - [Core](https://nextrush.dev/docs/core.md): Application lifecycle
// - [Router](https://nextrush.dev/docs/router.md): Radix tree routing
//
// ## Optional
// - [Examples](https://nextrush.dev/docs/examples.md)
```

**Spec Requirements** (from llmstxt.org):

- H1 with project name (required)
- Blockquote with short summary
- H2 sections grouping related URLs
- Each URL has `: description` suffix
- "Optional" H2 for secondary content
- URLs point to `.md` versions of pages

#### 1.2 — Per-Page .mdx Endpoint

Create `apps/docs/src/app/docs/[...slug].mdx/route.ts`:

```typescript
import { source } from '@/lib/source';

export const revalidate = false;

export async function GET(_req: Request, { params }: { params: { slug: string[] } }) {
  const page = source.getPage(params.slug);
  if (!page) return new Response('Not found', { status: 404 });

  const text = await page.data.getText('processed');
  return new Response(`# ${page.data.title}\n\n${text}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
```

#### 1.3 — Keep /llms-full.txt

The existing endpoint stays. It's the "full context dump" (concatenated). The new `/llms.txt` is the structured index.

**Validation**: After build, verify `out/llms.txt` and `out/docs/**/*.mdx` files exist.

---

### Phase 2: Page Actions Bar (Week 1-2) — Effort: M

#### 2.1 — Integrate Fumadocs Components

Modify `apps/docs/src/app/docs/[[...slug]]/page.tsx`:

```tsx
import { LLMCopyButton } from 'fumadocs-ui/components/llm-copy-button';
import { ViewOptions } from 'fumadocs-ui/components/view-options';

// Inside the DocsPage component, before DocsBody:
<div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
  <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
  <ViewOptions
    markdownUrl={`${page.url}.mdx`}
    githubUrl={`https://github.com/nextrushjs/nextrush/blob/main/apps/docs/content/docs/${page.file.path}`}
  />
</div>;
```

#### 2.2 — Add AI Deep Links

Create `apps/docs/src/components/ai-actions.tsx`:

```tsx
// Deep link patterns:
// ChatGPT: https://chatgpt.com/?q=<encoded_prompt>
// Claude:  https://claude.ai/new?q=<encoded_prompt>
//
// Prompt template:
// "I'm working with NextRush (https://nextrush.dev).
//  Read this page: {page_url}.mdx
//  Help me with: {page_title}"
```

#### 2.3 — Add "Connect" Buttons

- **Cursor**: Deep link to install skill/context from URL
- **VS Code**: `vscode://` protocol link to open context

**Validation**: Manual test — buttons visible, copy works, deep links open correct providers.

---

### Phase 3: Skills System (Week 2-3) — Effort: L

#### 3.1 — Define Skills Collection

Update `apps/docs/source.config.ts`:

```typescript
export const skills = defineDocs({
  dir: 'content/skills',
  docs: {
    schema: skillsFrontmatterSchema, // Custom Zod schema
  },
});
```

#### 3.2 — Create Initial Skills

```
apps/docs/content/skills/
├── meta.json
├── add-middleware.mdx
├── create-plugin.mdx
├── build-rest-api.mdx
├── setup-authentication.mdx
├── configure-cors.mdx
├── add-rate-limiting.mdx
├── create-controller.mdx
├── setup-dependency-injection.mdx
└── deploy-to-production.mdx
```

Frontmatter schema per PRD:

```yaml
---
title: Add Middleware
skill: add-middleware
version: '2.0'
trigger:
  - add middleware
  - create middleware
  - new middleware
package: '@nextrush/core'
difficulty: beginner
---
```

#### 3.3 — Skills Index Endpoint

Create `apps/docs/src/app/skills/index.json/route.ts` — returns structured JSON of all skills.

#### 3.4 — Skills UI Page

Create `apps/docs/src/app/skills/page.tsx` — browsable directory with search, filter by package/difficulty, and install/copy buttons.

**Validation**: `out/skills/index.json` exists with correct structure. UI page renders.

---

### Phase 4: Machine Specs (Week 3) — Effort: L

#### 4.1 — agent-spec.json

Create `apps/docs/src/app/agent-spec.json/route.ts`:

```json
{
  "name": "nextrush",
  "version": "3.0.0-alpha.2",
  "description": "High-performance modular Node.js framework",
  "homepage": "https://nextrush.dev",
  "docs": {
    "base_url": "https://nextrush.dev/docs",
    "llms_txt": "https://nextrush.dev/llms.txt",
    "llms_full": "https://nextrush.dev/llms-full.txt",
    "skills": "https://nextrush.dev/skills/index.json"
  },
  "packages": [
    {
      "name": "@nextrush/core",
      "responsibility": "Application lifecycle, middleware composition, plugin system",
      "doc_url": "https://nextrush.dev/docs/packages/core/core",
      "public_api": ["createApp", "compose", "Plugin"]
    }
  ],
  "constraints": [
    "Zero external runtime dependencies",
    "TypeScript strict mode",
    "Node.js >= 22.0.0"
  ]
}
```

#### 4.2 — mcp.json

Create `apps/docs/src/app/mcp.json/route.ts`:

```json
{
  "name": "nextrush-docs",
  "version": "1.0.0",
  "description": "NextRush documentation MCP server",
  "endpoints": {
    "docs": "https://nextrush.dev/docs",
    "llms_txt": "https://nextrush.dev/llms.txt",
    "llms_full": "https://nextrush.dev/llms-full.txt",
    "skills": "https://nextrush.dev/skills/index.json",
    "agent_spec": "https://nextrush.dev/agent-spec.json"
  },
  "tools": [
    {
      "name": "search_docs",
      "description": "Search NextRush documentation",
      "status": "planned"
    },
    {
      "name": "get_page",
      "description": "Get a specific documentation page as Markdown",
      "status": "planned"
    },
    {
      "name": "list_skills",
      "description": "List available agent skills",
      "status": "planned"
    }
  ]
}
```

**Validation**: JSON files valid and accessible after build.

---

### Phase 5: Build-Time Validator (Week 3-4) — Effort: XL

#### 5.1 — Contract Validator Script

Create `scripts/docs/build-docs.ts`:

```
Responsibilities:
1. Scan all MDX files in content/docs/
2. Parse frontmatter (title, description required)
3. Extract H2 headings from body
4. Validate tier-based section requirements:
   - Tier 1 packages: 13 required sections
   - Tier 2 packages: 8 required sections
   - Tier 3 packages: 5 required sections
5. Scan for forbidden words
6. Check word budget compliance
7. Output validation report
8. Exit code 1 on violations (fails CI build)
```

#### 5.2 — Documentation Standard Contract

Per PRD, every package page must include these H2 sections:

```markdown
## Responsibility

## Public API

## Lifecycle

## Extension Points

## Failure Modes

## Performance Notes

## Security Considerations

## Version Compatibility
```

These are in ADDITION to the tier-based sections from `docs-standards.instructions.md`.

#### 5.3 — Integration

Wire into `apps/docs/package.json`:

```json
{
  "scripts": {
    "prebuild": "tsx ../../scripts/docs/build-docs.ts --validate",
    "build": "fumadocs-mdx && next build"
  }
}
```

**Validation**: Add intentionally broken fixture, verify build fails.

---

### Phase 6: UI/UX Overhaul (Week 4-5) — Effort: L

See [Section 8](#8-uiux-overhaul-plan) for details.

---

### Phase 7: MCP Server (Post-v2.1) — Effort: XL

See [Section 9](#9-agent--mcp-strategy) for details.

---

## 6. New File Structure

```
apps/docs/
├── content/
│   ├── docs/           (existing — 69 MDX pages)
│   └── skills/         (NEW — agent skills collection)
│       ├── meta.json
│       ├── add-middleware.mdx
│       ├── create-plugin.mdx
│       └── ...
├── public/
│   ├── favicon.ico     (NEW)
│   └── logo.svg        (NEW)
├── src/
│   ├── app/
│   │   ├── llms.txt/route.ts              (NEW — spec-compliant index)
│   │   ├── llms-full.txt/route.ts         (existing — keep)
│   │   ├── agent-spec.json/route.ts       (NEW)
│   │   ├── mcp.json/route.ts             (NEW)
│   │   ├── docs/
│   │   │   ├── [[...slug]]/page.tsx       (MODIFY — add page actions)
│   │   │   └── [...slug].mdx/route.ts    (NEW — per-page markdown)
│   │   ├── skills/
│   │   │   ├── page.tsx                   (NEW — skills browser)
│   │   │   ├── [skill]/page.tsx           (NEW — skill detail)
│   │   │   └── index.json/route.ts        (NEW — skills JSON)
│   │   └── og/docs/[...slug]/route.tsx    (MODIFY — fix "My App")
│   ├── components/
│   │   ├── page-actions.tsx               (NEW — action bar wrapper)
│   │   ├── ai-actions.tsx                 (NEW — ChatGPT/Claude/Cursor links)
│   │   └── home/
│   │       ├── hero.tsx                   (MODIFY — remove marketing)
│   │       └── features.tsx              (MODIFY — CSS vars)
│   └── lib/
│       ├── source.ts                      (MODIFY — add skills source)
│       ├── skills/
│       │   └── source.ts                  (NEW — skills loader)
│       └── llm/
│           ├── deeplinks.ts               (NEW — AI provider URLs)
│           └── format.ts                  (NEW — markdown formatting)
├── source.config.ts                       (MODIFY — add skills collection)
└── next.config.mjs                        (MODIFY — add rewrites if needed)

scripts/
└── docs/
    ├── build-docs.ts                      (NEW — validator + generator)
    ├── contracts.ts                        (NEW — contract definitions)
    └── mdx-scan.ts                         (NEW — MDX parser utilities)
```

**New files**: ~18
**Modified files**: ~8
**Total scope**: ~26 files

---

## 7. Risk Assessment

| Risk                                                | Level        | Mitigation                                                               |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Static export breaks with new route patterns        | HIGH         | Test `[...slug].mdx` route naming early. Verify `out/` output.           |
| Fumadocs `LLMCopyButton` API changes                | LOW          | Pin fumadocs-ui version. Component API is stable.                        |
| ChatGPT/Claude deep link formats change             | MEDIUM       | Wrap in abstraction. Fallback: "Copy prompt" button.                     |
| Contract validator blocks all builds                | HIGH         | Start with warnings-only mode. Escalate to errors after content cleanup. |
| Skills collection interferes with docs source       | LOW          | Separate `defineDocs` call. Independent namespace.                       |
| MCP protocol spec evolves                           | LOW (for v2) | Only ship `/mcp.json` discovery. No protocol implementation yet.         |
| Content migration to meet contract                  | HIGH         | Phase 5 after content cleanup. Gradual enforcement.                      |
| Performance regression (more routes = slower build) | MEDIUM       | Profile build times. ~70 new `.mdx` routes is acceptable.                |

---

## 8. UI/UX Overhaul Plan

### Current Problems

1. **Hardcoded colors**: Landing page uses inline hex values instead of CSS custom properties
2. **No brand assets**: No favicon, no logo, no apple-touch-icon
3. **Marketing language**: "Blazing Fast" (7 instances) violates docs standards
4. **Landing page**: Looks generic — no distinctive NextRush identity
5. **No light mode**: Hardcoded dark colors break light mode
6. **Version confusion**: Hero badge says alpha, changelog says stable

### Design System Alignment

The CSS variables already exist in `global.css` ("Electric Rush" theme):

```css
--rush-blue, --rush-purple, --rush-cyan, --rush-green
--rush-gradient, --rush-glow-blue, --rush-glow-purple
```

Replace ALL hardcoded hex values with these variables.

### UI Enhancement Targets

| Component     | Current                | Target                                    |
| ------------- | ---------------------- | ----------------------------------------- |
| Landing hero  | Generic dark gradient  | Electric Rush gradient with brand mark    |
| Feature cards | Hardcoded blue/green   | CSS var gradients, subtle glow effects    |
| Docs page     | Plain Fumadocs default | Page actions bar, cleaner typography      |
| Code blocks   | Basic                  | Enhanced with copy button, language label |
| Navigation    | Default                | Package icons, section indicators         |
| Mobile        | Works but basic        | Polish responsive behavior                |

### Brand Assets Needed

| Asset            | Size     | Format           | Purpose           |
| ---------------- | -------- | ---------------- | ----------------- |
| Favicon          | 32x32    | `.ico` or `.svg` | Browser tab       |
| Logo             | Flexible | `.svg`           | Navbar, OG images |
| Apple icon       | 180x180  | `.png`           | iOS bookmarks     |
| OG default image | 1200x630 | Generated        | Social sharing    |

### Language Cleanup

Replace promotional language with factual:

| Current                          | Replacement                            |
| -------------------------------- | -------------------------------------- |
| "Blazing Fast"                   | "High Performance" or specific numbers |
| "Lightning-fast performance"     | "35,000+ RPS on Node.js"               |
| "Blazing fast, type-safe" (meta) | "Modular, type-safe Node.js framework" |

---

## 9. Agent & MCP Strategy

### What Ships in v2.0

1. **Agent Skills** — Structured MDX files with frontmatter schema (triggers, packages, difficulty). Browsable UI at `/skills`. JSON index at `/skills/index.json`.

2. **Machine Endpoints** — `/llms.txt`, per-page `.mdx`, `/agent-spec.json`, `/mcp.json` (discovery only).

3. **IDE Integration Buttons** — "Connect to VS Code" and "Connect to Cursor" buttons that:
   - Copy the appropriate skill/context URL
   - Link to extension configuration docs
   - Show setup instructions

### What Ships in v2.1 (MCP Server)

A separate deployable service (`apps/mcp-docs/`) implementing the Model Context Protocol:

```
MCP Server Architecture:
┌─────────────────────────────────────────┐
│  NextRush Docs MCP Server               │
│                                         │
│  Transport: Streamable HTTP             │
│  Runtime: Node.js                       │
│                                         │
│  Tools:                                 │
│  ├── search_docs(query: string)         │
│  │   → Searches docs, returns matches   │
│  ├── get_page(slug: string)             │
│  │   → Returns full page as Markdown    │
│  ├── list_skills()                      │
│  │   → Returns skills index             │
│  ├── get_skill(name: string)            │
│  │   → Returns skill content            │
│  └── get_api_spec(package?: string)     │
│       → Returns agent-spec.json         │
│                                         │
│  Resources:                             │
│  ├── docs://nextrush/llms.txt           │
│  └── docs://nextrush/agent-spec.json    │
│                                         │
│  Data Source: Static docs site (fetch)  │
└─────────────────────────────────────────┘
```

**Stack**: `@modelcontextprotocol/sdk` (TypeScript SDK), deployed as standalone service.

### Agent Skills Format

Each skill file follows this structure:

````markdown
---
title: Add Middleware
skill: add-middleware
version: '3.0.0'
trigger:
  - add middleware
  - create middleware
  - write middleware
package: '@nextrush/core'
difficulty: beginner
prerequisites:
  - '@nextrush/core installed'
  - 'TypeScript project configured'
---

# Add Middleware

## When to Use

Describe the scenario where this skill applies.

## Inputs

- Application instance (`createApp()` result)
- Middleware function signature

## Steps

1. Import `createApp` from `@nextrush/core`
2. Define middleware function with `(ctx, next)` signature
3. Register with `app.use(middleware)`
4. Call `ctx.next()` to pass control

## Code Example

```typescript
import { createApp } from '@nextrush/core';

const app = createApp();

app.use(async (ctx) => {
  console.time('request');
  await ctx.next();
  console.timeEnd('request');
});
```
````

## Constraints

- Middleware must call `ctx.next()` or send a response
- Order matters: middleware runs in registration order
- Async middleware must be awaited

## Expected Output

Middleware executes on every request matching the route.

## Failure Modes

- Forgetting `ctx.next()` → request hangs
- Throwing without error handler → 500 response
- Blocking sync operations → performance degradation

```

---

## 10. Content Standards Enforcement

### Tier-Based Requirements

From `docs-standards.instructions.md` + PRD contract:

**Tier 1 — Core Infrastructure** (core, router, di, decorators, controllers, types, errors):

Required sections (13):
1. The Real Problem
2. Why NextRush Solves It This Way
3. Mental Model
4. Execution Flow
5. Minimal Correct Usage
6. What Happens Automatically
7. Configuration
8. Error and Failure Behavior
9. Performance Notes
10. Security Considerations
11. Common Mistakes
12. When Not To Use
13. Next Steps

Word budget: 1200–2000

**Tier 2 — Middleware and Plugins** (cors, helmet, body-parser, etc.):

Required sections (8):
1. Problem
2. Default Behavior
3. Installation
4. Minimal Usage
5. Configuration Options
6. Integration Example
7. Common Mistakes
8. Troubleshooting

Word budget: 600–1200

**Tier 3 — Utilities and Adapters** (request-id, timer, adapters, dev):

Required sections (5):
1. Purpose
2. Installation
3. Minimal Usage
4. API Reference
5. One Practical Example

Word budget: 300–700

### PRD Contract (Additional)

Every package page additionally must have:
- `## Responsibility`
- `## Public API`
- `## Lifecycle`
- `## Extension Points`
- `## Failure Modes`
- `## Performance Notes`
- `## Security Considerations`
- `## Version Compatibility`

### Enforcement Strategy

1. **Phase 1 (Warnings)**: Validator runs, outputs report, does NOT fail build
2. **Phase 2 (Strict)**: After content is cleaned up, validator fails build on violations
3. **CI Integration**: `pnpm prebuild` runs validator in CI pipeline

### Forbidden Words (Auto-Scanned)

```

simply, just, easy, obviously, straightforward,
powerful, flexible, robust, enterprise-ready,
blazing, blazing fast, lightning

```

---

## 11. Competitor Analysis

### Documentation Engines in the Ecosystem

| Framework | Docs Engine | AI Features | Notes |
|-----------|-------------|-------------|-------|
| **Hono** | VitePress | llms.txt (custom script) | Simple, effective. VitePress + custom build. |
| **LangChain** | Mintlify | Full AI suite | $250/mo Pro. Copy page, AI search. Proprietary. |
| **Elysia** | Custom (Astro-based) | None | Clean UI, no AI features. |
| **Fastify** | Docusaurus | None | Standard docs. |
| **tRPC** | Docusaurus | None | Standard docs. |
| **Drizzle** | Custom | None | Beautiful custom design. |
| **Effect** | Docusaurus | None | Standard docs. |

### Key Takeaways

1. **Hono** has llms.txt via a custom `scripts/` folder — validates our approach
2. **LangChain** is the gold standard for AI features but uses paid proprietary Mintlify
3. **No other Node.js framework** has agent skills, MCP, or structured AI endpoints
4. **NextRush v2 docs will be the first OSS framework with a complete AI-first documentation system**

### What We Take From Each

| From | What | How |
|------|------|-----|
| Mintlify | Page actions bar (Copy, View, AI links) | Fumadocs `LLMCopyButton` + custom components |
| Mintlify | Premium visual polish | CSS variable system, brand assets |
| Hono | llms.txt build script | `scripts/docs/build-docs.ts` |
| Drizzle | Clean custom design identity | "Electric Rush" design system, consistent theming |
| LangChain | AI-first philosophy | Skills, agent-spec.json, MCP discovery |

---

## 12. Success Criteria

### v2.0 Launch Checklist

- [ ] All 6 audit bugs fixed
- [ ] `/llms.txt` returns spec-compliant output
- [ ] Every docs page has per-page `.mdx` endpoint
- [ ] Page actions bar on every page (Copy, View, ChatGPT, Claude)
- [ ] Agent skills directory with ≥5 skills
- [ ] `/skills/index.json` returns valid JSON
- [ ] `/agent-spec.json` returns package metadata
- [ ] `/mcp.json` returns discovery document
- [ ] Build-time validator runs (warnings mode)
- [ ] No marketing language in docs
- [ ] Favicon and logo present
- [ ] CSS variables used consistently (no hardcoded hex)
- [ ] Version labels consistent throughout site
- [ ] `pnpm --filter docs build` succeeds
- [ ] Static export produces all expected files

### Measurable Targets

| Metric | Target |
|--------|--------|
| Audit score | ≥ 9.0/10 |
| Contract compliance | 100% (warnings-only initially) |
| Machine endpoints | 5 (llms.txt, llms-full.txt, mdx, agent-spec, mcp) |
| Skills count | ≥ 10 |
| Build time | < 60s |
| Lighthouse performance | ≥ 95 |

---

## Appendix A: llms.txt Specification Reference

From [llmstxt.org](https://llmstxt.org):

```

# {Project Name}

> {Short description — 1-2 sentences}

{Optional detail paragraphs}

## {Section Name}

- [{Page Title}]({url_to_markdown_version}): {Brief description}
- [{Page Title}]({url_to_markdown_version}): {Brief description}

## Optional

- [{Page Title}]({url}): {Brief description}

````

**Rules**:
- H1 is required (project name)
- Blockquote summary recommended
- H2 sections group related links
- Links should point to `.md` versions
- "Optional" section for secondary content
- File served with `Content-Type: text/markdown`

---

## Appendix B: MCP Protocol Key Concepts

From [modelcontextprotocol.io](https://modelcontextprotocol.io):

MCP servers expose three capability types:
1. **Resources**: File-like data readable by clients
2. **Tools**: Functions callable by LLMs (with user approval)
3. **Prompts**: Pre-written templates for specific tasks

**Transport**: STDIO (local) or Streamable HTTP (remote)
**SDK**: `@modelcontextprotocol/sdk` (TypeScript)
**Config**: Clients configure servers in JSON (e.g., Claude Desktop, Cursor, VS Code)

For NextRush docs MCP server:
- **Resources**: llms.txt, agent-spec.json
- **Tools**: search_docs, get_page, list_skills, get_skill
- **Prompts**: Not needed for docs

---

## Appendix C: Fumadocs Built-in AI Components

### LLMCopyButton

```tsx
import { LLMCopyButton } from 'fumadocs-ui/components/llm-copy-button';

<LLMCopyButton markdownUrl={`${page.url}.mdx`} />
````

Copies the page as Markdown to clipboard. Requires per-page `.mdx` endpoint.

### ViewOptions

```tsx
import { ViewOptions } from 'fumadocs-ui/components/view-options';

<ViewOptions
  markdownUrl={`${page.url}.mdx`}
  githubUrl={`https://github.com/owner/repo/blob/main/path`}
/>;
```

Provides "View Markdown" and "Edit on GitHub" options via dropdown.

### Content Negotiation (Runtime Only)

```typescript
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
```

**Not usable with static export**. Only for server-rendered deployments.

---

## Appendix D: Related Documents

| Document            | Location                                                  | Purpose                       |
| ------------------- | --------------------------------------------------------- | ----------------------------- |
| PRD                 | `/guide.md`                                               | Original product requirements |
| Docs Standards      | `.github/instructions/docs-standards.instructions.md`     | Writing rules, tier system    |
| MDX UI Rules        | `.github/instructions/docs-mdx-ui.instructions.md`        | Component usage, visual rules |
| API Reference Rules | `.github/instructions/docs-api-reference.instructions.md` | API doc format                |
| Architecture        | `.github/instructions/v3-architecture.instructions.md`    | Framework architecture        |
| Global Rules        | `.github/instructions/global-rules.instructions.md`       | Non-negotiable constraints    |
