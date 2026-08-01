# Publishing Guide

Quick reference for NextRush's package tiers, current Changesets config, and the GitHub setup a
release depends on. For the actual step-by-step release procedure — what to run, in what order,
and every real mistake we've already hit and fixed — read the
[Release Handbook](apps/website/content/docs/architecture/release-handbook.mdx) instead. This file is
the table you keep open in a second tab; that one is what you follow.

## Versioning model

NextRush uses hybrid versioning: nine core packages move together as one unit, everything else
versions on its own schedule.

```
Fix @nextrush/core        → whole core group bumps together (e.g., 3.0.0 → 3.0.1)
Add feature to router     → whole core group bumps together (e.g., 3.0.1 → 3.1.0)
Fix @nextrush/cors        → only @nextrush/cors bumps (e.g., 3.0.0 → 3.0.1)
Breaking change in core   → whole core group major bump (e.g., 3.1.0 → 4.0.0)
```

```bash
npm install nextrush@3.2.0 @nextrush/cors@3.0.4
# Core packages track the `nextrush` version.
# Everything else versions independently and declares compatibility via semver ranges.
```

## Package tiers

| Tier | Packages |
| --- | --- |
| **Core (fixed group — always the same version)** | `nextrush`, `@nextrush/types`, `@nextrush/errors`, `@nextrush/core`, `@nextrush/router`, `@nextrush/runtime`, `@nextrush/di`, `@nextrush/adapter-node` |
| **Adapters (independent)** | `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/adapter-edge`, `@nextrush/adapter-serverless` |
| **Middleware (independent)** | `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/body-parser`, `@nextrush/rate-limit`, `@nextrush/compression`, `@nextrush/cookies`, `@nextrush/csrf`, `@nextrush/form-data`, `@nextrush/request-id`, `@nextrush/timer`, `@nextrush/validation`, `@nextrush/openapi` |
| **Extensions/registrars (independent)** | `@nextrush/logger`, `@nextrush/static`, `@nextrush/events`, `@nextrush/template`, `@nextrush/websocket`, `@nextrush/health` |
| **Streaming (independent)** | `@nextrush/stream` — depends only on `@nextrush/types`; consumed by `@nextrush/adapter-node` as a regular dependency, but core does not depend on it. "Ships with `adapter-node`" (README) describes install-time bundling for end users, not a version-lockstep coupling. It never belongs in the `fixed` group — verified against the real import graph, not the README's prose, after that exact question came up during the 2026-07-24 release prep. |
| **Class runtime / DI tooling (independent)** | `@nextrush/class`, `@nextrush/testing` |
| **Tooling (independent)** | `@nextrush/dev`, `create-nextrush` |
| **Private / never published** | docs app, playground app, benchmark app, `@nextrush/adapter-conformance` |

A package's tier decides two things: whether it sits in `.changeset/config.json`'s `fixed` array,
and whether its version is a computed fact (real npm history exists) or a hand-set first release
(it's never been published — see the Release Handbook's Phase 1 for why this distinction matters
more than it looks like it should).

## Current `.changeset/config.json`

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "0xTanzim/nextrush" }],
  "commit": false,
  "fixed": [
    [
      "@nextrush/types",
      "@nextrush/errors",
      "@nextrush/core",
      "@nextrush/router",
      "@nextrush/runtime",
      "@nextrush/di",
      "@nextrush/adapter-node",
      "nextrush"
    ]
  ],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "api",
    "@nextrush/stream", "@nextrush/class", "@nextrush/csrf", "@nextrush/form-data",
    "@nextrush/rate-limit", "@nextrush/cookies", "@nextrush/validation", "@nextrush/logger",
    "@nextrush/static", "@nextrush/template", "@nextrush/openapi", "@nextrush/request-id",
    "@nextrush/timer", "@nextrush/health", "@nextrush/events", "@nextrush/websocket",
    "@nextrush/dev", "create-nextrush", "@nextrush/adapter-bun", "@nextrush/adapter-deno",
    "@nextrush/adapter-edge", "@nextrush/adapter-serverless", "@nextrush/testing"
  ],
  "privatePackages": { "version": false, "tag": false },
  "snapshot": { "useCalculatedVersion": true, "prereleaseTemplate": "{tag}-{datetime}" }
}
```

| Key | Purpose |
| --- | --- |
| `fixed` | Packages inside one array always share the same version, whether or not each one individually changed |
| `ignore` | Version-bumped and changelogged, but never actually published while listed — a **temporary** hold. This currently holds every never-published package for the duration of the 4.0.0 beta window, so none of them accidentally leak onto npm's `latest` tag before the real stable release (see the Release Handbook, Phase 3, for exactly why that risk is real and unconditional). Remove a package from here only once it's ready for its real first publish. Use `"private": true` in a package's own `package.json` instead if you want to block it permanently, not temporarily |
| `changelog` | GitHub-linked changelogs — PR links and author attribution, needs a `GITHUB_TOKEN` locally to run outside CI |
| `privatePackages` | Skip private packages (docs, playground, benchmark) entirely |
| `snapshot` | Version format for one-off PR/snapshot test releases |

The baseline guard (`pnpm validate:changeset-baselines`, see below) reads this file's `ignore`
list and every pending changeset together — it's what caught the exact mistake that put twelve
of those twenty-three packages here in the first place.

## The baseline guard

```bash
pnpm validate:changeset-baselines
```

Checks every pending changeset's declared bump type against the real npm registry, and fails if
a `patch`/`minor`/`major` is declared against a package with zero publish history. It's wired
into `pnpm run version` automatically, so it runs on every release whether you remember to call
it directly or not. Full story on why this exists: Release Handbook, Phase 2.

## Creating a changeset

```bash
pnpm changeset
```

Select the package(s) you touched, choose a bump type, write the summary. That produces a
`.changeset/*.md` file — commit it with your PR.

| Bump type | When |
| --- | --- |
| `patch` | Bug fix, internal refactor, dependency update |
| `minor` | New feature, new backward-compatible API |
| `major` | Breaking change — API removal, behavior change, a dependency moved to `peerDependencies` |

Skip a changeset for documentation-only changes, test-only changes, CI/CD config changes, or
`@nextrush/dev` changes.

## CI release guard (PRs to `main`)

`ci.yml` blocks a PR that touches `packages/**` (excluding tests and docs) without an
accompanying `.changeset/*.md` file. This guarantees a release-impacting change never merges
without release metadata — but it only checks that a changeset *exists*, not that its declared
bump type makes sense. Run the baseline guard above yourself before you rely on CI to catch a bad
bump type; `ci.yml` doesn't call it independently yet.

## GitHub Actions — what runs, and what it needs

| Workflow | Triggers on | What it does |
| --- | --- | --- |
| `ci.yml` | push/PR to `main` | `pnpm verify` (build, test, typecheck, lint) + changeset-presence guard + scaffolder install matrix + cross-platform dev-CLI smoke test |
| `release.yml` | push to `main` (paths: `.changeset/**`, `packages/**`, lockfile, root `package.json`) | Opens/updates the "Version Packages" PR via `changesets/action`; on merge, publishes to npm |
| `docs-pages.yml` | push to `main` (paths: `apps/website/**`) | Builds and deploys the docs site to GitHub Pages |
| `runtime-conformance.yml` | push/PR to `main` | Real Bun/Deno/workerd conformance tests, plus a bundle-size budget check |
| `performance-gate.yml` | PR touching perf-sensitive paths | Benchmark smoke test against a committed baseline (inactive-but-wired until a baseline is committed) |
| `deploy-verification.yml` | nightly cron + manual | Real cloud deploys (Lambda, Cloudflare, Vercel, GCF) — skips cleanly if secrets are missing |

**`release.yml` only triggers on `main`.** It has no trigger for a dedicated beta branch — that's
why beta releases run from the CLI, not through this workflow. See the Release Handbook's Part 2
for the full reasoning, not only this fact.

### Required repository configuration

- **Secrets**: `NPM_TOKEN` (publish access to `@nextrush/*`), `TURBO_TOKEN` + `TURBO_TEAM`
  (remote build cache).
- **Settings → Actions → General → Workflow permissions**: "Read and write permissions," plus
  "Allow GitHub Actions to create and approve pull requests" — required for `changesets/action`
  to open the Version Packages PR.
- **Every publishable package's `package.json`** needs `"publishConfig": { "access": "public" }`.

## Adding a new package

1. Create it under `packages/`.
2. Decide its tier (see the table above) — core fixed group, or independent.
3. Set its version. If it's genuinely new (never published anywhere), start at `1.0.0` — not the
   current core major, and not anything inflated. A first release inheriting a version number it
   never earned is exactly the mistake this repo already made once; see the Release Handbook's
   edge-case table.
4. Add `publishConfig.access: "public"` and a `repository.directory` field.
5. If it belongs in the core group, add it to `.changeset/config.json`'s `fixed` array —
   only after checking the real dependency graph, not the package's own description of itself.
6. For internal `@nextrush/*` dependencies, prefer `workspace:^` so published ranges stay
   compatible within a major.

## Manual / emergency release

```bash
pnpm run version   # runs the baseline guard, then changeset version
pnpm build
pnpm changeset publish --provenance   # requires NPM_TOKEN in the environment
```

This is what `release.yml` runs under the hood (`"release": "turbo run build && changeset publish
--provenance"` in the root `package.json`). Running it by hand works the same way, and it's
idempotent — safe to re-run if it fails partway through, since `changeset publish` only pushes a
version that isn't already on the registry.

## Snapshot releases (one-off PR testing, no version bump)

```bash
pnpm changeset version --snapshot pr-123
pnpm changeset publish --tag pr-123 --no-git-tag
# testers: npm install nextrush@pr-123
```

## Further reading

- [Release Handbook](apps/website/content/docs/architecture/release-handbook.mdx) — the full lifecycle,
  the CLI-vs-CI decision, mermaid diagrams for the release-time flow, and every real edge case
  found running this process for the first time. Read this before running any release.
- [Hybrid Versioning RFC](report/RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md)
- [Changesets documentation](https://github.com/changesets/changesets)
- [Changesets: fixed packages](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)
- [Changesets: prereleases](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
