#!/usr/bin/env bash
# Full fresh install: clean all node_modules, update all deps to latest, reinstall
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "========================================="
echo "  NextRush: Full Clean + Update"
echo "========================================="
echo ""

# Step 1: Remove all node_modules
echo "Step 1/4: Removing all node_modules..."
bash "$ROOT_DIR/scripts/clean-modules.sh"
echo ""

# Step 2: Remove lockfile for fresh resolve
echo "Step 2/4: Removing pnpm-lock.yaml..."
rm -f pnpm-lock.yaml
echo "✅ Lockfile removed."
echo ""

# Step 3: Fresh install
echo "Step 3/4: Fresh install..."
pnpm install
echo ""

# Step 4: Update all to latest
echo "Step 4/4: Updating all packages to latest..."
pnpm update --latest
pnpm --recursive update --latest
echo ""

echo "========================================="
echo "  ✅ All done! Everything is up to date."
echo "========================================="
