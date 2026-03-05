# RFC: NextRush Versioning & Release Strategy

**Status:** Implemented
**Date:** 2026-03-05
**Author:** NextRush Core Team
**Packages Affected:** All 27 `@nextrush/*` packages + `nextrush` meta-package
**Tools:** Changesets, Turborepo, GitHub Actions, pnpm

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current State Analysis](#2-current-state-analysis)
3. [Industry Research](#3-industry-research)
4. [Decision: Lockstep (Fixed) Versioning](#4-decision-lockstep-fixed-versioning)
5. [Changesets Configuration](#5-changesets-configuration)
6. [Developer Workflow](#6-developer-workflow)
7. [Release Pipeline (GitHub Actions)](#7-release-pipeline-github-actions)
8. [Pre-release Strategy](#8-pre-release-strategy)
9. [Canary & Snapshot Releases](#9-canary--snapshot-releases)
10. [Changelog Strategy](#10-changelog-strategy)
11. [npm Publishing Checklist](#11-npm-publishing-checklist)
12. [Migration Plan](#12-migration-plan)
13. [Edge Cases & FAQ](#13-edge-cases--faq)
14. [Alternatives Considered](#14-alternatives-considered)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Problem Statement

NextRush is a modular monorepo framework with **27 packages** across 5 tiers (core, class-based, adapters, middleware, plugins). Managing versioning and releases at this scale requires clear answers to:

1. **When I fix a bug in `@nextrush/di` today and `@nextrush/body-parser` tomorrow, how are versions handled?**
2. **Do all 27 packages share the same version, or can they differ?**
3. **How does CI/CD automate the release process?**
4. **How do users know which versions are compatible?**
5. **How do pre-releases (alpha/beta/RC) work?**

Without a clear strategy, we face:

- **Compatibility confusion**: "Does `@nextrush/cors@3.1.0` work with `@nextrush/core@3.3.0`?"
- **Release overhead**: Manual version coordination across 27 packages
- **Broken installs**: Mismatched internal dependency versions
- **Adoption friction**: Users must consult a compatibility matrix instead of a single version number

---

## 2. Current State Analysis

### What exists today

| Aspect          | Status                                     |
| --------------- | ------------------------------------------ |
| Versioning tool | Changesets (`@changesets/cli@^2.29.8`)     |
| Current version | All 27 packages at `3.0.0`                 |
| Strategy        | `linked` groups (NOT `fixed`)              |
| CI/CD           | GitHub Actions: `ci.yml` + `release.yml`   |
| npm access      | `"access": "public"`                       |
| Pre-release     | Documented in PUBLISHING.md, not automated |

### Current `.changeset/config.json`

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [
    [
      "@nextrush/types",
      "@nextrush/errors",
      "@nextrush/core",
      "@nextrush/router",
      "@nextrush/runtime",
      "nextrush",
      "@nextrush/adapter-node"
    ],
    ["@nextrush/di", "@nextrush/decorators", "@nextrush/controllers"]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@nextrush/dev", "nextrush-monorepo"]
}
```

### Problems with current `linked` approach

| Problem                                                                                                                                                                | Impact                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **`linked` ≠ `fixed`**: Linked packages share the same _bump type_, not the same _version number_. Over time, packages within a group can drift to different versions. | Version confusion     |
| **Middleware/plugins completely independent**: `@nextrush/cors` could be at `3.1.0` while `@nextrush/helmet` is at `3.7.0`. Users must guess compatibility.            | Adoption friction     |
| **Missing packages**: Adapters (bun, deno, edge), plugins (events, logger, static, template, websocket) are not in any group.                                          | Inconsistent behavior |
| **No compatibility guarantee**: "Which middleware version works with my core version?" has no answer.                                                                  | Support burden        |

### Key behavioral difference: `linked` vs `fixed`

| Feature                          | `linked`                                      | `fixed`                                    |
| -------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Same bump type across group      | Yes                                           | Yes                                        |
| Same version number across group | **No** — only bumped packages get the version | **Yes** — ALL packages in group get bumped |
| Unused packages bumped           | No                                            | Yes                                        |
| Version drift possible           | Yes                                           | No                                         |
| User compatibility guarantee     | Weak                                          | Strong                                     |

---

## 3. Industry Research

### How comparable frameworks handle versioning

| Framework     | Packages         | Strategy            | Tool                                   |
| ------------- | ---------------- | ------------------- | -------------------------------------- |
| **Angular**   | 25+ `@angular/*` | Lockstep (fixed)    | Custom tooling                         |
| **NestJS**    | 20+ `@nestjs/*`  | Lockstep (fixed)    | Lerna                                  |
| **Babel**     | 140+ `@babel/*`  | Lockstep (fixed)    | Lerna (since Babel 7)                  |
| **tRPC**      | 10+ `@trpc/*`    | Lockstep (fixed)    | Changesets with `fixed: [["@trpc/*"]]` |
| **Turborepo** | 5+               | Lockstep            | Changesets                             |
| **Fastify**   | 60+ `@fastify/*` | Independent plugins | Semantic release                       |
| **Hono**      | 1                | Single package      | N/A                                    |

### Key insight from industry

> **Frameworks where packages are designed to work together universally use lockstep versioning.** The cognitive load of "which version of X works with version Y?" is the #1 adoption friction for frameworks with independent versioning.

Babel explicitly switched from independent to lockstep in Babel 7, stating: _"It was confusing for both users and maintainers when the versions were all different."_

### When independent versioning works

Independent versioning works for **utility collections** (lodash, date-fns) where each package is standalone. It does **NOT** work for frameworks with:

- Shared type contracts (`@nextrush/types`)
- Internal dependency chains (types → errors → core → ...)
- Coordinated runtime behavior (middleware + context + router)
- User expectation of "one framework, one version"

NextRush is a **framework**, not a utility collection. Lockstep is the correct choice.

---

## 4. Decision: Lockstep (Fixed) Versioning

### DECISION — Versioning Strategy

**Options**: [A] Lockstep all packages | [B] Current linked groups | [C] Fixed core + independent peripherals
**Chosen**: [A] Lockstep all packages — because NextRush is a framework, not a library collection. Users should never think about version compatibility.
**Trade-offs**: More npm publishes per release (27 packages even when only 2 changed). Acceptable cost — publishing is automated and takes seconds.
**Risks**: Contributors may feel a "wasted publish" on unchanged packages. Mitigated by clear documentation that this is intentional.

### What lockstep means in practice

```
Fix a typo in @nextrush/helmet:
  → ALL 27 packages bump from 3.1.0 → 3.1.1
  → ALL 27 packages published to npm
  → Users: "npm install nextrush@3.1.1" — everything compatible, guaranteed.

Add a feature to @nextrush/router:
  → ALL 27 packages bump from 3.1.1 → 3.2.0
  → ALL changelogs updated (router shows the feature, others show "No changes")
  → Users: "npm install nextrush@3.2.0" — everything compatible, guaranteed.
```

### User experience comparison

**Before (linked/independent):**

```bash
# User has to figure out compatibility
npm install nextrush@3.2.0 @nextrush/cors@3.1.0 @nextrush/adapter-node@3.0.0
# "Wait, is cors 3.1.0 compatible with core 3.2.0?" 😰
```

**After (lockstep):**

```bash
# All versions match. Always. No questions.
npm install nextrush@3.2.0 @nextrush/cors@3.2.0 @nextrush/adapter-node@3.2.0
# "I'm on NextRush 3.2.0" — full stop. 😌
```

### Benefits

1. **Zero compatibility questions** — all packages at same version are guaranteed compatible
2. **Simple bug reports** — "I'm on NextRush 3.2.0" tells everything
3. **Simple documentation** — "For v3.2, do X" covers all packages
4. **Simple upgrades** — "Upgrade everything to 3.3.0" with no matrix
5. **Simple CI testing** — one version to validate, not a combinatorial explosion
6. **Simple install guides** — all `@nextrush/*` packages share one version number
7. **Marketing clarity** — "NextRush 3.2 introduces..." is a single story

---

## 5. Changesets Configuration

### New `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "0xTanzim/nextrush" }],
  "commit": false,
  "fixed": [["@nextrush/*", "nextrush"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@nextrush/dev", "nextrush-monorepo"],
  "privatePackages": {
    "version": false,
    "tag": false
  }
}
```

### What changed and why

| Setting           | Before                        | After                                     | Why                                               |
| ----------------- | ----------------------------- | ----------------------------------------- | ------------------------------------------------- |
| `fixed`           | `[]`                          | `[["@nextrush/*", "nextrush"]]`           | All packages in lockstep                          |
| `linked`          | Two groups                    | `[]`                                      | Not needed with `fixed`                           |
| `changelog`       | `"@changesets/cli/changelog"` | `["@changesets/changelog-github", {...}]` | Better GitHub integration (links to PRs, authors) |
| `privatePackages` | (absent)                      | `{ "version": false, "tag": false }`      | Skip private packages (apps)                      |

### How `@nextrush/*` glob works

The glob `@nextrush/*` matches against **package names** (from `package.json`), not file paths. It uses [micromatch](https://www.npmjs.com/package/micromatch) syntax.

Matches:

- `@nextrush/types` ✅
- `@nextrush/core` ✅
- `@nextrush/cors` ✅
- `@nextrush/adapter-node` ✅
- `@nextrush/controllers` ✅
- Any future `@nextrush/*` package ✅ (auto-included!)

Does NOT match:

- `nextrush` ❌ (no scope — added explicitly)
- `@nextrush/dev` ❌ (in `ignore` list — takes precedence)
- `nextrush-monorepo` ❌ (in `ignore` list)

### Required new dependency

```bash
pnpm add -Dw @changesets/changelog-github
```

This package generates changelogs with links to GitHub PRs, commit SHAs, and author attribution. Much better than the default `@changesets/cli/changelog`.

---

## 6. Developer Workflow

### Scenario: Fix a bug in `@nextrush/di`

```bash
# 1. Create branch
git checkout -b fix/di-container-leak

# 2. Fix the code
# ... edit packages/di/src/container.ts ...

# 3. Add a changeset (intent to release)
pnpm changeset

# CLI prompts:
# > Which packages have changes? → @nextrush/di (select with space)
# > What type of change? → patch
# > Summary? → Fixed container memory leak on scope disposal

# 4. This creates a file .changeset/purple-dogs-fly.md:
```

```markdown
---
'@nextrush/di': patch
---

Fixed container memory leak on scope disposal
```

```bash
# 5. Commit and push
git add .
git commit -m "fix(di): container memory leak on scope disposal"
git push origin fix/di-container-leak

# 6. Open PR → changeset bot confirms changeset exists → CI runs → merge
```

### Scenario: Next day, fix a bug in `@nextrush/body-parser`

```bash
# Same process - creates another changeset
pnpm changeset
# → @nextrush/body-parser, patch, "Fixed JSON depth limit validation"
# Creates .changeset/clever-cats-swim.md
```

### Scenario: Both PRs merge to `main`

What happens automatically:

1. **GitHub Action detects pending changesets** (two `.changeset/*.md` files)
2. **Creates/updates a "Version Packages" PR** containing:
   - Both changeset files consumed
   - ALL 27 `package.json` files bumped (e.g., `3.0.0` → `3.0.1`)
   - `CHANGELOG.md` entries for `@nextrush/di` and `@nextrush/body-parser`
   - Other packages' changelogs show the version bump but no specific changes
3. **Maintainer reviews** the "Version Packages" PR
4. **Merges it**
5. **GitHub Action publishes** all 27 packages to npm
6. **GitHub Release created** with aggregated changelog

### Scenario: Add a feature to `@nextrush/router`

```bash
pnpm changeset
# → @nextrush/router, minor, "Added wildcard route matching"
```

When released: ALL packages bump to `3.1.0` (minor bump is highest). The router changelog shows the feature, other changelogs show "Version bump only."

### Key principle: highest bump type wins

If multiple changesets exist:

- `@nextrush/di`: patch
- `@nextrush/body-parser`: patch
- `@nextrush/router`: minor

→ ALL packages get a **minor** bump (highest type wins in lockstep).

### When NOT to add a changeset

- Documentation-only changes
- Test-only changes
- CI/CD configuration changes
- Development tooling changes (`@nextrush/dev`)
- Internal refactors with no public API change

Changesets are for **user-facing changes** that should appear in changelogs and trigger a release.

---

## 7. Release Pipeline (GitHub Actions)

### Workflow: `release.yml` (Enhanced)

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write # Required for npm provenance

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for changeset detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build All Packages
        run: pnpm build

      - name: Run Tests
        run: pnpm test

      - name: Run Type Check
        run: pnpm typecheck

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version
          title: 'chore(release): version packages'
          commit: 'chore(release): version packages'
          createGithubReleases: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Release Notification
        if: steps.changesets.outputs.published == 'true'
        run: |
          echo "🚀 Packages published!"
          echo '${{ steps.changesets.outputs.publishedPackages }}' | jq '.'
```

### How the action works (two modes)

```
Push to main → Changesets Action runs:

MODE 1 — Pending changesets detected:
  → Creates/updates PR titled "chore(release): version packages"
  → PR contains version bumps + changelogs
  → NO publishing occurs

MODE 2 — "Version Packages" PR just merged (no pending changesets):
  → Runs: pnpm build → pnpm test → pnpm typecheck
  → Runs: pnpm release (turbo build + changeset publish)
  → Publishes to npm
  → Creates GitHub Release (createGithubReleases: true)
```

### Root `package.json` scripts (unchanged, already correct)

```json
{
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "release": "turbo run build && changeset publish"
  }
}
```

### Workflow: `ci.yml` (Add changeset check)

Add this step to the existing CI workflow to remind PR authors to add changesets:

```yaml
- name: Check for changeset
  if: github.event_name == 'pull_request'
  run: |
    # Non-blocking check — just informational
    if ls .changeset/*.md 1>/dev/null 2>&1; then
      echo "✅ Changeset found"
    else
      echo "⚠️ No changeset found. If this PR includes user-facing changes, run: pnpm changeset"
    fi
```

> **Note:** Do NOT make this a blocking check. Not every PR needs a changeset (docs, tests, internal tooling).

### Optional: Install the Changeset Bot

Install the [Changeset Bot](https://github.com/apps/changeset-bot) on the GitHub repository. It automatically comments on PRs with a reminder to add a changeset. Non-blocking — just a helpful nudge.

### npm Provenance (Supply Chain Security)

npm provenance cryptographically proves that a package was built from a specific commit in a specific repository. This is an industry best practice.

To enable, update the `release` script:

```json
{
  "release": "turbo run build && changeset publish --provenance"
}
```

Requirements:

- `id-token: write` permission in workflow (already present)
- Publishing from GitHub Actions (already the case)
- npm token with appropriate permissions

---

## 8. Pre-release Strategy

### When to use pre-releases

| Channel | Use case                            | Tag     | Example         |
| ------- | ----------------------------------- | ------- | --------------- |
| `alpha` | Early development, API unstable     | `alpha` | `3.1.0-alpha.0` |
| `beta`  | Feature complete, testing needed    | `beta`  | `3.1.0-beta.0`  |
| `rc`    | Release candidate, final validation | `rc`    | `3.1.0-rc.0`    |

### Pre-release workflow

**Important:** Pre-releases should be done from a **dedicated branch**, not `main`. This prevents blocking normal releases.

```bash
# 1. Create pre-release branch
git checkout -b release/3.1.0-alpha

# 2. Enter pre-release mode
pnpm changeset pre enter alpha

# 3. Add changesets for new features (or use existing ones)
pnpm changeset

# 4. Version packages (creates 3.1.0-alpha.0)
pnpm changeset version

# 5. Build and publish
pnpm build
pnpm changeset publish

# 6. Commit and push
git add .
git commit -m "chore(release): 3.1.0-alpha.0"
git push origin release/3.1.0-alpha

# --- Users can now test ---
# npm install nextrush@alpha

# 7. For subsequent alphas, repeat steps 3-6
# Creates 3.1.0-alpha.1, 3.1.0-alpha.2, etc.

# 8. When ready for beta
pnpm changeset pre exit
pnpm changeset pre enter beta
# ...repeat cycle...

# 9. When ready for stable release
pnpm changeset pre exit
pnpm changeset version  # Creates 3.1.0 (stable)
pnpm build
pnpm changeset publish  # Publishes to `latest` tag
```

### Automating pre-releases with GitHub Actions (optional)

```yaml
name: Pre-release

on:
  push:
    branches:
      - 'release/**'

jobs:
  prerelease:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm changeset publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Pre-release rules

1. **Never pre-release from `main`** — it blocks normal releases
2. **All pre-release packages use the same tag** — lockstep applies to pre-releases too
3. **Pre-release versions don't satisfy semver ranges** — `^3.0.0` does NOT match `3.1.0-alpha.0`
4. **Exit pre-release mode before merging back to `main`**

---

## 9. Canary & Snapshot Releases

### Snapshot releases (for PR testing)

Snapshot releases let users test a specific PR before it merges.

```bash
# From the PR branch:
pnpm changeset version --snapshot pr-123
# Creates versions like: 0.0.0-pr-123-20260305120000

pnpm changeset publish --tag pr-123 --no-git-tag
# Publishes with tag "pr-123" (NOT "latest")
```

User installs the snapshot:

```bash
npm install nextrush@pr-123
```

### Automated snapshot releases (optional GitHub Action)

```yaml
name: Snapshot Release

on:
  issue_comment:
    types: [created]

jobs:
  snapshot:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '/snapshot')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: refs/pull/${{ github.event.issue.number }}/head
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Publish Snapshot
        run: |
          pnpm changeset version --snapshot pr-${{ github.event.issue.number }}
          pnpm changeset publish --tag pr-${{ github.event.issue.number }} --no-git-tag
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `📦 Snapshot published! Install with:\n\`\`\`\nnpm install nextrush@pr-${{ github.event.issue.number }}\n\`\`\``
            });
```

**Usage:** Comment `/snapshot` on a PR → packages published with tag `pr-123` → bot replies with install command.

### When to use each release type

```
Feature in development:
  → Regular changesets + "Version Packages" PR (default flow)

Need users to test a specific PR:
  → Snapshot release (comment /snapshot on PR)

Preparing a major release:
  → Pre-release from dedicated branch (alpha → beta → rc → stable)

Emergency hotfix:
  → Direct changeset + merge to main → immediate publish
```

---

## 10. Changelog Strategy

### Problem with lockstep changelogs

With lockstep, when `@nextrush/router` gets a feature, ALL 27 packages are bumped. If every package's changelog says "Version 3.2.0", but only `@nextrush/router` has actual changes, the changelogs are noisy and unhelpful.

### Solution: GitHub-integrated changelog + aggregate CHANGELOG

#### Per-package CHANGELOG.md (auto-generated by changesets)

Only packages with actual changes get meaningful changelog entries:

```markdown
# @nextrush/router

## 3.2.0

### Minor Changes

- Added wildcard route matching ([#142](https://github.com/0xTanzim/nextrush/pull/142)) — by @contributor

## 3.1.1

### Patch Changes

- Updated dependencies
```

The `@changesets/changelog-github` package generates entries with:

- Links to the PR that introduced the change
- Author attribution
- Commit SHA reference

Packages without changes get a simple "Updated dependencies" entry.

#### Root CHANGELOG.md (manually curated, optional)

For major releases, write a human-curated aggregate changelog:

```markdown
# NextRush Changelog

## 3.2.0 (2026-03-15)

### Features

- **Router**: Added wildcard route matching (#142)

### Bug Fixes

- **DI**: Fixed container memory leak on scope disposal (#139)
- **Body Parser**: Fixed JSON depth limit validation (#140)

### Internal

- Updated dev dependencies
```

This is the "marketing" changelog. It tells the story of the release.

#### GitHub Releases (auto-generated)

The `createGithubReleases: true` flag in the changesets action auto-creates GitHub Releases with aggregated changelogs. These are the primary public-facing release notes.

---

## 11. npm Publishing Checklist

### Every `@nextrush/*` package must have

```json
{
  "name": "@nextrush/<package-name>",
  "version": "3.0.0",
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/0xTanzim/nextrush.git",
    "directory": "packages/<path>"
  },
  "license": "MIT",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md", "CHANGELOG.md"]
}
```

### npm token setup

1. Create a **granular access token** on npm (not classic token)
   - Scope: Read and write
   - Packages: `@nextrush/*` only
   - IP allowlist: GitHub Actions IP ranges (optional, extra security)
2. Add as `NPM_TOKEN` in GitHub repo Settings → Secrets → Actions

### Provenance

Adding `--provenance` to `changeset publish` generates Sigstore-based provenance statements. This proves:

- The package was built by GitHub Actions (not a compromised developer machine)
- From which commit and repository
- Users can verify with `npm audit signatures`

Enable by updating the release script:

```json
{
  "release": "turbo run build && changeset publish --provenance"
}
```

### `.npmrc` (create in repo root)

```ini
# Ensure provenance works with pnpm
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

> **Note:** The `NPM_TOKEN` is set as an environment variable in GitHub Actions, not hardcoded.

---

## 12. Migration Plan

### From current `linked` to `fixed` — step by step

This is a **non-breaking** change. No user action required.

#### Step 1: Install changelog plugin

```bash
pnpm add -Dw @changesets/changelog-github
```

#### Step 2: Update `.changeset/config.json`

```diff
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
- "changelog": "@changesets/cli/changelog",
+ "changelog": [
+   "@changesets/changelog-github",
+   { "repo": "0xTanzim/nextrush" }
+ ],
  "commit": false,
- "fixed": [],
+ "fixed": [
+   ["@nextrush/*", "nextrush"]
+ ],
- "linked": [
-   ["@nextrush/types", "@nextrush/errors", "@nextrush/core", "@nextrush/router",
-    "@nextrush/runtime", "nextrush", "@nextrush/adapter-node"],
-   ["@nextrush/di", "@nextrush/decorators", "@nextrush/controllers"]
- ],
+ "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@nextrush/dev",
    "nextrush-monorepo"
- ]
+ ],
+ "privatePackages": {
+   "version": false,
+   "tag": false
+ }
}
```

#### Step 3: Update release script for provenance

```diff
// package.json
{
  "scripts": {
-   "release": "turbo run build && changeset publish"
+   "release": "turbo run build && changeset publish --provenance"
  }
}
```

#### Step 4: Update `release.yml`

Add `createGithubReleases: true` to the changesets action and update `pnpm/action-setup` to v4.

#### Step 5: Verify all packages are at the same version

```bash
# All should show 3.0.0
pnpm -r exec -- node -p "require('./package.json').name + '@' + require('./package.json').version" | sort
```

#### Step 6: Test the workflow

```bash
# Create a test changeset
pnpm changeset
# Select any package, choose patch, write "test changeset"

# Dry-run the version command
pnpm changeset version
# Verify ALL packages bumped to 3.0.1

# Revert (do not commit)
git checkout -- .
```

#### Step 7: Update `PUBLISHING.md`

Replace the tiered versioning documentation with the lockstep strategy.

---

## 13. Edge Cases & FAQ

### Q: What if someone adds a NEW package `@nextrush/websocket`?

The glob `@nextrush/*` **auto-includes** new packages. No config change needed. The new package will automatically be part of the lockstep group as long as its name starts with `@nextrush/`.

### Q: Does `ignore` override `fixed`?

**Yes.** `@nextrush/dev` is in the `ignore` list, so even though `@nextrush/*` matches it, changesets will skip it entirely. The `ignore` list takes precedence.

### Q: What about the `nextrush` meta-package (no scope)?

It's added explicitly in the fixed group: `["@nextrush/*", "nextrush"]`. It will always version in lockstep with everything else.

### Q: What if I fix something in DI today and body-parser tomorrow?

1. Today: Fix DI → `pnpm changeset` → creates `.changeset/fix-di.md` (patch)
2. Tomorrow: Fix body-parser → `pnpm changeset` → creates `.changeset/fix-bp.md` (patch)
3. Both PRs merge to `main`
4. GitHub Action creates one "Version Packages" PR containing both fixes
5. ALL 27 packages bump from `3.0.0` → `3.0.1`
6. Merge the PR → ALL packages published

Both fixes are batched into one release. Changesets accumulate until consumed.

### Q: Can I force an immediate release after one fix?

Yes. Merge the PR, then immediately merge the auto-generated "Version Packages" PR. The action publishes as soon as the version PR merges.

### Q: What if two changesets have different bump types?

The **highest** bump type wins across all pending changesets:

- changeset A: `@nextrush/di` patch
- changeset B: `@nextrush/router` minor

→ ALL packages get a **minor** bump.

### Q: Do unchanged packages get "empty" changelogs?

With `@changesets/changelog-github`, unchanged packages get a minimal entry:

```
## 3.2.0
### Patch Changes
- Updated dependencies
```

This is standard and expected. Users understand this pattern from Angular, Babel, etc.

### Q: What about private packages (playground, docs, benchmark)?

Private packages (`"private": true` in `package.json`) are handled by the `privatePackages` setting:

```json
"privatePackages": { "version": false, "tag": false }
```

They are never versioned or published.

### Q: Can I still do emergency hotfixes?

Yes. Same workflow, just faster:

1. Fix the bug on a branch
2. `pnpm changeset` (patch)
3. Merge to `main`
4. Immediately merge the "Version Packages" PR
5. Published within minutes

### Q: What about breaking changes?

If ANY changeset specifies `major`:

- ALL packages bump major (e.g., `3.2.0` → `4.0.0`)
- This is intentional — a major version means "something breaking changed in the framework"
- Document the breaking change and migration path in the changeset description

### Q: Won't 27 npm publishes be slow?

No. `changeset publish` runs `npm publish` for each package sequentially, but each publish takes 1-3 seconds. Total: ~30-60 seconds for all 27 packages. Fully automated in CI.

### Q: How do we handle deprecating a package?

1. Add `"deprecated": "Use @nextrush/new-package instead"` to the package.json
2. Add a changeset with the deprecation notice
3. After publishing, run `npm deprecate @nextrush/old-package "Use @nextrush/new-package instead"`

---

## 14. Alternatives Considered

### Alternative A: Keep current linked groups

**Rejected.** Linked groups allow version drift. Over 5 releases, core could be at `3.5.0` while middleware is at `3.1.0`. Users face compatibility confusion. This is the exact problem Angular and Babel solved by switching to lockstep.

### Alternative B: Fixed core + independent peripherals (hybrid)

```json
{
  "fixed": [
    [
      "@nextrush/types",
      "@nextrush/errors",
      "@nextrush/core",
      "@nextrush/router",
      "@nextrush/di",
      "@nextrush/decorators",
      "@nextrush/controllers",
      "@nextrush/runtime",
      "nextrush",
      "@nextrush/adapter-node"
    ]
  ]
}
```

Middleware and plugins version independently.

**Rejected.** While this reduces publishing noise, it reintroduces compatibility questions:

- "Does `@nextrush/cors@2.1.0` work with `@nextrush/core@3.5.0`?"
- Users must track TWO version tracks
- Documentation must specify compatibility for each middleware version

The complexity savings (publishing fewer packages) is not worth the DX cost.

### Alternative C: Single mega-package (like Hono)

Ship everything as one `nextrush` package.

**Rejected.** Destroys tree-shaking, forces users to install everything, prevents modular adoption. The monorepo architecture is a feature, not a problem.

### Alternative D: Semantic release (instead of Changesets)

Use `semantic-release` with conventional commits.

**Rejected.** Semantic release derives versions from commit messages, which:

- Requires strict commit message discipline from ALL contributors
- Makes it hard to batch changes (one commit = one version bump)
- Doesn't support the "accumulate changesets, release in batch" workflow
- Less control over release timing

Changesets separates "describing changes" from "releasing changes", which is the correct model for a framework.

---

## 15. Implementation Checklist

### Immediate (do now)

- [ ] Install `@changesets/changelog-github`: `pnpm add -Dw @changesets/changelog-github`
- [ ] Update `.changeset/config.json` (see Section 5)
- [ ] Update `release` script to add `--provenance` (see Section 12, Step 3)
- [ ] Update `release.yml` with `createGithubReleases: true` (see Section 7)
- [ ] Update `pnpm/action-setup` from v2 to v4 in `release.yml`
- [ ] Verify all 27 packages have `publishConfig.access: "public"`
- [ ] Verify all packages are at `3.0.0`
- [ ] Test the changeset workflow dry-run locally
- [ ] Update `PUBLISHING.md` to reflect lockstep strategy
- [ ] Consume or delete the pending `stable-v3-release.md` changeset

### Short-term (this week)

- [ ] Install [Changeset Bot](https://github.com/apps/changeset-bot) on the repository
- [ ] Create `.npmrc` with registry auth config
- [ ] Set up `NPM_TOKEN` in GitHub Secrets (granular token, `@nextrush/*` scope only)
- [ ] Do a test release to npm (consider `3.0.1` with a docs fix)
- [ ] Verify GitHub Release is auto-created with changelog

### Optional enhancements (future)

- [ ] Add snapshot release workflow (Section 9)
- [ ] Add pre-release automation for `release/**` branches (Section 8)
- [ ] Add aggregate root CHANGELOG.md curation process
- [ ] Add changeset check step to CI (non-blocking, informational)
- [ ] Consider custom changelog template for cleaner per-package changelogs

---

## Summary

| Decision                | Choice                                                          |
| ----------------------- | --------------------------------------------------------------- |
| **Versioning strategy** | Lockstep (fixed) — all `@nextrush/*` packages share ONE version |
| **Tool**                | Changesets with `fixed: [["@nextrush/*", "nextrush"]]`          |
| **Changelog format**    | `@changesets/changelog-github` (links to PRs, authors)          |
| **Release trigger**     | Push to `main` → auto-PR → merge PR → auto-publish              |
| **Pre-release**         | From dedicated `release/**` branches, enter alpha/beta/rc mode  |
| **Snapshots**           | Optional, triggered by `/snapshot` comment on PRs               |
| **npm provenance**      | Enabled via `--provenance` flag                                 |
| **GitHub Releases**     | Auto-created by `changesets/action`                             |
| **`@nextrush/dev`**     | Excluded from lockstep (in `ignore` list)                       |

### The golden rule

> **"I'm on NextRush 3.2.0"** should tell you everything about which versions of every package are installed, guaranteed compatible, and documented. No compatibility matrix. No guessing. One version. One framework.

---

## References

- [Changesets documentation](https://github.com/changesets/changesets)
- [Changesets fixed packages](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)
- [Changesets linked packages](https://github.com/changesets/changesets/blob/main/docs/linked-packages.md)
- [Changesets pre-releases](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- [Changesets snapshot releases](https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md)
- [Changesets GitHub Action](https://github.com/changesets/action)
- [Turborepo: Publishing packages](https://turborepo.dev/repo/docs/guides/publishing-packages)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
- [Angular versioning](https://angular.dev/reference/releases)
- [Babel lockstep rationale](https://babeljs.io/blog/2018/08/27/7.0.0)
