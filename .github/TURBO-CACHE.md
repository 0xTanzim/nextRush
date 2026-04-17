# Turborepo caching

## Local

- Task results are stored under `.turbo/` (ignored by git). Running `pnpm build`, `pnpm test`, or `pnpm typecheck` reuses cache when inputs match.
- To clear: `pnpm clean` (removes `.turbo` at the repo root) or delete `.turbo` manually.

## Remote cache (Vercel)

CI and local machines can share cache via [Vercel Remote Cache](https://turbo.build/repo/docs/core-concepts/remote-caching).

1. Create a **Vercel account** and link the repo or create a team.
2. In Vercel: **Account Settings → Tokens** → create a token with scope that includes the team.
3. Copy your **team slug** (Vercel dashboard URL or team settings).

### GitHub Actions

Add to the repository:

| Kind      | Name          | Value                                      |
| --------- | ------------- | ------------------------------------------ |
| Secret    | `TURBO_TOKEN` | Vercel token from step 2                   |
| Variable  | `TURBO_TEAM`  | Team slug (not a secret; avoids log masking) |

If `TURBO_TOKEN` or `TURBO_TEAM` is missing, workflows still pass; Turborepo uses the runner’s local `.turbo/` directory only. Configure `TURBO_TOKEN` / `TURBO_TEAM` so CI can share remote cache with your machine.

### Local development

```bash
export TURBO_TOKEN="…"
export TURBO_TEAM="your-team-slug"
pnpm build   # reads/writes remote cache when logged in
```

Or run `npx turbo login` and link the repo per [Turborepo remote caching docs](https://turbo.build/repo/docs/core-concepts/remote-caching).

### Artifact signing

If you enable `remoteCache.signature` in `turbo.json`, set `TURBO_REMOTE_CACHE_SIGNATURE_KEY` in CI and locally. This repo leaves signing disabled to avoid extra setup.
