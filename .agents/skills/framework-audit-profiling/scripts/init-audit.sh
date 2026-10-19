#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: init-audit.sh [--root PATH] [--force]

Create a .audit/ workspace in PATH (default: current directory).
Existing files are never overwritten unless --force is provided.
USAGE
}

ROOT="$(pwd)"
FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "--root needs a path" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../templates" && pwd)"
OUT="$ROOT/.audit"
mkdir -p "$OUT"

write_from_template() {
  local src="$1" dest="$2"
  if [[ -e "$dest" && "$FORCE" -ne 1 ]]; then
    printf 'KEEP   %s (already exists; use --force to replace)\n' "$dest"
    return
  fi
  cp "$src" "$dest"
  printf 'WRITE  %s\n' "$dest"
}

write_from_template "$TEMPLATE_DIR/README.md" "$OUT/README.md"
for name in 00-plan.md 01-evidence.md 02-findings.md 03-comparison.md 04-experiments.md 05-validation.md final-report.md; do
  write_from_template "$TEMPLATE_DIR/$name" "$OUT/$name"
done

MANIFEST="$OUT/run-manifest.json"
if [[ -e "$MANIFEST" && "$FORCE" -ne 1 ]]; then
  printf 'KEEP   %s (already exists; use --force to replace)\n' "$MANIFEST"
else
  COMMIT="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || printf 'unknown')"
  BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || printf 'unknown')"
  STATUS="unknown"
  if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if [[ -z "$(git -C "$ROOT" status --porcelain)" ]]; then STATUS="clean"; else STATUS="dirty"; fi
  fi
  DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{\n  "created_utc": "%s",\n  "status": "planned",\n  "repository_root": "%s",\n  "git_branch": "%s",\n  "git_commit": "%s",\n  "worktree_status_at_scaffold": "%s",\n  "runtime_versions": {},\n  "commands_run": [],\n  "artifact_notes": "Scaffold only; fill during audit. Do not treat this manifest as proof the audit ran."\n}\n' \
    "$DATE" "$ROOT" "$BRANCH" "$COMMIT" "$STATUS" > "$MANIFEST"
  printf 'WRITE  %s\n' "$MANIFEST"
fi

printf '\nAudit workspace: %s\n' "$OUT"
printf 'Next: fill 00-plan.md, then update the evidence ledger as checks run.\n'
