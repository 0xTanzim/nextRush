# Publishing Guide

NextRush uses **hybrid versioning**:

- **Core packages** → lockstep versioning (released together)
- **Ecosystem packages** (middleware, most plugins, non-default adapters) → independent versioning

## How It Works

```
Fix @nextrush/core        → Core lockstep group bumps (e.g., 3.0.0 → 3.0.1)
Add feature to router     → Core lockstep group bumps (e.g., 3.0.1 → 3.1.0)
Fix @nextrush/cors        → Only @nextrush/cors bumps (e.g., 3.0.0 → 3.0.1)
Breaking change in core   → Core lockstep group major bump (e.g., 3.1.0 → 4.0.0)
```

Users track one **core** version and optional ecosystem package versions.

```bash
npm install nextrush@3.2.0 @nextrush/cors@3.0.4
# Core packages track the `nextrush` version.
# Ecosystem packages version independently and declare compatibility via semver ranges.
```

## CI Release Guard

CI enforces this rule on pull requests to `main`:

- If a PR has release-impacting changes under `packages/` (excluding `packages/dev/` and docs/tests-only changes), the PR **must** include a `.changeset/*.md` file.

This guarantees independent package changes are never merged without release metadata.

## Packages

| Tier                         | Packages                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core (lockstep)**          | `nextrush`, `@nextrush/types`, `@nextrush/errors`, `@nextrush/core`, `@nextrush/router`, `@nextrush/runtime`, `@nextrush/di`, `@nextrush/decorators`, `@nextrush/controllers`, `@nextrush/adapter-node`                 |
| **Adapters (independent)**   | `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/adapter-edge`                                                                                                                                             |
| **Middleware (independent)** | `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/body-parser`, `@nextrush/rate-limit`, `@nextrush/compression`, `@nextrush/cookies`, `@nextrush/csrf`, `@nextrush/multipart`, `@nextrush/request-id`, `@nextrush/timer` |
| **Plugins (independent)**    | `@nextrush/logger`, `@nextrush/static`, `@nextrush/events`, `@nextrush/template`, `@nextrush/websocket`                                                                                                                 |

**Tooling (independent):** `@nextrush/dev`, `create-nextrush`

**Excluded (private / not published):** docs app, playground app, benchmark app.

## Creating a Changeset

After making changes to any package:

```bash
pnpm changeset
```

1. Select the package(s) you changed
2. Choose bump type (patch / minor / major)
3. Write a summary (goes into CHANGELOG)

This creates a `.changeset/*.md` file. Commit it with your PR.

### Bump type guide

| Type    | When                                           |
| ------- | ---------------------------------------------- |
| `patch` | Bug fix, internal refactor, dependency update  |
| `minor` | New feature, new API (backward compatible)     |
| `major` | Breaking change (API removal, behavior change) |

### When NOT to add a changeset

- Documentation-only changes
- Test-only changes
- CI/CD configuration changes
- `@nextrush/dev` changes

## Release Workflow (Automated)

```
1. PR with changeset merges to main
2. GitHub Action creates "Version Packages" PR
   → all package.json versions bumped
   → all CHANGELOG.md files updated
3. Review + merge "Version Packages" PR
4. GitHub Action publishes the packages in the release plan to npm
5. GitHub Release created automatically
```

No manual intervention needed after step 3.

### When the release workflow does NOT run

The release workflow is intentionally guarded by a `paths` filter.
It only triggers on pushes to `main` that touch release-relevant files:

- `.changeset/**`
- `packages/**`
- `pnpm-lock.yaml`
- `package.json`
- `CHANGELOG.md`
- `.github/workflows/release.yml`

If you merge a PR that only changes documentation (for example `PUBLISHING.md`) or other non-release files, the release workflow will not run. This is expected.

### Manually triggering a release run

The workflow also supports manual runs via `workflow_dispatch`.
Use GitHub → Actions → “Release” → “Run workflow” when you want to verify the pipeline without making a release-impacting change.

## First Publish (Bootstrap)

If NextRush has never been published to npm before, you have two valid paths.

### Option A — Publish current versions (no version PR)

Use this when the versions in `packages/*/package.json` are already the versions you want to publish (for example, `3.0.0`).

1. Ensure there are no pending `.changeset/*.md` files meant for version bumps.
2. Merge your code into `main`.
3. The release workflow runs on `main` and executes `pnpm release`.
4. Changesets publishes any package versions that do not exist on npm yet.

This path does not require GitHub Actions to create a PR.

### Option B — Create a version PR, then publish

Use this when you want Changesets to generate changelogs and bump versions automatically.

1. On your feature branch, create a changeset: `pnpm changeset`.
2. Open a PR to `main`. CI enforces the presence of a changeset for release-impacting package changes.
3. Merge to `main`.
4. The release workflow opens the “Version Packages” PR from `changeset-release/main`.
5. Merge the “Version Packages” PR.
6. The release workflow publishes the release plan to npm.

This path requires GitHub Actions permission to create PRs.

### What happens when you change a core package?

- Changeset includes any core package in the fixed group.
- Changesets bumps **all core lockstep packages together**.
- Independent ecosystem packages are only bumped if explicitly included.

### What happens when you change an independent package?

- CI requires a changeset for release-impacting changes.
- Only that package (and any required dependents according to Changesets rules) is versioned and published.
- Core lockstep versions stay unchanged unless core packages are part of the changeset.

## Manual Release (Emergency)

```bash
# Apply version bumps
pnpm run version

# Build all packages
pnpm build

# Publish to npm (requires NPM_TOKEN env var)
pnpm release
```

## Pre-releases

For alpha/beta/RC testing. Always from a dedicated branch, never `main`.

```bash
# Create branch
git checkout -b release/3.1.0-alpha

# Enter pre-release mode
pnpm changeset pre enter alpha

# Add changesets + version + publish
pnpm changeset
pnpm run version        # Creates 3.1.0-alpha.0
pnpm build
pnpm changeset publish  # Publishes to npm with @alpha tag

# Users test: npm install nextrush@alpha

# When ready for stable
pnpm changeset pre exit
pnpm run version        # Creates 3.1.0
pnpm build
pnpm changeset publish  # Publishes to npm @latest
```

## Snapshot Releases (PR Testing)

Publish a specific PR for testing without merging:

```bash
pnpm changeset version --snapshot pr-123
pnpm changeset publish --tag pr-123 --no-git-tag
# Users test: npm install nextrush@pr-123
```

## npm Setup

## GitHub Requirements

### Repository secrets

- `NPM_TOKEN` (required) — npm token with publish access to the `@nextrush/*` scope.

### GitHub Actions settings

For the automated release workflow to open the “Version Packages” PR:

- Settings → Actions → General → Workflow permissions → set to “Read and write permissions”.
- Enable “Allow GitHub Actions to create and approve pull requests”.

### Required secret

Add `NPM_TOKEN` to GitHub repo → Settings → Secrets → Actions.

Create a granular npm token scoped to `@nextrush/*` packages only.

### Package requirements

Every publishable package must have:

```json
{
  "publishConfig": { "access": "public" }
}
```

All publishable packages already have this configured.

## Adding a New Package

1. Create the package under `packages/`
2. Decide whether it is **core (lockstep)** or **ecosystem (independent)**
3. Set version appropriately:

- Core packages: match the current core lockstep version (e.g., `3.2.0`)
- Ecosystem packages: match the current **core major** (e.g., start at `3.0.0`), then version independently

4. Add `publishConfig.access: "public"`
5. Add `repository.directory` field
6. If it's a **core** package, add it to the `fixed` group in `.changeset/config.json`
7. If it's an **ecosystem** package, prefer `workspace:^` for internal `@nextrush/*` deps so published ranges are compatible within a major

## Configuration Reference

Changesets config lives in `.changeset/config.json`:

```json
{
  "fixed": [
    [
      "@nextrush/types",
      "@nextrush/errors",
      "@nextrush/core",
      "@nextrush/router",
      "@nextrush/runtime",
      "@nextrush/di",
      "@nextrush/decorators",
      "@nextrush/controllers",
      "@nextrush/adapter-node",
      "nextrush"
    ]
  ],
  "ignore": ["api"],
  "changelog": ["@changesets/changelog-github", { "repo": "0xTanzim/nextrush" }],
  "privatePackages": { "version": false, "tag": false },
  "snapshot": { "useCalculatedVersion": true, "prereleaseTemplate": "{tag}-{datetime}" }
}
```

| Key               | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `fixed`           | All matching packages share the same version (lockstep)       |
| `ignore`          | Packages excluded from versioning                             |
| `changelog`       | GitHub-linked changelogs with PR links and author attribution |
| `privatePackages` | Skip private packages (docs, playground, benchmark)           |
| `snapshot`        | Use calculated versions for snapshot releases                 |

## Further Reading

- [Hybrid Versioning RFC](report/RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Changesets Fixed Packages](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)
