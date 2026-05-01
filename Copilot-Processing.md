# Copilot Processing — NextRush CLI Bin Reliability

## Request

User reported that new and manually installed NextRush projects must expose working terminal commands for development and builds:

```
nextrush dev
nextrush build
```

Also requested clarity on whether changesets are created automatically by CI or must be generated locally.

## Action Plan

### Diagnose CLI/Dev Failure

- [x] Inspect `create-nextrush` template outputs for scripts, dependencies, and bin usage.
- [x] Inspect `@nextrush/dev` package entrypoint and `bin` exports.
- [x] Inspect the `nextrush` meta package for bin-link conflicts.
- [x] Inspect CI/release changeset handling.

### Implement Fix

- [x] Keep the `nextrush` meta package API-only by removing its `bin` entry and `@nextrush/dev` dependency.
- [x] Keep CLI ownership in `@nextrush/dev`, which provides `nextrush` and `nextrush-dev` bins.
- [x] Confirm generated projects include `@nextrush/dev` in dev dependencies and use `nextrush dev` / `nextrush build` scripts.
- [x] Add repo-wide bin validation and run it during `pnpm verify`.
- [x] Harden bin validation for `files` coverage, relative paths, shebangs, and executable bits.
- [x] Guard invalid `nextrush dev --port` / `--inspect-port` and `nextrush build --target` values.
- [x] Update playground scripts to use `nextrush dev` / `nextrush build`.
- [x] Make the CI changeset guard include `packages/dev`.
- [x] Remove stale `.changeset/v3.0.4-stable-release.md` so it is not consumed again.
- [x] Update docs and examples to use the installed local `nextrush` command instead of `npx nextrush`.

### Validate

- [x] Run `pnpm validate:bins`.
- [x] Run focused package tests for `@nextrush/dev`, `nextrush`, and `create-nextrush`.
- [x] Typecheck `@nextrush/dev`, `nextrush`, and `create-nextrush`.
- [x] Build `@nextrush/dev` and smoke-test `node packages/dev/bin/nextrush.js --version` and `--help`.
- [x] Build `create-nextrush` and generate functional/class-based scaffold smoke apps.
- [x] Verify scaffolded package scripts and dependencies include `nextrush`, `@nextrush/dev`, and `typescript`.
- [x] Refresh workspace links with `pnpm install` after bin ownership changed.
- [x] Run playground `nextrush build` and bounded `nextrush dev` smoke tests.
- [x] Run docs validation with `pnpm docs:validate`.
- [x] Run full repository verification with `pnpm verify`.

## Summary

The fix makes `@nextrush/dev` the only package that owns the `nextrush` terminal command. New scaffolded apps already install `@nextrush/dev` and can run `npm run dev`, `pnpm dev`, or the local `nextrush dev` command from scripts. The playground now uses the same commands.

Manual installs should use both packages:

```bash
npm install nextrush
npm install -D @nextrush/dev typescript
```

Then add scripts:

```json
{
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  }
}
```

Changesets are not created automatically by CI. Developers must run `pnpm changeset` locally for release-impacting package changes, commit the generated `.changeset/*.md`, and then the release workflow consumes those files with `changeset version` / `changeset publish`.

Local validation completed:

```bash
pnpm validate:bins
pnpm --filter @nextrush/dev test
pnpm --filter create-nextrush test
pnpm --filter nextrush test -- src/__tests__/package-manifest.test.ts
pnpm --filter api build
timeout 8s pnpm --filter api dev
pnpm docs:validate
pnpm verify
```
