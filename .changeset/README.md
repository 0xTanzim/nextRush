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
