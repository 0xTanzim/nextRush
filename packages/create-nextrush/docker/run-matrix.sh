#!/usr/bin/env bash
set -euo pipefail

# Runs the create-nextrush published-artifact matrix in Docker (task 5.3).
# Expects `create-nextrush.tgz` to already be packed into this directory
# (the CI job packs it; locally: `pnpm --filter create-nextrush pack`).
#
# Retains the generated projects and per-cell logs under ./artifacts on failure.

cd "$(dirname "$0")"

if [ ! -f create-nextrush.tgz ]; then
  echo "create-nextrush.tgz not found — pack it first:" >&2
  echo "  pnpm --filter create-nextrush pack --pack-destination docker" >&2
  exit 2
fi

docker build -t create-nextrush-matrix -f Dockerfile.matrix .
mkdir -p artifacts
docker run --rm -v "$(pwd)/artifacts:/work/artifacts" create-nextrush-matrix /work/create-nextrush.tgz
