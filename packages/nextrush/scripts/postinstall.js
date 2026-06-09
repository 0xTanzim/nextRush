#!/usr/bin/env node

/**
 * nextrush postinstall script
 *
 * Automatically installs @nextrush/dev (dev server & build CLI) when
 * a user installs the `nextrush` meta package. This ensures `nextrush dev`
 * and `nextrush build` commands work out of the box.
 *
 * Skips installation when:
 * - Running in CI (process.env.CI is set)
 * - NEXTRUSH_SKIP_POSTINSTALL=1 is set
 * - @nextrush/dev is already resolvable
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

export function shouldSkip() {
  if (process.env.CI) return true;
  if (process.env.NEXTRUSH_SKIP_POSTINSTALL === '1') return true;
  return false;
}

export function isDevInstalled() {
  const require = createRequire(import.meta.url);
  try {
    require.resolve('@nextrush/dev');
    return true;
  } catch {
    return false;
  }
}

export function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent || '';

  if (userAgent.includes('pnpm')) return 'pnpm';
  if (userAgent.includes('yarn')) return 'yarn';
  if (userAgent.includes('bun')) return 'bun';
  return 'npm';
}

export function getInstallCommand(packageManager) {
  const cmds = {
    pnpm: 'pnpm add -D @nextrush/dev@latest',
    yarn: 'yarn add -D @nextrush/dev@latest',
    bun: 'bun add -D @nextrush/dev@latest',
    npm: 'npm install -D @nextrush/dev@latest',
  };
  return cmds[packageManager];
}

export function installDevPackage(packageManager) {
  const cmd = getInstallCommand(packageManager);
  console.log('\n[nextrush] Installing @nextrush/dev (dev server & build CLI)...');
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('[nextrush] @nextrush/dev installed successfully.');
    return true;
  } catch {
    console.warn('[nextrush] Warning: Failed to auto-install @nextrush/dev.');
    console.warn(`[nextrush] Run manually: ${cmd}`);
    return false;
  }
}

// Only run when executed directly (not imported for testing)
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('postinstall.js') || process.argv[1].endsWith('postinstall'));

if (isMainModule) {
  if (shouldSkip()) {
    process.exit(0);
  }

  if (isDevInstalled()) {
    process.exit(0);
  }

  const pm = detectPackageManager();
  const success = installDevPackage(pm);
  process.exit(success ? 0 : 0); // Don't fail the parent install
}
