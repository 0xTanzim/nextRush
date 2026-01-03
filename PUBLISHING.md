# Publishing Guide

This guide explains how NextRush packages are versioned, released, and published to npm.

## Package Architecture

NextRush uses a **tiered versioning strategy** with a facade pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                         nextrush (FACADE)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │  core   │ │ router  │ │ errors  │ │  types  │ │adapter-node│ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │
│                     ALL VERSION 3.x.x (LINKED)                   │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  CLASS-BASED    │  │    ADAPTERS     │  │   MIDDLEWARE    │
│  (LINKED)       │  │  (SEMI-LINKED)  │  │  (INDEPENDENT)  │
│  ┌──────────┐   │  │  ┌───────────┐  │  │  ┌──────────┐   │
│  │    di    │   │  │  │adapter-bun│  │  │  │   cors   │   │
│  ├──────────┤   │  │  ├───────────┤  │  │  ├──────────┤   │
│  │decorators│   │  │  │adapter-deno│ │  │  │  helmet  │   │
│  ├──────────┤   │  │  ├───────────┤  │  │  ├──────────┤   │
│  │controllers│  │  │  │adapter-edge│ │  │  │body-parser│  │
│  └──────────┘   │  │  └───────────┘  │  │  └──────────┘   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Package Tiers

### Tier 1: Core (LINKED Versioning)

These packages always share the same version number.

| Package | Description |
|---------|-------------|
| `nextrush` | Facade meta-package |
| `@nextrush/core` | Application, Context, Middleware |
| `@nextrush/router` | Radix tree routing |
| `@nextrush/errors` | HTTP error classes |
| `@nextrush/types` | Shared TypeScript types |
| `@nextrush/runtime` | Runtime detection |

### Tier 2: Class-Based (LINKED Versioning)

These packages enable the decorator/DI paradigm.

| Package | Description |
|---------|-------------|
| `@nextrush/di` | Dependency injection |
| `@nextrush/decorators` | @Controller, @Get, etc. |
| `@nextrush/controllers` | Controller plugin |

### Tier 3: Adapters (Semi-Linked)

Same major.minor as core, independent patch versions.

| Package | Description |
|---------|-------------|
| `@nextrush/adapter-node` | Node.js HTTP |
| `@nextrush/adapter-bun` | Bun.serve |
| `@nextrush/adapter-deno` | Deno.serve |
| `@nextrush/adapter-edge` | Edge runtimes |

### Tier 4: Middleware (INDEPENDENT)

Version independently from core.

| Package | Description |
|---------|-------------|
| `@nextrush/cors` | CORS headers |
| `@nextrush/helmet` | Security headers |
| `@nextrush/body-parser` | Body parsing |
| `@nextrush/rate-limit` | Rate limiting |
| `@nextrush/cookies` | Cookie handling |
| `@nextrush/compression` | Response compression |

### Tier 5: Plugins (INDEPENDENT)

| Package | Description |
|---------|-------------|
| `@nextrush/logger` | Structured logging |
| `@nextrush/static` | Static file serving |
| `@nextrush/events` | Event system |
| `@nextrush/websocket` | WebSocket support |

## Creating a Changeset

When you make changes to any package:

```bash
# Run the changeset CLI
pnpm changeset
```

You'll be asked:
1. **Which packages have changed?** (Select with space, confirm with enter)
2. **What type of change?** (major/minor/patch)
3. **Summary of changes** (This goes in CHANGELOG)

This creates a file in `.changeset/` like:

```markdown
---
"@nextrush/core": minor
---

Add new `ctx.state` property for sharing data between middleware
```

### Linked Packages Behavior

If you select a linked package (e.g., `@nextrush/core`), ALL linked packages will receive the same version bump when released.

## Release Workflow

### Automated (GitHub Actions)

1. **PR with changeset merges to `main`**
2. GitHub Action collects all changesets
3. Creates "Version Packages" PR with:
   - Updated `package.json` versions
   - Updated `CHANGELOG.md` files
4. When "Version Packages" PR merges:
   - All affected packages publish to npm
   - Git tags created

### Manual (Local)

For testing or emergency releases:

```bash
# 1. Apply version bumps
pnpm version

# 2. Build all packages
pnpm build

# 3. Publish to npm
pnpm release
```

## Version Compatibility

Users can rely on this compatibility matrix:

| nextrush | @nextrush/core | Adapters | Middleware |
|----------|---------------|----------|------------|
| 3.0.x | 3.0.x | 3.0.x | peer: ^3.0.0 |
| 3.1.x | 3.1.x | 3.1.x | peer: ^3.0.0 |
| 3.2.x | 3.2.x | 3.2.x | peer: ^3.0.0 |

**Rule:** All core packages in the same major.minor are guaranteed compatible.

## Pre-release Versions

For alpha/beta releases:

```bash
# Create a pre-release changeset
pnpm changeset pre enter alpha

# Make changes and add changesets
pnpm changeset

# Exit pre-release mode when ready
pnpm changeset pre exit
```

This produces versions like `3.0.0-alpha.1`, `3.0.0-alpha.2`, etc.

## Required npm Setup

### NPM Token

Add `NPM_TOKEN` to GitHub repository secrets:

1. Create npm token: `npm token create`
2. Go to repo Settings → Secrets → Actions
3. Add `NPM_TOKEN` with the token value

### Package Access

All packages must have in `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## Checklist for New Package

When adding a new package:

- [ ] Decide tier (Core/Middleware/Plugin)
- [ ] Set correct version (linked: same as core, independent: start at 0.1.0)
- [ ] Add to `.changeset/config.json` `linked` array if core/class-based
- [ ] Add `publishConfig.access: "public"`
- [ ] Add `repository.directory` field
- [ ] Add `peerDependencies` for `@nextrush/types`
- [ ] Write README with install instructions
- [ ] Add to documentation

## Troubleshooting

### "Package not found on npm"

Ensure `publishConfig.access` is `"public"` for scoped packages.

### "Version mismatch in linked packages"

Run `pnpm changeset version` to synchronize versions.

### "Changeset not detected"

Ensure the changeset file is in `.changeset/` and committed.

## Further Reading

- [Changesets Documentation](https://github.com/changesets/changesets)
- [RFC-0005: Publishing Strategy](../draft/rfc/RFC-0005-PUBLISHING-STRATEGY.md)
