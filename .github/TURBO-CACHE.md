# Turborepo caching

## Local only

- Task outputs are cached under `.turbo/` (ignored by git). Commands like `pnpm build`, `pnpm test`, and `pnpm typecheck` reuse cache when inputs match.
- To clear: `pnpm clean` (removes `.turbo` at the repo root) or delete `.turbo` manually.

## Remote cache

Remote caching is **off** for this repository: `turbo.json` sets `"remoteCache": { "enabled": false }`, and GitHub Actions does **not** set `TURBO_TOKEN` / `TURBO_TEAM`. CI uses a fresh local cache on each run.

Do not add Vercel (or other) remote cache secrets for this project unless you intentionally re-enable remote caching in config and workflows.
