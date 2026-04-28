#!/usr/bin/env bash
# Sync wiki/*.md from this monorepo to GitHub Wiki (<repo>.wiki.git — separate clone URL).
# Usage (from repo root): ./scripts/publish-github-wiki.sh
#
# Remotes (first match wins):
#   1) WIKI_GIT_REMOTE — explicit wiki.git URL (SSH or HTTPS)
#   2) WIKI_PUSH_TOKEN + GITHUB_REPOSITORY — HTTPS with PAT (optional; e.g. no SSH, automated host)
#   3) derive from git remote origin → … .wiki.git (normal laptops with SSH or gh auth)
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

REMOTE_SAFE_DISPLAY=''

if [[ -n "${WIKI_GIT_REMOTE:-}" ]]; then
  REMOTE="${WIKI_GIT_REMOTE}"
  REMOTE_SAFE_DISPLAY="${REMOTE}"
elif [[ -n "${WIKI_PUSH_TOKEN:-}" && -n "${GITHUB_REPOSITORY:-}" ]]; then
  REMOTE="https://x-access-token:${WIKI_PUSH_TOKEN}@github.com/${GITHUB_REPOSITORY}.wiki.git"
  REMOTE_SAFE_DISPLAY="https://github.com/${GITHUB_REPOSITORY}.wiki.git (PAT)"
else
  REMOTE="$(derive_wiki_remote_from_origin)" || {
    echo "error: set git remote \`origin\`, or WIKI_GIT_REMOTE / WIKI_PUSH_TOKEN+GITHUB_REPOSITORY" >&2
    exit 1
  }
  REMOTE_SAFE_DISPLAY="${REMOTE}"
fi

WORKDIR="${WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/nextRush-wiki.XXXXXX")}"

wiki_web_url() {
  local r="$1" path
  if [[ -n "${GITHUB_REPOSITORY:-}" ]] && [[ "${r}" == *"@github.com"* ]]; then
    printf 'https://github.com/%s/wiki\n' "${GITHUB_REPOSITORY}"
    return
  fi
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

echo "→ Using wiki remote: ${REMOTE_SAFE_DISPLAY:-<hidden>}"
echo "→ Cloning wiki repo into ${WORKDIR}"
if ! git clone "${REMOTE}" "${WORKDIR}" 2>/dev/null; then
  echo "→ Clone failed — initializing wiki repo (first publish). Ensure Wikis are enabled on the repo."
  rm -rf "${WORKDIR}"
  mkdir -p "${WORKDIR}"
  git -C "${WORKDIR}" init -b main
  git -C "${WORKDIR}" remote add origin "${REMOTE}"
fi

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
echo "→ Pushing"
branch="$(git rev-parse --abbrev-ref HEAD)"
git push -u origin "${branch}"

echo "→ Done. Wiki: $(wiki_web_url "${REMOTE}")"
