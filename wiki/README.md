# GitHub Wiki source (`wiki/`)

This folder is the **hand-written source** for the repo **Wiki** tab (`github.com/<owner>/<repo>/wiki`).

## Do you need to merge to `main` first?

**No for local publishes.** Run `./scripts/publish-github-wiki.sh` from any branch — it syncs whatever is in `wiki/` right now.

**Yes if you rely on CI.** The workflow **Publish GitHub Wiki** runs when **`main`** gets commits that touch `wiki/**` (see `.github/workflows/wiki-publish.yml`). So the usual flow is: edit `wiki/` → merge to `main` → CI publishes (if `WIKI_PUSH_TOKEN` is set).

## Why nothing appeared on GitHub Wiki before

GitHub stores wiki pages in a **separate Git repo** (`<repo>.wiki.git`). Normal pushes to `main` **do not** update it unless you publish (script or CI).

## Manual publish (your laptop)

From the monorepo root, with permission to push to the wiki repo:

```bash
./scripts/publish-github-wiki.sh
```

Requirements:

1. **Wikis** enabled: **Settings → General → Features → Wikis**.
2. **`origin`** points at this GitHub repo — the script derives `… .wiki.git` from it (correct owner/repo casing).
3. **Auth:** SSH agent, HTTPS credential helper, or `gh auth login`.

Copy excludes **`wiki/README.md`** (maintainer-only).

## Automatic publish (GitHub Actions)

Workflow: **Publish GitHub Wiki** — triggers on push to **`main`** when `wiki/**`, the workflow file, or `scripts/publish-github-wiki.sh` changes.

**Important:** `GITHUB_TOKEN` **cannot** push to `*.wiki.git`. Add a **classic Personal Access Token** with **`repo`** scope as repository secret:

| Secret             | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `WIKI_PUSH_TOKEN`  | PAT — clone/push `owner/repo.wiki.git`       |

**Settings → Secrets and variables → Actions → New repository secret** → name `WIKI_PUSH_TOKEN`.

Until this secret exists, the workflow **skips** publish with a notice (CI stays green).

## Edit workflow

1. Edit Markdown under `wiki/` here.
2. Merge to `main` (CI publishes if secret set), **or** run `./scripts/publish-github-wiki.sh` manually anytime.

Canonical docs stay in **`apps/docs`** (GitHub Pages); keep wiki pages short and link there when needed.
