# Publishing Guide

NextRush uses **lockstep versioning** — all `@nextrush/*` packages share the same version number, always.

## How It Works

```
Fix @nextrush/di        → ALL 26 packages bump (e.g., 3.0.0 → 3.0.1)
Add feature to router   → ALL 26 packages bump (e.g., 3.0.1 → 3.1.0)
Breaking change in core → ALL 26 packages bump (e.g., 3.1.0 → 4.0.0)
```

Users install one version. No compatibility matrix. No guessing.

```bash
npm install nextrush@3.2.0 @nextrush/cors@3.2.0 @nextrush/adapter-node@3.2.0
# All guaranteed compatible.
```

## Packages (26 in lockstep)

| Tier            | Packages                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Core**        | `nextrush`, `@nextrush/types`, `@nextrush/errors`, `@nextrush/core`, `@nextrush/router`, `@nextrush/runtime`                                                                   |
| **Class-based** | `@nextrush/di`, `@nextrush/decorators`, `@nextrush/controllers`                                                                                                                |
| **Adapters**    | `@nextrush/adapter-node`, `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/adapter-edge`                                                                          |
| **Middleware**  | `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/body-parser`, `@nextrush/rate-limit`, `@nextrush/compression`, `@nextrush/cookies`, `@nextrush/request-id`, `@nextrush/timer` |
| **Plugins**     | `@nextrush/logger`, `@nextrush/static`, `@nextrush/events`, `@nextrush/template`, `@nextrush/websocket`                                                                        |

**Excluded:** `@nextrush/dev` (dev tool, versioned independently), docs app (private, not published).

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
4. GitHub Action publishes ALL packages to npm
5. GitHub Release created automatically
```

No manual intervention needed after step 3.

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

All 26 packages already have this configured.

## Adding a New Package

1. Create the package under `packages/`
2. Set version to match current lockstep version (e.g., `3.2.0`)
3. Add `publishConfig.access: "public"`
4. Add `repository.directory` field
5. It auto-joins lockstep via the `@nextrush/*` glob — no config change needed
6. To exclude from lockstep, add to `ignore` in `.changeset/config.json`

## Configuration Reference

Changesets config lives in `.changeset/config.json`:

```json
{
  "fixed": [["@nextrush/*", "nextrush"]],
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

- [Versioning & Release RFC](report/RFC-VERSIONING-AND-RELEASE-STRATEGY.md)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Changesets Fixed Packages](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)
