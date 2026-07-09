#!/usr/bin/env bash
#
# reset-independent-packages.sh
#
# Safely reset selected INDEPENDENT NextRush packages onto a fresh 1.0.0 line by
# unpublishing every published version from npm, so they can be republished from
# scratch after npm's 24-hour cool-down. Packages in the Changesets `fixed`
# group (locked to @nextrush/core) and @nextrush/class (a runtime dependency of
# preserved packages) are NEVER touched.
#
# SAFETY MODEL
#   * Dry-run is the DEFAULT. No mutating npm call runs without --execute.
#   * With --execute, a typed confirmation is required unless --yes is given.
#   * `npm view` (read-only) always runs, so dry-run reflects real registry state.
#   * --force is used ONLY on the final remaining version (npm's own rule).
#   * Registry policy problems (404 / dependents) SKIP a package and continue.
#   * Auth failures (401 / 403) abort immediately — they mean a misconfiguration.
#   * Transient failures (timeouts, 5xx, 429) are retried with exponential backoff.
#
# USAGE
#   scripts/reset-independent-packages.sh <command> [flags]
#
# COMMANDS
#   list            Print the target packages and the protected (excluded) ones.
#   versions        Show currently-published versions for each target package.
#   set-versions    Rewrite each target package.json "version" to --target.
#   unpublish       Remove every published version of each target from npm.
#   verify          Confirm each target is gone from npm (expects 404).
#
# FLAGS
#   --execute            Perform mutations (default is dry-run).
#   --yes                Skip the interactive typed confirmation (CI use).
#   --target <version>   Version for `set-versions` (default: 1.0.0).
#   --packages-file <f>  Newline-delimited package names overriding the built-in list.
#   -h, --help           Show this help.
#
# REPORTS
#   `unpublish` and `verify` write reports/reset-report.md and reports/reset-report.json.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants and configuration
# ---------------------------------------------------------------------------
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPORTS_DIR="${REPO_ROOT}/reports"
readonly MAX_RETRIES=5              # transient-failure retry attempts
readonly VERIFY_TIMEOUT=60          # seconds to wait for npm eventual consistency
readonly VERIFY_INTERVAL=3          # seconds between verification polls

# Mutable options (set by argument parsing).
TARGET_VERSION="1.0.0"
DRY_RUN=1
ASSUME_YES=0
PACKAGES_FILE=""
COMMAND=""

# Scratch files (cleaned up on exit).
ERR_TMP="$(mktemp)"
REPORT_TMP="$(mktemp)"
readonly ERR_TMP REPORT_TMP
trap 'rm -f "${ERR_TMP}" "${REPORT_TMP}"' EXIT

# Captured stdout of the most recent npm call, plus its classified error kind.
CAPTURED_STDOUT=""
LAST_ERROR_KIND=""

# Independent packages that ARE reset (name -> package directory).
declare -A PKG_PATHS=(
  ["@nextrush/adapter-deno"]="packages/adapters/deno"
  ["@nextrush/adapter-bun"]="packages/adapters/bun"
  ["@nextrush/adapter-edge"]="packages/adapters/edge"
  ["@nextrush/websocket"]="packages/extensions/websocket"
  ["@nextrush/events"]="packages/extensions/events"
  ["@nextrush/validation"]="packages/middleware/validation"
  ["@nextrush/openapi"]="packages/middleware/openapi"
  ["@nextrush/cookies"]="packages/middleware/cookies"
  ["@nextrush/rate-limit"]="packages/middleware/rate-limit"
  ["@nextrush/csrf"]="packages/middleware/csrf"
  ["@nextrush/multipart"]="packages/middleware/multipart"
  ["@nextrush/timer"]="packages/middleware/timer"
  ["@nextrush/request-id"]="packages/middleware/request-id"
  ["@nextrush/template"]="packages/middleware/template"
  ["@nextrush/static"]="packages/middleware/static"
  ["@nextrush/logger"]="packages/middleware/logger"
  ["@nextrush/testing"]="packages/testing"
  ["@nextrush/dev"]="packages/dev"
  ["create-nextrush"]="packages/create-nextrush"
)

# Protected packages that must NEVER be reset: the Changesets `fixed` group,
# @nextrush/class (nextrush/controllers/decorators depend on it at runtime),
# and packages npm has permanently blocked from unpublishing because another
# published package on the registry still declares a dependency on them
# (npm error E405 "has dependent packages in the registry" — confirmed live
# against the registry on 2026-07-09; --force does NOT bypass this gate).
# These 4 stay on their 3.x line and move forward as 3.1.0 instead of 1.0.0.
declare -A EXCLUDED_PACKAGES=(
  ["@nextrush/types"]=1 ["@nextrush/errors"]=1 ["@nextrush/core"]=1
  ["@nextrush/router"]=1 ["@nextrush/runtime"]=1 ["@nextrush/stream"]=1
  ["@nextrush/di"]=1 ["@nextrush/decorators"]=1 ["@nextrush/controllers"]=1
  ["@nextrush/adapter-node"]=1 ["nextrush"]=1 ["@nextrush/class"]=1
  ["@nextrush/body-parser"]=1 ["@nextrush/compression"]=1
  ["@nextrush/cors"]=1 ["@nextrush/helmet"]=1
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
readonly C_RESET=$'\033[0m' C_INFO=$'\033[36m' C_OK=$'\033[32m'
readonly C_WARN=$'\033[33m' C_ERR=$'\033[31m' C_DIM=$'\033[2m'

log()  { printf '%s[reset]%s %s\n'    "${C_INFO}" "${C_RESET}" "$*"; }
ok()   { printf '%s  ✓ %s%s\n'        "${C_OK}"   "$*" "${C_RESET}"; }
warn() { printf '%s  ! %s%s\n'        "${C_WARN}" "$*" "${C_RESET}"; }
dryn() { printf '%s  [dry-run] %s%s\n' "${C_DIM}" "$*" "${C_RESET}"; }
die()  { printf '%s[fatal]%s %s\n'    "${C_ERR}"  "${C_RESET}" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# npm plumbing
# ---------------------------------------------------------------------------

# Classify the contents of ERR_TMP into a coarse failure category. Order matters:
# auth is checked before generic HTTP codes so a 403 is never seen as transient.
classify_error() {
  if   grep -qiE 'E401|E403|\b401\b|\b403\b|ENEEDAUTH|need.*auth|unauthorized|forbidden' "${ERR_TMP}"; then
    echo "auth"
  elif grep -qiE 'E404|\b404\b|not found|is not in (this|the) registry' "${ERR_TMP}"; then
    echo "notfound"
  elif grep -qiE 'E405|\b405\b|has dependent packages' "${ERR_TMP}"; then
    echo "dependents"
  elif grep -qiE 'ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|ESOCKETTIMEDOUT|socket hang up|\b429\b|\b500\b|\b502\b|\b503\b|\b504\b|registry.*unavailable' "${ERR_TMP}"; then
    echo "transient"
  else
    echo "other"
  fi
}

# Run `npm "$@"`, capturing stdout into CAPTURED_STDOUT and stderr into ERR_TMP.
# Returns npm's exit code. Never aborts the script itself.
npm_capture() {
  set +e
  CAPTURED_STDOUT="$(npm "$@" 2>"${ERR_TMP}")"
  local rc=$?
  set -e
  return "${rc}"
}

# Retry wrapper around npm_capture: retries only "transient" classifications
# with exponential backoff (1,2,4,8,16s). Sets LAST_ERROR_KIND. Returns rc.
retry() {
  local description="$1"; shift
  local attempt=1 delay=1 rc
  while true; do
    if npm_capture "$@"; then
      LAST_ERROR_KIND="ok"
      return 0
    fi
    rc=$?
    LAST_ERROR_KIND="$(classify_error)"
    if [[ "${LAST_ERROR_KIND}" == "transient" && "${attempt}" -lt "${MAX_RETRIES}" ]]; then
      warn "${description}: transient error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}s"
      sleep "${delay}"
      attempt=$((attempt + 1))
      delay=$((delay * 2))
      continue
    fi
    return "${rc}"
  done
}

# Abort the whole run on an authentication failure — it will affect every package.
abort_if_auth() {
  if [[ "${LAST_ERROR_KIND}" == "auth" ]]; then
    warn "npm authentication/permission failure:"
    sed 's/^/      /' "${ERR_TMP}" >&2
    die "auth error (401/403). Fix npm login/permissions and re-run."
  fi
}

# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

# Print published versions (one per line) on stdout. Returns: 0 = found,
# 44 = 404 (absent), 1 = other/exhausted failure.
#
# Handles two distinct npm "not found" shapes:
#   * older npm: non-zero exit with E404 on stderr (classified via classify_error);
#   * newer npm: exit 0 with `{"error":{"code":"E404",...}}` on stdout.
fetch_versions() {
  local name="$1" parsed rc_node
  if retry "fetch ${name}" view "${name}" versions --json; then
    set +e
    parsed="$(node -e '
      const raw = process.argv[1] || "";
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        const text = raw.trim();
        if (!text) process.exit(44);
        console.log(text);
        process.exit(0);
      }
      if (value && typeof value === "object" && !Array.isArray(value) && value.error) {
        if ((value.error.code || "") === "E404") process.exit(44);
        console.error(value.error.summary || value.error.code || "npm error");
        process.exit(3);
      }
      if (Array.isArray(value)) { value.forEach((v) => console.log(v)); process.exit(0); }
      if (typeof value === "string" && value) { console.log(value); process.exit(0); }
      process.exit(44);
    ' "${CAPTURED_STDOUT}")"
    rc_node=$?
    set -e
    case "${rc_node}" in
      0)  printf '%s\n' "${parsed}"; return 0 ;;
      44) LAST_ERROR_KIND="notfound"; return 44 ;;
      *)  LAST_ERROR_KIND="other"; return 1 ;;
    esac
  fi
  abort_if_auth
  [[ "${LAST_ERROR_KIND}" == "notfound" ]] && return 44
  return 1
}

# Unpublish a single version. Pass "force" as the 3rd arg for the final version.
# Returns npm's classified outcome via LAST_ERROR_KIND (0 on success).
unpublish_version() {
  local name="$1" version="$2" force="${3:-}"
  local -a args=(unpublish "${name}@${version}")
  [[ "${force}" == "force" ]] && args+=(--force)

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    dryn "npm ${args[*]}"
    return 0
  fi
  if retry "unpublish ${name}@${version}" "${args[@]}"; then
    return 0
  fi
  abort_if_auth
  return 1
}

# Poll the registry until the package returns 404, up to VERIFY_TIMEOUT seconds,
# tolerating stale metadata (npm eventual consistency). Returns 0 when gone.
verify_gone() {
  local name="$1"
  local deadline=$((SECONDS + VERIFY_TIMEOUT))
  while [[ "${SECONDS}" -lt "${deadline}" ]]; do
    if retry "verify ${name}" view "${name}" version; then
      sleep "${VERIFY_INTERVAL}"   # still resolves — wait for propagation
      continue
    fi
    abort_if_auth
    [[ "${LAST_ERROR_KIND}" == "notfound" ]] && return 0
    sleep "${VERIFY_INTERVAL}"
  done
  return 1
}

# Rewrite only the top-level "version" field of a package.json, preserving all
# other formatting. Errors if the field is missing.
set_package_version() {
  local file="$1" version="$2"
  node -e '
    const fs = require("fs");
    const [file, version] = process.argv.slice(1);
    const source = fs.readFileSync(file, "utf8");
    const pattern = /^([ \t]*"version"[ \t]*:[ \t]*")[^"]*(")/m;
    if (!pattern.test(source)) {
      console.error("no version field: " + file);
      process.exit(1);
    }
    fs.writeFileSync(file, source.replace(pattern, `$1${version}$2`));
  ' "${file}" "${version}"
}

# ---------------------------------------------------------------------------
# Targets and safety
# ---------------------------------------------------------------------------

# Emit the list of package names to act on (built-in list or --packages-file),
# aborting if any name is on the protected list.
load_targets() {
  local -a names=()
  if [[ -n "${PACKAGES_FILE}" ]]; then
    [[ -f "${PACKAGES_FILE}" ]] || die "packages file not found: ${PACKAGES_FILE}"
    mapfile -t names < <(grep -vE '^\s*(#|$)' "${PACKAGES_FILE}")
  else
    mapfile -t names < <(printf '%s\n' "${!PKG_PATHS[@]}" | sort)
  fi

  local name
  for name in "${names[@]}"; do
    if [[ -n "${EXCLUDED_PACKAGES[${name}]:-}" ]]; then
      die "protected package present in target list: ${name} (aborting)"
    fi
  done
  printf '%s\n' "${names[@]}"
}

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

# Append one structured record: package, status, versions(csv), reason, seconds.
record() {
  local pkg="$1" status="$2" versions="$3" reason="$4" seconds="$5"
  reason="${reason//$'\t'/ }"; reason="${reason//$'\n'/ }"
  printf '%s\t%s\t%s\t%s\t%s\n' "${pkg}" "${status}" "${versions}" "${reason}" "${seconds}" \
    >>"${REPORT_TMP}"
}

# Render reports/reset-report.{md,json} from the accumulated records.
report() {
  local command="$1"
  mkdir -p "${REPORTS_DIR}"
  local mode="execute"; [[ "${DRY_RUN}" -eq 1 ]] && mode="dry-run"

  node -e '
    const fs = require("fs");
    const [reportTmp, dir, command, mode] = process.argv.slice(1);
    const lines = fs.existsSync(reportTmp)
      ? fs.readFileSync(reportTmp, "utf8").split("\n").filter(Boolean)
      : [];
    const packages = lines.map((line) => {
      const [pkg, status, versions, reason, seconds] = line.split("\t");
      return {
        package: pkg,
        status,
        versionsRemoved: versions ? versions.split(",").filter(Boolean) : [],
        reason: reason || null,
        seconds: Number(seconds) || 0,
      };
    });
    const totals = { ok: 0, skipped: 0, failed: 0 };
    for (const p of packages) {
      if (p.status === "OK") totals.ok++;
      else if (p.status === "SKIPPED") totals.skipped++;
      else totals.failed++;
    }
    const generatedAt = new Date().toISOString();
    const json = { generatedAt, command, mode, totals, packages };
    fs.writeFileSync(dir + "/reset-report.json", JSON.stringify(json, null, 2) + "\n");

    const md = [];
    md.push("# NextRush package reset report", "");
    md.push("- Generated: " + generatedAt);
    md.push("- Command: `" + command + "`");
    md.push("- Mode: **" + mode + "**");
    md.push("- Totals: " + totals.ok + " ok, " + totals.skipped + " skipped, " + totals.failed + " failed", "");
    md.push("| Package | Status | Versions removed | Reason | Seconds |");
    md.push("| --- | --- | --- | --- | --- |");
    for (const p of packages) {
      md.push("| " + [
        p.package,
        p.status,
        p.versionsRemoved.join(", ") || "—",
        p.reason || "—",
        p.seconds,
      ].join(" | ") + " |");
    }
    md.push("");
    fs.writeFileSync(dir + "/reset-report.md", md.join("\n"));
  ' "${REPORT_TMP}" "${REPORTS_DIR}" "${command}" "${mode}"

  log "Reports written to reports/reset-report.md and reports/reset-report.json"
}

# ---------------------------------------------------------------------------
# Confirmation gate
# ---------------------------------------------------------------------------
confirm() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    warn "DRY-RUN mode — nothing will be removed. Re-run with --execute to apply."
    return 0
  fi
  warn "EXECUTE mode: this PERMANENTLY unpublishes packages from npm."
  warn "Unpublished version numbers can NEVER be reused, and npm blocks"
  warn "re-publishing the same name for 24 hours. This is irreversible."
  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    log "--yes supplied; proceeding without prompt."
    return 0
  fi
  printf 'Type exactly RESET to continue: '
  local answer
  read -r answer
  [[ "${answer}" == "RESET" ]] || die "confirmation not given (got '${answer}'). Aborting."
}

# ---------------------------------------------------------------------------
# Per-package orchestration
# ---------------------------------------------------------------------------

# Full reset of one package: fetch -> remove non-final -> force-remove final ->
# verify. Records exactly one report row. Never aborts except on auth errors.
process_package() {
  local name="$1"
  local start="${SECONDS}"
  log "Processing: ${name}"

  local versions_output rc
  set +e; versions_output="$(fetch_versions "${name}")"; rc=$?; set -e

  if [[ "${rc}" -eq 44 ]]; then
    ok "${name}: not published — skipped (idempotent)"
    record "${name}" "SKIPPED" "" "already unpublished (404)" "$((SECONDS - start))"
    return 0
  fi
  if [[ "${rc}" -ne 0 ]]; then
    warn "${name}: could not read versions (${LAST_ERROR_KIND})"
    record "${name}" "FAILED" "" "version lookup failed (${LAST_ERROR_KIND})" "$((SECONDS - start))"
    return 0
  fi

  local -a versions=()
  mapfile -t versions < <(printf '%s\n' "${versions_output}" | grep -vE '^\s*$')
  local count="${#versions[@]}"
  if [[ "${count}" -eq 0 ]]; then
    ok "${name}: no versions present — skipped"
    record "${name}" "SKIPPED" "" "no published versions" "$((SECONDS - start))"
    return 0
  fi

  local versions_csv; versions_csv="$(IFS=,; echo "${versions[*]}")"
  log "  versions: ${versions[*]}"
  log "  removing..."

  # Requirement 7: remove non-final versions WITHOUT --force, in order.
  local i
  for ((i = 0; i < count - 1; i++)); do
    if ! unpublish_version "${name}" "${versions[$i]}"; then
      if [[ "${LAST_ERROR_KIND}" == "notfound" ]]; then
        continue   # already gone — fine
      fi
      if [[ "${LAST_ERROR_KIND}" == "dependents" ]]; then
        warn "${name}: registry dependents — skipping remaining versions"
        record "${name}" "SKIPPED" "" "has dependent packages in the registry" "$((SECONDS - start))"
        return 0
      fi
      warn "${name}: failed to unpublish ${versions[$i]} (${LAST_ERROR_KIND})"
      record "${name}" "FAILED" "" "unpublish ${versions[$i]} failed (${LAST_ERROR_KIND})" "$((SECONDS - start))"
      return 0
    fi
  done

  # Only the final version remains: force-remove the whole package.
  if ! unpublish_version "${name}" "${versions[$((count - 1))]}" force; then
    if [[ "${LAST_ERROR_KIND}" == "dependents" ]]; then
      warn "${name}: registry dependents — cannot force-remove"
      record "${name}" "SKIPPED" "" "has dependent packages in the registry" "$((SECONDS - start))"
      return 0
    fi
    if [[ "${LAST_ERROR_KIND}" != "notfound" ]]; then
      warn "${name}: force-unpublish failed (${LAST_ERROR_KIND})"
      record "${name}" "FAILED" "" "force unpublish failed (${LAST_ERROR_KIND})" "$((SECONDS - start))"
      return 0
    fi
  fi

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    dryn "would verify ${name} returns 404"
    record "${name}" "OK" "${versions_csv}" "dry-run" "$((SECONDS - start))"
    return 0
  fi

  # Requirement 4 & 8: verify removal, tolerating eventual consistency.
  if verify_gone "${name}"; then
    ok "${name}: verified removed (404)"
    record "${name}" "OK" "${versions_csv}" "removed and verified" "$((SECONDS - start))"
  else
    warn "${name}: still resolves after ${VERIFY_TIMEOUT}s"
    record "${name}" "FAILED" "${versions_csv}" "not 404 after ${VERIFY_TIMEOUT}s" "$((SECONDS - start))"
  fi
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_list() {
  log "Independent packages that WILL be reset (${#PKG_PATHS[@]}):"
  load_targets | while read -r name; do printf '    %s\n' "${name}"; done
  echo
  log "Protected packages that will NEVER be touched (${#EXCLUDED_PACKAGES[@]}):"
  printf '%s\n' "${!EXCLUDED_PACKAGES[@]}" | sort | while read -r name; do
    printf '    %s\n' "${name}"
  done
}

cmd_versions() {
  local name rc versions_output
  while read -r name; do
    set +e; versions_output="$(fetch_versions "${name}")"; rc=$?; set -e
    if [[ "${rc}" -eq 44 ]]; then
      warn "${name}: not published (404)"
    elif [[ "${rc}" -ne 0 ]]; then
      warn "${name}: lookup failed (${LAST_ERROR_KIND})"
    else
      printf '  %s:\n' "${name}"
      printf '%s\n' "${versions_output}" | sed 's/^/      /'
    fi
  done < <(load_targets)
}

cmd_set_versions() {
  [[ "${TARGET_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-].*)?$ ]] \
    || die "invalid --target version: ${TARGET_VERSION}"
  local name path file current
  while read -r name; do
    path="${PKG_PATHS[${name}]:-}"
    [[ -z "${path}" ]] && die "no path mapping for ${name} (set-versions needs the built-in list)"
    file="${REPO_ROOT}/${path}/package.json"
    [[ -f "${file}" ]] || die "missing ${file}"
    if [[ "${DRY_RUN}" -eq 1 ]]; then
      current="$(node -e 'process.stdout.write(require(process.argv[1]).version)' "${file}")"
      dryn "${name}: ${current} -> ${TARGET_VERSION} (${path}/package.json)"
    else
      set_package_version "${file}" "${TARGET_VERSION}" || die "failed to set version for ${name}"
      ok "${name} -> ${TARGET_VERSION}"
    fi
  done < <(load_targets)
}

cmd_unpublish() {
  confirm
  local name
  while read -r name; do
    process_package "${name}"
  done < <(load_targets)
  report "unpublish"
}

cmd_verify() {
  local name start
  while read -r name; do
    start="${SECONDS}"
    if verify_gone "${name}"; then
      ok "${name}: gone (404)"
      record "${name}" "OK" "" "verified 404" "$((SECONDS - start))"
    else
      warn "${name}: still published"
      record "${name}" "FAILED" "" "still resolves after ${VERIFY_TIMEOUT}s" "$((SECONDS - start))"
    fi
  done < <(load_targets)
  report "verify"
}

usage() { sed -n '2,54p' "${BASH_SOURCE[0]}" | sed 's/^#\{0,1\} \{0,1\}//'; }

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      list|versions|set-versions|unpublish|verify) COMMAND="$1"; shift ;;
      --execute) DRY_RUN=0; shift ;;
      --yes) ASSUME_YES=1; shift ;;
      --target) TARGET_VERSION="${2:?--target needs a value}"; shift 2 ;;
      --packages-file) PACKAGES_FILE="${2:?--packages-file needs a path}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) die "unknown argument: $1 (try --help)" ;;
    esac
  done

  [[ -z "${COMMAND}" ]] && { usage; exit 1; }
  command -v npm  >/dev/null || die "npm not found on PATH"
  command -v node >/dev/null || die "node not found on PATH"

  case "${COMMAND}" in
    list)         cmd_list ;;
    versions)     cmd_versions ;;
    set-versions) cmd_set_versions ;;
    unpublish)    cmd_unpublish ;;
    verify)       cmd_verify ;;
  esac
}

main "$@"
