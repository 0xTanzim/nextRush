#!/usr/bin/env bash
# Sync wiki/*.md from this monorepo to GitHub Wiki (separate nextRush.wiki.git repo).
# Usage (from repo root): ./scripts/publish-github-wiki.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKI_SRC="${ROOT}/wiki"
REMOTE="${WIKI_GIT_REMOTE:-https://github.com/0xTanzim/nextRush.wiki.git}"
WORKDIR="${WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/nextRush-wiki.XXXXXX")}"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

if [[ ! -d "${WIKI_SRC}" ]]; then
  echo "error: missing wiki directory at ${WIKI_SRC}" >&2
  exit 1
fi

echo "→ Cloning wiki repo into ${WORKDIR}"
git clone "${REMOTE}" "${WORKDIR}"

echo "→ Copying Markdown (excluding wiki/README.md)"
find "${WORKDIR}" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
rsync -a --exclude 'README.md' "${WIKI_SRC}/" "${WORKDIR}/"

cd "${WORKDIR}"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "→ No wiki changes to publish."
  exit 0
fi

git add -A
git commit -m "docs(wiki): sync from nextRush main repo wiki/"
echo "→ Pushing to ${REMOTE}"
git push origin HEAD

echo "→ Done. Open https://github.com/0xTanzim/nextRush/wiki"
