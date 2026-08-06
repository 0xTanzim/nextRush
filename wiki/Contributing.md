# Contributing

NextRush is built to a simple standard: **easier to adopt, less to configure, less code to write, clearer to read, better supported.** Every contribution moves the framework in that direction — or it does not land.

The full engineering constitution is `AGENTS.md` at the repo root; the durable decisions live in `docs/RFC/` and `docs/adr/`. Read them before touching code. This page is the practical workflow.

## Development setup

The repo is a pnpm monorepo (Turborepo orchestrated). Requires Node ≥ 22 and pnpm (via Corepack):

```bash
corepack enable
pnpm install
pnpm verify   # lint + typecheck + test + coverage + ESM-only validation
```

Layout:

- `packages/` — every published package (core, router, adapters, class, di, stream, …). See [Packages](Packages).
- `apps/website/` — the documentation site (MDX, served at https://0xtanzim.github.io/nextRush/docs).
- `openspec/` — spec-driven development: `openspec/specs/` is the source of truth for what the framework does; `openspec/changes/archive/` records why.
- `docs/` — RFCs and ADRs; durable architecture decisions live here, not only in PR descriptions.

## How to contribute

1. **Open an issue or discussion first** for anything non-trivial — a new package, a public API change, a breaking change. Those are RFC-gated (see `docs/RFC/TEMPLATE.md`): propose the RFC, get it reviewed, then implement. Small bug fixes can go straight to a PR.
2. **Branch or worktree.** One branch per objective. Use `git worktree` for parallel work.
3. **Follow TDD.** Write the failing test first (RED), see it fail for the right reason, implement the smallest change that passes (GREEN), then refactor. See the `tdd-workflow` in project steering.
4. **Obey the structure rules.** No file over its size ceiling, no business logic in UI components, no flat folders, no commented-out code. The framework's internal code must be easier to maintain than application code.
5. **Runtime independence.** Core imports no runtime API (`node:*`, `process`, `Buffer`, `Deno`, `Bun`). Platform-specific code lives behind an adapter, and behavior is decided by negotiated capabilities, never by `if (runtime === ...)`. Runtime-touching changes must run the adapter conformance suite.
6. **Documentation ships with the feature.** A feature is incomplete until documented: README + ARCHITECTURE from the templates (`docs/templates/`), docs-site pages from the `engineering-documentation` skill, and the examples updated.
7. **Commit small and atomic** (Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `perf:`, `chore:`). One logical change per commit; keep the tree clean.

## Verifying a change

```bash
pnpm verify              # full gate: lint, typecheck, test, coverage, ESM-only, bins
pnpm test                # unit + integration
pnpm run conformance     # cross-runtime parity (packages/adapters/conformance)
```

CI enforces the same gates. If your change touches a public export or package contract, expect reviewers to check consumers (Contract-Checker) and, for security-relevant surface (auth, crypto, untrusted input), a security review.

## Release workflow

- Releases are versioned with Changesets. Open a changeset with your PR if it affects a published package.
- One semver line across all packages; breaking changes batch into major releases with migration notes (see [Changelog](Changelog)).
- Stable releases publish to npm as `latest`; prereleases ride a beta tag. The `release: vX.Y.Z` commits are the source of truth for what shipped.

## Code of conduct

Be specific, be kind, and hold the bar: every line of code must earn its place. When in doubt about a design decision, ask the question the framework asks — does this make applications *easier to build and maintain*?

## Links

- Repository: https://github.com/0xTanzim/nextRush
- Issues: https://github.com/0xTanzim/nextRush/issues
- Documentation site: https://0xtanzim.github.io/nextRush/docs
- OpenSpec governance: `openspec/README.md` in the repo
