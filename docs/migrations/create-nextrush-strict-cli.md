# create-nextrush strict CLI — migration note

> **Applies to:** `create-nextrush` (the `npm create nextrush` / `npx create-nextrush` command).
> **Behavior change:** invalid input and non-empty-target conflicts now fail loudly instead of
> silently succeeding.
> **Related:** [ADR-0024](../../docs/adr/ADR-0024-create-nextrush-strict-automation-contract.md),
> change `elevate-scaffolding-dx`.

## Why

Previously the scaffolder silently ignored invalid enum values and unknown flags, and `--yes`
into a non-empty directory could cancel with exit code 0. That made a CI pipeline able to create
a different project than it asked for while reporting success. This release corrects the exit
contract so automation can trust the result.

## Before / after

### 1. Invalid or unknown options now fail

```bash
# BEFORE: `--runtime nodee` and `--typo` were ignored and the project was created with exit 0
npm create nextrush my-api -- --runtime nodee          # created a Node project, exit 0
npm create nextrush my-api -- --typo                   # created a project, exit 0

# AFTER: non-zero exit with an actionable message; nothing is created
npm create nextrush my-api -- --runtime nodee          # error [INVALID_RUNTIME], exit 1
npm create nextrush my-api -- --typo                   # error [UNKNOWN_OPTION], exit 1
npm create nextrush my-api -- --style                  # error [MISSING_OPTION_VALUE], exit 1
```

**Fix:** correct the command. The error names the invalid input, lists valid values where
applicable, and points to `--help`.

### 2. Non-empty target conflicts are safe and machine-detectable

```bash
# BEFORE: `--yes` into a non-empty directory cancelled with exit 0 (silent "no change")
npm create nextrush apps/api -- --yes                 # cancelled, exit 0

# AFTER: non-interactive mode exits non-zero with the stable TARGET_DIRECTORY_NOT_EMPTY code
npm create nextrush apps/api -- --yes                 # error [TARGET_DIRECTORY_NOT_EMPTY], exit 1

# Interactive mode still asks first (default: no); overwrite is now an explicit opt-in
npm create nextrush apps/api -- --yes --overwrite     # states files may be replaced, proceeds
```

**Fix:** use an empty directory, or pass `--overwrite` explicitly after reviewing the planned
files. `--yes` never implies overwrite.

## What is new

- `--dry-run` — validate input and print the resolved plan without writing or running anything.
- `--json` — emit one schema-versioned result/error document on stdout (no decorative UI).
- `--offline` — skip registry probes and use the embedded per-package fallback ranges.
- `--overwrite` — explicit, documented destructive opt-in for non-empty targets.
- `--preset production`, `--example secure-api`, `--workspace` — opt-in layers.

## Rollback

The strict default is intentional and will not be reverted to silent success. If a downstream
workflow depends on the old permissive behavior, correct the invocation — there is no legacy
flag that restores silent success.
