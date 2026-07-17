# RFC: NextRush Hybrid Versioning & Release Strategy

**Status:** Implemented
**Date:** 2026-04-09
**Author:** NextRush Core Team
**Tools:** Changesets, Turborepo, pnpm, GitHub Actions

---

## 1. Problem Statement

NextRush is a modular monorepo with many publishable packages (core runtime, middleware, plugins, adapters).

A single versioning strategy doesn’t fit everything:

- **Full lockstep** across the whole ecosystem creates release churn (tiny change → ecosystem-wide bump/publish).
- **Fully independent** versioning creates compatibility ambiguity (which plugin works with which core?).

We need a strategy that keeps the framework contract stable while letting optional packages iterate quickly.

---

## 2. Decision

NextRush adopts a **hybrid versioning model**:

- **Core packages** are **lockstep** (Changesets `fixed` group)
- **Ecosystem packages** are **independent** (standard Changesets behavior)

This preserves a clear “core version” while avoiding unnecessary releases for unrelated middleware/plugins/adapters.

---

## 3. Package Classification

### 3.1 Core (Lockstep)

These packages define the core compatibility contract and are released together:

- `nextrush`
- `@nextrush/types`
- `@nextrush/errors`
- `@nextrush/core`
- `@nextrush/router`
- `@nextrush/runtime`
- `@nextrush/di`
- `@nextrush/decorators`
- `@nextrush/controllers`
- `@nextrush/adapter-node`

### 3.2 Ecosystem (Independent)

These packages are optional/auxiliary and can release independently:

- **Adapters**: `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/adapter-edge`
- **Middleware**: `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/body-parser`, `@nextrush/rate-limit`, `@nextrush/compression`, `@nextrush/cookies`, `@nextrush/csrf`, `@nextrush/multipart`, `@nextrush/request-id`, `@nextrush/timer`
- **Plugins**: `@nextrush/logger`, `@nextrush/static`, `@nextrush/events`, `@nextrush/template`, `@nextrush/websocket`

### 3.3 Tooling (Independent)

- `@nextrush/dev`
- `create-nextrush`

---

## 4. Dependency Rules (Critical)

### 4.1 Core rules

- Core packages may depend on other core packages.
- Core packages must **not** depend on ecosystem packages.

### 4.2 Ecosystem rules

- Ecosystem packages may depend on core packages.
- Prefer **semver ranges** for core dependencies (see Section 5) so ecosystem packages don’t need a release for every core patch/minor.

---

## 5. Publishing-Compatible Workspace Ranges

pnpm transforms `workspace:` protocol dependencies during publish/pack:

- `workspace:*` → exact version (e.g., `3.0.0`)
- `workspace:^` → caret range (e.g., `^3.0.0`)

Policy:

- Core lockstep packages may use `workspace:*` for internal core dependencies.
- Ecosystem packages should use `workspace:^` for internal `@nextrush/*` deps so published packages remain compatible within a major.

---

## 6. Changesets Configuration

Hybrid versioning is implemented via Changesets `fixed` grouping:

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
  "ignore": ["@nextrush/dev", "api"]
}
```

---

## 7. Developer Workflow

### 7.1 Core change

- Add a changeset selecting any core package.
- Result: the entire core lockstep group versions together.

### 7.2 Ecosystem change

- Add a changeset selecting the changed ecosystem package(s).
- Result: only selected packages version and publish.

### 7.3 Mixed change (core + ecosystem)

- Add a changeset selecting both.
- Result: core lockstep group bumps + selected ecosystem package(s) bump.

---

## 8. Release Pipeline

The release pipeline remains Changesets-driven:

- Pull request CI enforces a changeset for release-impacting `packages/` changes
- Changeset PR merged to `main`
- GitHub Action opens “version packages” PR
- Merging that PR triggers publish of packages in the release plan

### 8.1 Core change outcome

- If any package from the core fixed group is included, the full fixed group bumps together.
- This preserves a single coherent core version.

### 8.2 Independent change outcome

- If only ecosystem packages are included, only those packages (plus any dependents required by Changesets) are bumped.
- Core versions remain unchanged.

---

## 9. Migration Notes

This strategy supersedes the earlier “full lockstep across all `@nextrush/*`” policy.

Implementation steps:

- Narrowed Changesets `fixed` group to core only
- Updated ecosystem packages to publish caret ranges for core deps (`workspace:^`)

---

## 10. Trade-offs

- **Pros**: fewer releases for unrelated packages; faster plugin/middleware iteration
- **Cons**: users must understand that ecosystem packages have their own versions

Core packages remain the stable reference point: “I’m on NextRush core `X.Y.Z`.”
