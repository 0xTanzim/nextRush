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

**Excluded (versioned independently):** `@nextrush/dev`, `create-nextrush`

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
  "ignore": ["@nextrush/dev", "api"],
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
