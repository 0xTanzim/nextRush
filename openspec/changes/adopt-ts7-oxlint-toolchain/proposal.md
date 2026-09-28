# Proposal

## Why

`typescript-eslint@8.70.1` (latest, published 2026-09-21) declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, so this repository **cannot** move to TypeScript 7 while its lint gate is ESLint: `pnpm install` fails resolution, and forcing it crashes the parser at `@typescript-eslint/typescript-estree` with `TypeError: Cannot read properties of undefined (reading 'Cjs')`. TypeScript 7.0.2 has been npm `latest` since 2026-07-08 (a native Go compiler, 8–12× faster type-checking), and `eslint/eslint#21070` — the ESLint core upgrade to TypeScript 7 — is openly *blocked on typescript-eslint* with no published ETA.

That block is now avoidable: Oxlint's type-aware linting (`oxlint-tsgolint` v7, built on TypeScript 7.0.2) went stable on 2026-07-22, covering 59 of 61 `typescript-eslint` type-aware rules at 12–18× the speed. The framework stays on the last TypeScript 6 line (`~6.0.3`) only because its linter forces it — a cost paid on every `pnpm verify`.

## What Changes

- Add `oxlint` **1.83.0** + `oxlint-tsgolint` **7.0.2002** to `catalog:tooling` — the quarantine-clean pair (design D3); `1.85.0` / `7.0.2003` are unreachable today under the 7-day release-age gate and are bumped to behind it. A root `oxlint.config.ts` replaces `eslint.config.mjs`.
- Convert the 21 per-package `lint` / `lint:fix` scripts (`eslint src …` → `oxlint src --type-aware`). Command names, the turbo task graph, and the `pnpm verify` contract stay identical.
- Port the repo rule `nextrush/no-runtime-identity-capability` to an Oxlint JS Plugin; its fixtures and `capability-exempt` semantics stay unchanged, and existing `eslint-disable` directives keep working.
- Remove `typescript-eslint`, `@typescript-eslint/*`, `eslint-config-prettier`, and `@eslint/js` from the lint path.
- Bump `catalog:tooling.typescript` from `~6.0.3` to **`^7.0.2`** and validate `tsconfig.base.json` (including its `ignoreDeprecations: "6.0"`) under TS 7.
- **Generated projects** (`create-nextrush`): the production preset emits an Oxlint config **and declares the packages that config imports** — today it writes an `eslint.config.mjs` importing `@eslint/js` and `typescript-eslint`, neither of which is ever added to the generated `package.json`, so the emitted lint gate cannot run. The generated `typescript` range follows the TS 7 line, and the VS Code recommendation points at the Oxlint extension.
- **`@nextrush/dev`**: `nextrush build --dts` keeps emitting declarations when the resolved local TypeScript is 7.x — TS 7.0.2 ships native per-platform binaries through `optionalDependencies` (`@typescript/typescript-<platform>`), is ESM-only (`type: "module"`, no `main`), and no longer exposes a `tsserver` bin.

Ordering is deliberate: the lint engine swap lands **before** the compiler bump, so each phase's behaviour deltas are attributable to exactly one change instead of an entangled jump.

## Capabilities

### New Capabilities

_None._ Every requirement lands on an existing capability. The repo-internal lint-engine swap changes no framework-observable behaviour, so it is engineering infrastructure rather than a capability: it is recorded in `docs/RFC/repo-tooling/037-typescript-7-oxlint-migration.md` and validated by this change's tasks and gate checks. Introducing a `repo-tooling` spec would make `openspec/specs/` describe the build tooling instead of what the framework does, and would invite one spec folder per tool (CI, changelog, release) — the exact growth `openspec/README.md` exists to prevent.

### Modified Capabilities

- `project-scaffolding`: the generated-project toolchain contract — the emitted lint configuration must be installable and runnable (its imports declared as devDependencies), and the generated `typescript` range must be single-sourced onto the TypeScript 7 line.
- `dev-tooling`: the declaration-emission contract — `nextrush build --dts` must keep producing `.d.ts` output when the resolved local `tsc` is TypeScript 7, and must fail with an actionable error (never silently skip declarations) when no usable compiler can be resolved.

## Impact

- **Affected code:** `packages/create-nextrush` (`templates/preset.ts`, `templates/package-json.ts`, `templates/shared.ts`, `dependency-manifest.ts`), `packages/dev` (`commands/build/declaration-builder.ts` and its type-argument helper), root toolchain files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.mjs` → `oxlint.config.ts`), 21 package `lint` scripts, `apps/website` lint config, and the repo's own RFC/contribution docs.
- **Affected public surface:** none for framework consumers. Newly generated projects receive a different devDependency set, lint config, and editor recommendation; already-generated and existing user projects are untouched.
- **Affected verification:** `pnpm verify` (build → test + typecheck + lint); the create-nextrush generate-then-install matrix; the `@nextrush/dev` build end-to-end and declaration tests; `packages/adapters/conformance` must stay green to prove no runtime behaviour moved.
- **Explicitly NOT affected:** runtime packages and their published artifacts, the request path, all adapters' observable behaviour, Prettier formatting, benchmarking, the release pipeline.
- **Governance note (drift found):** `openspec/config.yaml`'s FIXED CAPABILITY LIST names 17 capabilities and omits `dev-tooling`, `project-scaffolding`, `ecosystem-interop`, and `security-boundaries` — all four exist in `openspec/specs/` and are registered in `openspec/README.md`. This change targets two of the omitted ones, so the list should be corrected in a separate documentation commit.
- **Durable decision:** the architecture already lives in `docs/RFC/repo-tooling/037-typescript-7-oxlint-migration.md` (Draft). Before this change is archived, the durable parts — "the repo linter is Oxlint", and the `typescript` ↔ `oxlint-tsgolint` version-lockstep rule — must be promoted to an ADR from `docs/adr/TEMPLATE.md`.
