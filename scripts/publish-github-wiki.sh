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

# owner/repo from git@github.com:owner/repo.git or https://github.com/owner/repo(.git)
parse_github_repo_from_url() {
  local url="$1" path
  url="${url%.git}"
  case "${url}" in
    git@github.com:*)
      path="${url#git@github.com:}"
      ;;
    https://github.com/*|https://www.github.com/*)
      path="${url#https://}"
      path="${path#www.github.com/}"
      path="${path#github.com/}"
      path="${path%%\?*}"
      ;;
    *)
      return 1
      ;;
  esac
  [[ "${path}" == */* ]] || return 1
  printf '%s\n' "${path}"
}

# Match GitHub's canonical owner/repo casing (wiki.git often 404s if casing differs from redirects).
resolve_canonical_github_repo() {
  local owner_repo="$1"
  local json full_name curl_opts=(
    -fsSL --connect-timeout 15
    -H 'Accept: application/vnd.github+json'
  )
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    curl_opts+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
  fi
  json="$(curl "${curl_opts[@]}" "https://api.github.com/repos/${owner_repo}" 2>/dev/null)" || return 1
  full_name="$(printf '%s' "${json}" | sed -n 's/.*"full_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  [[ -n "${full_name}" ]] || return 1
  printf '%s\n' "${full_name}"
}

derive_wiki_remote_from_origin() {
  local origin_url owner_repo canonical
  origin_url="$(git -C "${ROOT}" remote get-url origin 2>/dev/null)" || return 1
  owner_repo="$(parse_github_repo_from_url "${origin_url}")" || return 1
  if canonical="$(resolve_canonical_github_repo "${owner_repo}")"; then
    if [[ "${canonical}" != "${owner_repo}" ]]; then
      echo "→ Resolved canonical repo ${canonical} (origin uses ${owner_repo})" >&2
    fi
  else
    canonical="${owner_repo}"
    echo "warn: could not resolve canonical name via GitHub API (private/offline?). Using origin path ${owner_repo}. Set GITHUB_TOKEN or WIKI_GIT_REMOTE if push fails." >&2
  fi
  case "${origin_url}" in
    git@github.com:*)
      printf 'git@github.com:%s.wiki.git\n' "${canonical}"
      ;;
    https://github.com/*|https://www.github.com/*)
      printf 'https://github.com/%s.wiki.git\n' "${canonical}"
      ;;
    *)
      printf '%s\n' "${origin_url%.git}.wiki.git"
      ;;
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

wiki_unreachable_hint() {
  cat >&2 <<'EOS'

hint: GitHub reported the wiki remote as missing or inaccessible. Often:
  • Wikis are disabled — Settings → General → Features → Wikis → Enable
  • The wiki Git repo is not provisioned yet — open the Wiki tab and create any page once
  • origin URL is stale — if git says the repository moved when you push main, run:
      git remote set-url origin <URL from that message>

Override manually:
  WIKI_GIT_REMOTE='git@github.com:OWNER/REPO.wiki.git' ./scripts/publish-github-wiki.sh

Private repos need GITHUB_TOKEN so this script can resolve canonical casing via the API.

EOS
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
echo "→ Checking wiki remote..."
if ! git ls-remote "${REMOTE}" &>/dev/null; then
  echo "error: cannot read wiki remote (git ls-remote failed)." >&2
  wiki_unreachable_hint
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
echo "→ Pushing"
branch="$(git rev-parse --abbrev-ref HEAD)"
if ! git push -u origin "${branch}"; then
  wiki_unreachable_hint
  exit 1
fi

echo "→ Done. Wiki: $(wiki_web_url "${REMOTE}")"
