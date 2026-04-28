# Changelog

Summary of notable releases. Authoritative detail lives in the repo root **`CHANGELOG.md`** and npm release notes.

Versioning: [Semantic Versioning](https://semver.org/). Monorepo packages share one version line; releases use [Changesets](https://github.com/changesets/changesets).

| Segment | Meaning |
|---------|---------|
| Major | Breaking API changes |
| Minor | Compatible features |
| Patch | Fixes and safe internals |
| Pre-release tags | Historical alphas/betas (`npm` stable line is **`3.0.x`**) |

---

## 3.0.4

Stable patch **3.0.4**: **`@nextrush/di`** clears resolution state on **`reset()`**; tests use sequential file runs to avoid global container races. Detail in repo root **`CHANGELOG.md`**.

---

## 3.0.3

Patch release: **`3.0.3`** across `@nextrush/*`. **`nextrush`** exposes the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** avoids false decorator `tsconfig` warnings on functional scaffolds. See repo root **`CHANGELOG.md`**.

---

## 3.0.2

Stable patch release: **`3.0.2`** across `@nextrush/*`; **`create-nextrush`** ships **`bin/create-nextrush.js`** so package-manager `create` / `npx` / `dlx` resolve the CLI; docs describe semver-stable v3.

---

## 3.0.0-alpha.2

Superseded by the stable **3.0.x** line; kept here for migration archaeology.

### Added (high level)

**Middleware:** `@nextrush/csrf`, `helmet`, `cookies`, `compression`, `multipart`, `rate-limit`, `request-id`, `timer`, `body-parser`, `cors`.

**Plugins:** `@nextrush/events`, `logger`, `static`, `template`, `websocket`, `controllers`.

**Decorators & DI:** Full controller/route/param decorator surface; `@nextrush/di` with tsyringe integration.

**Adapters:** Bun, Deno, Edge alongside Node.

**Tooling:** `@nextrush/runtime`, `create-nextrush`, `@nextrush/dev` (dev server, build, generators).

**Core:** Cookie accumulation fixes on Bun/Deno/Edge; `trustProxy` on Bun `serve`; tree-shaking metadata.

### Fixed

Decorator package dependency wiring for consumers; cookie/header accumulation on non-Node adapters; strict-mode sweep.

---

## 3.0.0-alpha.1

Initial v3 foundation: `@nextrush/core` application + middleware composition + plugins; `@nextrush/router` trie routing; `@nextrush/types`; `@nextrush/errors` hierarchy and middleware helpers.

---

## Upgrade notes

**alpha.1 → alpha.2:** Additive packages only; Set-Cookie handling fix on Bun/Deno/Edge when multiple cookies were set.

For migrations from older majors, see the docs site [Migration guide](https://0xtanzim.github.io/nextRush/docs/guides/migration).
