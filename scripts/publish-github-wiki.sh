#!/usr/bin/env bash
# Sync wiki/*.md from this monorepo to GitHub Wiki (<repo>.wiki.git — separate clone URL).
# Usage (from repo root): ./scripts/publish-github-wiki.sh
# Override remote: WIKI_GIT_REMOTE='https://github.com/org/repo.wiki.git'
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKI_SRC="${ROOT}/wiki"

# Derive wiki.git URL from origin so casing matches GitHub (e.g. 0xtanzim/nextrush vs 0xTanzim/nextRush).
derive_wiki_remote_from_origin() {
  local origin_url
  origin_url="$(git -C "${ROOT}" remote get-url origin 2>/dev/null)" || return 1
  case "${origin_url}" in
    *.git) printf '%s\n' "${origin_url%.git}.wiki.git" ;;
    *) printf '%s.wiki.git\n' "${origin_url}" ;;
  esac
}

if [[ -n "${WIKI_GIT_REMOTE:-}" ]]; then
  REMOTE="${WIKI_GIT_REMOTE}"
else
  REMOTE="$(derive_wiki_remote_from_origin)" || {
    echo "error: set git remote \`origin\` or export WIKI_GIT_REMOTE=<url>.wiki.git" >&2
    exit 1
  }
fi

WORKDIR="${WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/nextRush-wiki.XXXXXX")}"

wiki_web_url() {
  local r="$1" path
  case "${r}" in
    git@github.com:*.wiki.git)
      path="${r#git@github.com:}"
      path="${path%.wiki.git}"
      printf 'https://github.com/%s/wiki\n' "${path}"
      ;;
    https://github.com/*.wiki.git)
      path="${r#https://github.com/}"
      path="${path%.wiki.git}"
      printf 'https://github.com/%s/wiki\n' "${path}"
      ;;
    *)
      printf '%s\n' "(repo → Wiki tab)"
      ;;
  esac
}

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

if [[ ! -d "${WIKI_SRC}" ]]; then
  echo "error: missing wiki directory at ${WIKI_SRC}" >&2
  exit 1
fi

echo "→ Using wiki remote: ${REMOTE}"
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

echo "→ Done. Wiki: $(wiki_web_url "${REMOTE}")"
