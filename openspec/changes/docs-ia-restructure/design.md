## Context

NextRush website (`apps/website/`) uses Fumadocs MDX (`source.config.ts`) with content at `content/docs/`. The current IA is:

```
start/ concepts/ guides/ recipes/ production/ performance/ reference/
migrate/ architecture/ help/ community/
```

This grew organically without a governing IA model. Three rounds of external feedback (fed.md, w.md, a.md) identified gaps: no Examples section, `performance/` is a sibling instead of under `production/`, `help/` has unclear purpose, guides are flat with no domain grouping, and no page templates exist for consistent authoring.

A PAGE_TEMPLATES.md has been drafted in `apps/website/DESIGN/` capturing the full template spec (metadata cards, decision trees, callout taxonomy, learning paths, governance). This design doc explains how to implement it.

## Goals / Non-Goals

**Goals:**
- Restructure `content/docs/` to 10-section IA: Getting Started, Concepts, Guides, Recipes, Examples, Production, Architecture, Reference, Migration, Community
- Create `examples/` section with 3-5 starter project templates
- Group guides by domain sub-categories and recipes by technology sub-categories
- Implement page templates as MDX component patterns (not runtime code — content structure + component usage)
- Add lifecycle management, search keywords, learning paths
- Implement standardized callout taxonomy across all pages

**Non-Goals:**
- No framework package changes — this is website-only
- No runtime behavior changes — content and presentation only
- No full content rewrite — existing pages are moved/renamed, not rewritten from scratch
- No versioned docs system (e.g. NextRush 3 vs 4) — that's a future concern
- No search engine implementation — search keywords in frontmatter for the existing search to index

## Decisions

### 1. Rename `start/` → `getting-started/`
**Why**: Matches developer expectation and the feedback IA proposal. The URL becomes `/docs/getting-started/` which is more discoverable than `/docs/start/`.

### 2. Keep `migrate/` as-is (rename to `migration/`)
**Why**: Singular vs plural is a naming convention decision. Feedback uses "Migration." However, renaming breaks existing URLs. Decision: keep `migrate/` as-is for now, only change display name in sidebar meta.json.

### 3. Merge `performance/` into `production/`
**Why**: Performance benchmarks and tuning are operational concerns. Having them as a separate top-level section dilutes the IA. Move:
- `performance/comparison.mdx` → `architecture/benchmarks.mdx` (framework design decisions)
- `performance/tuning.mdx` → `production/performance-tuning.mdx`
- Delete `performance/index.mdx` and `performance/meta.json`

### 4. Dissolve `help/` into relevant sections
**Why**: FAQ, glossary, troubleshooting, compatibility matrix each serve different developer needs. Scattering them to their natural homes is better than a catch-all section.
- `help/faq.mdx` → FAQs go into relevant guides/concepts as callouts
- `help/glossary.mdx` → terms go inline in Concepts pages with `🧠` callouts
- `help/troubleshooting.mdx` → distributed to Recipes (each recipe gets its own troubleshooting table)
- `help/compatibility-matrix.mdx` → moved to Reference or Getting Started

### 5. Guide sub-categories as directories, not tags
**Why**: Directories with `meta.json` files give clear hierarchy in the sidebar (Fumadocs supports nested groups). Tags/metadata-only grouping would require runtime filtering.
- `guides/api-development/`, `guides/authentication/`, `guides/data/`, etc.
- Each gets its own `meta.json` declaring group title + page order + learning path

### 6. Recipe sub-categories by technology
**Why**: A developer looking for "PostgreSQL recipe" thinks in terms of tools, not framework features.
- `recipes/database/`, `recipes/authentication/`, `recipes/storage/`, etc.
- Each recipe is a single MDX file in its technology sub-directory

### 7. Examples as a standalone section, not a guides sub-group
**Why**: Examples are complete projects with different layout requirements (architecture diagram, quick start, deploy). They need their own template distinct from guides.
- `examples/hello-world/`, `examples/rest-api/`, `examples/todo-app/`, etc.
- Each example is a directory with its own MDX page + optional external repo link

### 8. Page templates as authoring conventions, not runtime components (Wave 1)
**Why**: For Wave 1 (Flight 1), enforce page structure via AGENTS.md + DESIGN/PAGE_TEMPLATES.md + frontmatter validation. Wave 2 can build custom MDX components.
- No new JSX components required for Wave 1
- Frontmatter fields enforce metadata structure
- AGENTS.md + PAGE_TEMPLATES.md govern authoring
- Existing Fumadocs components handle rendering

### 9. Metadata card as frontmatter-driven
**Why**: Managed in MDX frontmatter, rendered via existing Fumadocs page header customization. No new component needed for Wave 1.

### 10. Standardized callout taxonomy: start with markdown blockquotes
**Why**: Fumadocs supports custom remark plugins. For Wave 1, use consistent blockquote patterns (`> 💡 Tip`). Wave 2 can build a `Callout` MDX component that renders visually distinct callouts.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| URL-breaking changes from directory moves | Add redirects in `next.config.mjs` for all renamed paths. Document old→new mapping. |
| Existing deep-links to `help/`, `performance/` break | 301 redirects. SEO impact is minimal — low-traffic pages. |
| Content scattered from `help/` dissolution loses discoverability | Each piece lands in a more contextually relevant home. Cross-links compensate. |
| Guide sub-categories make sidebar deeper | Fumadocs supports collapsible groups. Default is expanded for common groups. |
| Authors resist template strictness | PAGE_TEMPLATES.md uses Required/Recommended/Conditional — not everything is mandatory. AGENTS.md explains *why* consistency matters. |
| Examples section requires maintenance (repos get stale) | Examples are versioned with the framework. CI checks example projects build. |

## Migration Plan

1. **Phase 1 — Structure**: Move/rename directories, create redirects, update meta.json files
2. **Phase 2 — Content relocation**: Move pages from `help/`, `performance/` to new homes
3. **Phase 3 — Guide re-grouping**: Create sub-category directories, move guide pages
4. **Phase 4 — Recipe re-grouping**: Create technology sub-categories, move recipe pages
5. **Phase 5 — Examples section**: Create section structure, write 3 starter examples
6. **Phase 6 — Templates & governance**: Finalize PAGE_TEMPLATES.md, update AGENTS.md, add frontmatter validation
7. **Phase 7 — Learning paths**: Add `meta.json` learningPath arrays for domain sections
8. **Phase 8 — Polish**: Standardize callouts, add keywords, verify cross-links, test a11y + mobile

Each phase is independently shippable. No phase blocks the next — they can overlap.

## Open Questions

- Should Examples live as MDX pages in `content/docs/examples/` or as separate repos linked from the site? Decision leaning: MDX pages for architecture/features/structure, external repo for full source.
- Wave 1 vs Wave 2 split: which template features need custom MDX components vs can use markdown conventions? Decision: Wave 1 uses markdown conventions (blockquote callouts, ASCII trees). Wave 2 builds custom components.
