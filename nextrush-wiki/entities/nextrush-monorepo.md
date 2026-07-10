---
title: NextRush Monorepo
type: entity
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [monorepo, structure]
---
# NextRush Monorepo

pnpm workspaces + Turborepo. Root at `/home/tanzim/project/framework/nextrush`.

## Package Hierarchy (immutable, enforced — see [[topics/engineering-standards]])
```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```
Lower packages never import from higher packages. No circular deps. Cross-package imports via published interfaces only.

## Directory Map
- `packages/` — all publishable packages
  - Core infra: `types`, `errors`, `core`, `router`, `runtime`, `di`, `decorators`, `controllers`, `class`
  - `packages/adapters/{node,bun,deno,edge,conformance}` — platform adapters + cross-adapter conformance suite
  - `packages/middleware/{cors,helmet,body-parser,multipart,csrf,rate-limit,compression,cookies,validation,request-id,timer,static,template,logger,stream,openapi}` — 16 install-separately middleware packages
  - `packages/extensions/{events,websocket}` — long-lived stateful services (rare, ~0.1% of capability — most is middleware)
  - `packages/{dev,create-nextrush,testing}` — dev server/CLI/generators, project scaffolder, test harness
  - `packages/nextrush` — meta package re-exporting essentials
- `apps/{docs,benchmark,playground}` — documentation site, benchmark suite, testing playground
- `docs/` — architecture docs, RFCs, migration guides
- `wiki/` — **GitHub Wiki publish source**, synced via `scripts/publish-github-wiki.sh` to `<repo>.wiki.git`. NOT the LLM-wiki knowledge base (that's this `nextrush-wiki/` folder) — kept deliberately separate to avoid breaking the publish script's hard-coded `${ROOT}/wiki` path.

## Size Targets (LOC ceilings)
| Package | Max LOC |
|---|---|
| types | 500 |
| errors | 600 |
| core | 1,500 |
| router | 1,000 |
| di | 400 |
| decorators | 800 |
| controllers | 800 |
| adapter-* | 500 |
| middleware/* | 300 |

## Tooling
- Package manager: pnpm
- Build/task orchestration: Turborepo (`turbo.json`)
- Test runner: Vitest, 90%+ line coverage target per package
- Lint: ESLint (`eslint.config.mjs`), Prettier
- Versioning: Changesets (`.changeset/`)
