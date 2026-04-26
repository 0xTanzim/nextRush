#!/usr/bin/env bash
# Update all dependencies to latest across the entire monorepo (root + all workspace packages)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "📦 Updating root dependencies to latest..."
pnpm update --latest

echo ""
echo "📦 Updating ALL workspace packages to latest..."
pnpm --recursive update --latest

echo ""
echo "✅ All packages updated to latest versions."
echo ""
echo "🔧 Reinstalling with fresh lockfile..."
pnpm install

echo ""
echo "✅ Done! All dependencies across the monorepo are up to date."
