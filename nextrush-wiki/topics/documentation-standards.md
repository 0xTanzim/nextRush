---
title: Documentation Standards
type: topic
created: 2026-07-10
sources: []
tags: [docs, mdx, tiering]
---
# Documentation Standards

Source: `.kiro/steering/docs-standards.instructions.md`, `docs-mdx-ui.instructions.md`, `docs-api-reference.instructions.md`.

## Philosophy
Docs are a core feature — unclear docs mean the framework is broken. Start with the problem developers feel, not the API. Progressive disclosure: quick understanding → basic usage → deeper explanation → advanced/reference.

## Tiering System
- **Tier 1** (core, runtime, router, di, decorators, controllers, types, errors): 13 required sections (Real Problem → Next Steps), 1200-2000 words. Architectural depth required.
- **Tier 2** (cors, helmet, body-parser, rate-limit, compression, cookies, logger, static, template, events, websocket): 8 sections, 600-1200 words. No philosophical essays.
- **Tier 3** (request-id, timer, adapter-*, dev): 5 sections, 300-700 words. Lean.

## Content Ownership Map
`/concepts/` = why. `/packages/` = how. `/api/` = what (lookup only). `/guides/` = tasks. `/examples/` = runnable scenarios. Never re-explain a concept inside a package page — link instead.

## MDX Components
Available: Callout (max 3/page), Tabs (max 4 tabs), Steps (max 7 steps), PackageInstall, TypeTable, Feature/FeatureGrid (index pages only), Mermaid (max 2 diagrams/page, <10 nodes), Accordion/`<details>` (max 3/page). Rule: if plain Markdown conveys the same clarity, don't reach for MDX.

## Quality Scoring (single system, no duplicates)
| Dimension | Min Score |
|---|---|
| Code Accuracy | 9 |
| Structure | 8 |
| Clarity | 8 |
| Example Quality | 8 |
| Duplication | 9 |
| Completeness | 8 |

Max 3 revision cycles if any dimension falls below minimum.

## Forbidden Words/Patterns
simply/just/easy/obviously/straightforward, powerful/flexible/robust/enterprise-ready, "This module provides...", "Note:" openers, passive voice in instructions.

## Related
- [[topics/engineering-standards]] — doc-update-in-same-PR rule.
