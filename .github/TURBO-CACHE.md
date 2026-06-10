# Turborepo caching

## Local only

- Task outputs are cached under `.turbo/` (ignored by git). Commands like `pnpm build`, `pnpm test`, and `pnpm typecheck` reuse cache when inputs match.
- To clear: `pnpm clean` (removes `.turbo` at the repo root) or delete `.turbo` manually.

## Remote cache

Remote caching is **configured** for this repository. All three CI workflows (`ci.yml`, `docs-pages.yml`, `release.yml`) pass `TURBO_TOKEN` and `TURBO_TEAM` as environment variables.

### Enabling remote caching

To activate it, you need to configure two items in your GitHub repository settings:

1. **`TURBO_TOKEN`** — Repository secret (`Settings → Secrets and variables → Actions → Secrets`)
   - For **Vercel Remote Cache**: Create a [Scoped Access Token](https://vercel.com/docs/security/vercel-access-tokens) in Vercel Dashboard and add it as `TURBO_TOKEN`.
   - For **Self-hosted**: Generate any token your cache server accepts. Also set `TURBO_API` as an additional secret pointing to your cache server URL (e.g., `https://cache.example.com`).

2. **`TURBO_TEAM`** — Repository variable (`Settings → Secrets and variables → Actions → Variables`)
   - For **Vercel**: Your Vercel team slug (e.g., `my-team`). For personal accounts, use your Vercel username.
   - For **Self-hosted**: Any string to namespace your cache (e.g., `nextrush`).

### How it works

- `TURBO_TOKEN` is stored as a **secret** (masked in logs).
- `TURBO_TEAM` is stored as a **variable** (visible in logs for debugging).
- Missing secrets/variables evaluate to empty strings — turbo gracefully falls back to local-only caching.
- `turbo.json` has no `remoteCache` block, so it inherits defaults: **enabled when authenticated**, uses Vercel Remote Cache by default unless `TURBO_API` is set.

### Verification

After setup, run a workflow and check logs for:

```
• Remote Caching: 10 shared, 2 local, 1 remote
```

Or in the turbo output:

```
cache hit (remote) — apps/docs
```

If you see `remote` hits, it's working.
