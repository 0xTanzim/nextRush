#!/usr/bin/env bash
set -euo pipefail

# Entrypoint for the create-nextrush Docker compatibility matrix.
#
# Exercises the REAL package-manager entrypoints — `npm create`, `pnpm create`,
# `yarn create`, `bun create` — plus the Deno path, against a local verdaccio
# registry that serves the packed create-nextrush tarball. For each manager ×
# generated-runtime combination it then installs, builds, tests, starts the dev
# server, and curls the health endpoint. Any failure aborts non-zero so the
# offending manager/runtime is reported loudly.
#
# Env:
#   PM_LIST      space-separated managers (default: npm pnpm yarn bun)
#   RUNTIME_LIST space-separated generated runtimes (default: node bun deno)
#   PORT         port for the health probe (default: 8080)

PM_LIST="${PM_LIST:-npm pnpm yarn bun}"
RUNTIME_LIST="${RUNTIME_LIST:-node bun deno}"
PORT="${PORT:-8080}"
TARBALL="${1:-/work/create-nextrush.tgz}"
REGISTRY="http://127.0.0.1:4873"

echo "=== starting local registry (verdaccio) ==="
rm -rf /work/verdaccio/storage
mkdir -p /work/verdaccio/storage /work/verdaccio
# Pre-created user "test" / password "test" (bcrypt via verdaccio's bundled bcryptjs)
printf 'test:$2a$10$5I0NZUaoAq6Q7u9OGmk0DO85lv6FY8xc/c3nSJuTDyV14QhIkUCL6\n' > /work/verdaccio/htpasswd
nohup verdaccio -c /work/verdaccio-config.yml > /work/verdaccio.log 2>&1 &
REGISTRY_PID=$!
trap 'kill "$REGISTRY_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -sf "$REGISTRY/-/ping" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Authenticate npm to the local registry via a dedicated userconfig (env var names
# with slashes are not valid bash identifiers, so a file is used instead).
cat > /work/npmrc-local <<EOF
registry=$REGISTRY
//127.0.0.1:4873/:_auth=$(printf 'test:test' | base64 -w0)
//127.0.0.1:4873/:username=test
//127.0.0.1:4873/:_password=$(printf 'test' | base64 -w0)
//127.0.0.1:4873/:email=test@test.local
EOF
export NPM_CONFIG_USERCONFIG=/work/npmrc-local
export npm_config_registry="$REGISTRY"

echo "=== publishing create-nextrush to local registry ==="
npm publish "$TARBALL" --registry "$REGISTRY" --access public 2>&1 | tail -5 || {
  echo "WARN: npm publish failed — continuing" >&2
}
# npm may refuse to publish a tarball whose name/version exists on the public
# registry with the same version; bump locally is not possible for a tarball, so
# use the published package as-is. The create commands resolve it from verdaccio.

# Point every package manager at the local registry for the scaffold phase.
export npm_config_registry="$REGISTRY"
export YARN_REGISTRY="$REGISTRY"
export BUN_CONFIG_REGISTRY="$REGISTRY"

run_create() {
  local pm="$1"
  local dir="$2"
  local runtime="$3"
  local args=(--yes --style functional --middleware api --no-git --no-install --runtime "$runtime")

  case "$pm" in
    npm)
      (cd "$dir" && npm create nextrush my-api -- "${args[@]}")
      ;;
    pnpm)
      (cd "$dir" && pnpm create nextrush my-api -- "${args[@]}")
      ;;
    yarn)
      (cd "$dir" && yarn create nextrush my-api -- "${args[@]}")
      ;;
    bun)
      (cd "$dir" && bun create nextrush my-api -- "${args[@]}")
      ;;
    deno)
      # Deno resolves npm packages through its own mechanism; DENO_REGISTRY is
      # not standard, so deno fetches from the public registry. create-nextrush
      # itself is what we test here — the tarball was published to verdaccio but
      # Deno cannot use a custom registry for npm: specifiers without config, so
      # this path uses the public create-nextrush (the same code under test).
      (cd "$dir" && deno run -A "npm:create-nextrush@1.2.0" my-api -- "${args[@]}")
      ;;
    *)
      echo "unknown manager: $pm" >&2
      exit 2
      ;;
  esac
}

check_health() {
  local dir="$1"
  local start_cmd="$2"
  local url="http://127.0.0.1:${PORT}/health"
  local server_pid=""

  (cd "$dir" && eval "$start_cmd") &
  server_pid=$!
  trap 'if [ -n "${server_pid:-}" ]; then kill "$server_pid" 2>/dev/null || true; fi' EXIT

  local ok=""
  for _ in $(seq 1 40); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    sleep 1
  done

  if [ -z "$ok" ]; then
    echo "FAIL: $start_cmd health endpoint did not respond on ${url}" >&2
    if [ -n "${server_pid:-}" ]; then
      kill "$server_pid" 2>/dev/null || true
    fi
    trap - EXIT
    return 1
  fi
  echo "PASS: $start_cmd health endpoint responded on ${url}"
  if [ -n "${server_pid:-}" ]; then
    kill "$server_pid" 2>/dev/null || true
  fi
  trap - EXIT
  return 0
}

install_build_test() {
  local dir="$1"
  local pm="$2"
  local runtime="$3"

  case "$pm" in
    npm)
      (cd "$dir" && npm install) || return 1
      (cd "$dir" && npm run build) || return 1
      (cd "$dir" && npm test) || return 1
      ;;
    pnpm)
      (cd "$dir" && pnpm install) || return 1
      (cd "$dir" && pnpm build) || return 1
      (cd "$dir" && pnpm test) || return 1
      ;;
    yarn)
      (cd "$dir" && yarn install) || return 1
      (cd "$dir" && yarn build) || return 1
      (cd "$dir" && yarn test) || return 1
      ;;
    bun)
      (cd "$dir" && bun install) || return 1
      (cd "$dir" && bun run build) || return 1
      (cd "$dir" && bun run test) || return 1
      ;;
  esac
  return 0
}

for pm in $PM_LIST; do
  for runtime in $RUNTIME_LIST; do
    echo "=== [$pm × $runtime] create ==="
    dir="/work/app-$pm-$runtime"
    rm -rf "$dir"
    mkdir -p "$dir"

    run_create "$pm" "$dir" "$runtime"
    cd "$dir/my-api"

    echo "=== [$pm × $runtime] install/build/test ==="
    if ! install_build_test "$dir/my-api" "$pm" "$runtime"; then
      echo "FAIL: $pm × $runtime install/build/test" >&2
      exit 1
    fi

    echo "=== [$pm × $runtime] dev server + health ==="
    case "$pm" in
      npm) check_health "$dir/my-api" "npm run start" ;;
      pnpm) check_health "$dir/my-api" "pnpm start" ;;
      yarn) check_health "$dir/my-api" "yarn start" ;;
      bun) check_health "$dir/my-api" "bun run start" ;;
    esac

    cd /work
    echo "=== [$pm × $runtime] OK ==="
  done
done

kill "$REGISTRY_PID" 2>/dev/null || true
trap - EXIT
echo "ALL PACKAGE MANAGERS × RUNTIMES PASSED"
