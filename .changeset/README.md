# Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a changeset

When you make a change that should be released, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select the packages that have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of the change

## Releasing

To release new versions:

```bash
pnpm version  # Updates package versions
pnpm release  # Builds and publishes to npm
```

After `pnpm version` (`changeset version`) runs successfully, the changeset **`.md` files you added are removed** from `.changeset/` — they are consumed. Only `config.json`, `README.md`, and any *new* unpublished changesets remain. If you still see an old `v3.x.x-stable-release.md`, it was never deleted after a version bump; remove it so you do not accidentally run the same bump twice.
