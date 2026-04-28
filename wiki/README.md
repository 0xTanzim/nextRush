# GitHub Wiki source (`wiki/`)

This folder is the **hand-written source** for **[github.com/0xTanzim/nextRush/wiki](https://github.com/0xTanzim/nextRush/wiki)**.

## Why the wiki looked empty

GitHub stores wiki pages in a **separate Git repository** (`nextRush.wiki.git`).  
Commits to `main` **do not** update that wiki unless someone publishes them.

## Publish or update the wiki (maintainers)

From the **monorepo root**, with GitHub push access:

```bash
./scripts/publish-github-wiki.sh
```

Requirements:

1. Wiki enabled: repository **Settings → General → Features → Wikis** (on).
2. Authentication: HTTPS with credential helper, SSH key, or `gh auth login`.
3. First run creates/replaces wiki pages from every `*.md` here except `README.md`.

After the first successful push, **Home** should load instead of “Create the first page”.

## Edit workflow

1. Change Markdown under `wiki/` in this repo (same PR as code when relevant).
2. Run `./scripts/publish-github-wiki.sh` after merge (or from CI using a PAT — optional).

Full narrative docs stay in **`apps/docs`** (published to GitHub Pages); keep wiki pages concise and link out.
