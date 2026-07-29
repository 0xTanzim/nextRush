## Why

NextRush website documentation serves as the primary learning surface for developers adopting the framework. The current IA has several gaps: an `examples/` section is missing entirely, `performance/` sits as a top-level sibling instead of living under `production/`, `help/` has unclear purpose, guides are a flat list with no domain grouping, and there are no page templates to ensure consistent reading experiences across guides, recipes, and examples. Without a structured IA and page templates, content scales unpredictably — duplicate topics appear, developers can't find what they need, and authoring becomes inconsistent.

This change introduces a clear information architecture, distinct page templates for each content type, and a content governance model so the documentation can scale to hundreds of pages without losing coherence.

## What Changes

- Restructure `content/docs/` IA to 10-section model: Getting Started, Concepts, Guides, Recipes, Examples, Production, Architecture, Reference, Migration, Community
- Create `examples/` section with starter project templates (Hello World, REST API, Todo App, Chat, SaaS Starter)
- Merge `performance/` into `production/`
- Dissolve `help/` — FAQ into relevant guides, glossary into concepts, troubleshooting into guides/recipes
- Group guides by domain sub-categories (API Development, Authentication, Data, Communication, Testing, Security, Background Jobs)
- Organize recipes by technology sub-categories (Database, Auth, Storage, Email, Queue, Payments, Deployment, Monitoring, AI)
- Create and enforce page templates for Guides, Recipes, and Examples with distinct layouts
- Add content governance: page type decision matrix, section classification (Required/Recommended/Conditional), page lifecycle (draft→review→stable→deprecated→archived)
- Add learning paths for domain sections (curated content sequences)
- Implement standardized callout taxonomy, metadata cards, inline cross-linking, and accessibility rules
- Add search keywords/aliases to all page frontmatter

## Capabilities

### New Capabilities
- `docs-site`: Website documentation information architecture, page templates, content governance, learning paths, cross-linking, and search — the full documentation system that presents framework capabilities to developers.

### Modified Capabilities
- None. This change does not modify framework behavior — only the documentation presentation layer.

## Impact

- **apps/website/content/docs/**: Full directory restructure — sections renamed, merged, created, and dissolved
- **apps/website/DESIGN/**: New PAGE_TEMPLATES.md already drafted; will be finalized and referenced from AGENTS.md
- **apps/website/AGENTS.md**: Updated with governance references
- **apps/website/src/**: New MDX components for metadata cards, callouts, learning paths, etc.
- **apps/website/**: New examples repos or example content structure
- No framework packages touched. No public API changes. No breaking changes.
