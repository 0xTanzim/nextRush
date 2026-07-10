# Wiki Log

## [2026-07-10] init | Project wiki initialized
- Created `nextrush-wiki/` (NOT `wiki/` — that folder is reserved for GitHub Wiki publish sync via `scripts/publish-github-wiki.sh`, which hard-codes `${ROOT}/wiki` as its source; renaming it per the standard backward-compat rule would break that script, so this project deviates from the rename convention intentionally).
- Ingested root `README.md` as the primary source.
- Ingested key `.kiro/steering/*.instructions.md` files (v3-architecture, global-rules, tdd-workflow, docs-standards, typescript) as supporting source material for topic pages.
- Created topic pages: architecture, context-api, middleware-and-extensions, di-and-class-based, performance, engineering-standards, tdd-workflow, documentation-standards.
- Created entity pages: nextrush-monorepo, tanzim-hossain.
- Registered in `~/.llm-wiki/index.md` and added symlink under `~/.llm-wiki/projects/`.
