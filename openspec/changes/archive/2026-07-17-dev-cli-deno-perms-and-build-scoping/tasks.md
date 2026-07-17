## 1. Deno permissions (T043)

- [x] 1.1 RED: extend `packages/dev/src/__tests__/deno-permissions.test.ts` with failing cases — (a) default-only args when unconfigured, (b) a configured extra permission (e.g. `--allow-write`) appears in the spawned Deno args, (c) a permission duplicating a default appears exactly once, (d) an invalid permission value fails fast before spawn
- [x] 1.2 Add a `deno` config surface (pass-through permission flag string array) in `packages/dev/src/utils/config.ts` + its types; document the field
- [x] 1.3 In `buildDevArgs` (`packages/dev/src/runtime/spawn.ts`), merge + dedupe configured permissions into the default `--allow-net --allow-read --allow-env` set (extend, never replace)
- [x] 1.4 Validate each configured permission begins with `--allow-`/`--deny-`; on violation exit non-zero with a message naming the offending value, before spawning Deno
- [x] 1.5 GREEN: new tests pass; the pre-existing default-set assertions in `deno-permissions.test.ts` stay green (defaults unchanged)
- [x] 1.6 Docs: `@nextrush/dev` README — permissions escape hatch + explicit sandbox-weakening caveat (never auto-`--allow-all`)

## 2. Workspace-aware build scoping (T044)

- [x] 2.1 RED: add a build test with a fixture workspace (a package, a sibling package, and a nested subdir with its own `package.json`) asserting — sibling excluded, nested package excluded, single-package project unaffected, no-boundary fallback to cwd-rooted scan
- [x] 2.2 Resolve the scan root to the nearest enclosing `package.json` directory for the build target (`packages/dev/src/commands/build.ts` and its scan helper)
- [x] 2.3 Exclude nested subdirectories that carry their own `package.json` (in addition to the existing `node_modules` exclusion); never ascend above the boundary
- [x] 2.4 Fallback to the prior cwd-rooted scan when no enclosing `package.json` is found
- [x] 2.5 GREEN: new tests pass; existing build + `build-e2e-integration` tests stay green
- [x] 2.6 Docs: document monorepo build scoping (package boundary rule, nested-package caveat) in `@nextrush/dev` docs/README

## 3. Verify & release

- [x] 3.1 `pnpm --filter @nextrush/dev test` + `typecheck` + `lint` green; coverage not regressed on touched files
- [x] 3.2 Add a `@nextrush/dev` changeset (user-visible new behavior; patch or minor per the two additive features)
- [x] 3.3 Update gap-checklist glyphs for T043 and T044 (□ → ☑) with a Verified note citing what was checked
