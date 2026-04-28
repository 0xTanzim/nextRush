# GitHub Wiki source (`wiki/`)

Markdown here is meant to be copied into **[the repo Wiki](https://github.com/0xTanzim/nextRush/wiki)**. GitHub stores that in a **separate Git repo** (`*.wiki.git`). Pushes to `main` **do not** update the Wiki tab by themselves.

## Publish (maintainers — one command)

On GitHub:

1. **Settings → General → Features → Wikis** — turn Wikis **on**.
2. Open the **Wiki** tab and **create any page once** (even a stub). That provisions the separate `*.wiki.git` repo; until then, `git` will report *Repository not found* for the wiki remote.
3. From the **monorepo root**:

```bash
./scripts/publish-github-wiki.sh
```

Same requirements as any `git push` to GitHub: **`origin`** must point at this repo, and your machine needs **SSH** (`ssh-agent`) or **HTTPS** (`gh auth login` / credential helper). The script asks the **GitHub API** for the canonical `owner/repo` casing, then builds `…wiki.git` to match (a lowercase-only `origin` URL is not always enough for the wiki remote).

Files copied: everything under `wiki/` **except** this **`README.md`** (notes for contributors only).

## Why there is no Wiki workflow in Actions

Standard **`GITHUB_TOKEN`** in Actions is **not allowed** to push to the wiki Git repository — that is a **GitHub platform rule**, not something we can fix in YAML. Fully automatic wiki publish from CI needs a **personal access token** stored as a secret, which adds maintenance and security review. This repo keeps wiki updates **manual** via the script above so setup stays simple.

If you want automation later, search GitHub’s docs for **“About wikis”** and **“Creating a personal access token”** (classic token with **`repo`** scope), then add your own workflow that pushes with that token.

## Where to learn more (official)

- [GitHub Docs — About wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis/about-wikis)
- [GitHub Docs — Adding or editing wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages)
- [GitHub Docs — Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

Canonical documentation for readers lives in **`apps/docs`** (GitHub Pages).
