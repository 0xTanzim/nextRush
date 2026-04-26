#!/usr/bin/env bash
# Recursively find and remove all node_modules directories in the monorepo
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔍 Searching for node_modules directories in $ROOT_DIR ..."

DIRS=$(find "$ROOT_DIR" -type d -name node_modules -prune 2>/dev/null)

if [ -z "$DIRS" ]; then
  echo "✅ No node_modules directories found."
  exit 0
fi

COUNT=$(echo "$DIRS" | wc -l)
echo "Found $COUNT node_modules directories:"
echo "$DIRS" | while read -r d; do echo "  - ${d#"$ROOT_DIR"/}"; done

echo ""
echo "🗑️  Removing all node_modules..."
echo "$DIRS" | while read -r d; do rm -rf "$d"; done

echo "✅ All node_modules removed."
