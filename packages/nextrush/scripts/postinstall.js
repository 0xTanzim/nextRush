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
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function shouldSkip() {
  if (process.env.CI) return true;
  if (process.env.NEXTRUSH_SKIP_POSTINSTALL === '1') return true;
  return false;
}

/**
 * Whether to auto-install `@nextrush/dev` by spawning a package manager.
 *
 * @remarks
 * OFF by default. Running `pnpm add`/`npm install` from a postinstall hook is a
 * recognized anti-pattern — it can hang behind proxies, fail in restricted CI,
 * or surprise users by mutating their lockfile. The safe default is to print a
 * one-line notice (see {@link printDevNotice}); auto-install is strictly opt-in
 * via `NEXTRUSH_AUTO_INSTALL_DEV=1`.
 */
export function shouldAutoInstall() {
  return process.env.NEXTRUSH_AUTO_INSTALL_DEV === '1';
}

/**
 * True when this script is running inside the NextRush monorepo source tree
 * itself (i.e. during the framework's own `pnpm install`), rather than in an
 * end user's project.
 *
 * @remarks
 * Critical guard: inside the monorepo, `@nextrush/dev` is already a workspace
 * package. Running `pnpm add -D @nextrush/dev` here re-triggers the workspace
 * install lifecycle, which runs this postinstall again → infinite recursion of
 * nested pnpm/node processes (memory exhaustion). Detected by walking up for a
 * `package.json` named `nextrush-monorepo`.
 */
export function isMonorepo() {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    // Walk up to the filesystem root looking for the monorepo marker.
    for (let i = 0; i < 20; i++) {
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg && pkg.name === 'nextrush-monorepo') return true;
      }
      const parent = dirname(dir);
      if (parent === dir) break; // reached filesystem root
      dir = parent;
    }
  } catch {
    // If detection fails for any reason, fall through — the re-entrancy env
    // guard in installDevPackage() is the hard backstop against recursion.
  }
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
    // Re-entrancy backstop: the child install must never re-run this postinstall,
    // or it recurses infinitely. Forcing NEXTRUSH_SKIP_POSTINSTALL=1 in the child
    // environment guarantees shouldSkip() short-circuits any nested invocation.
    execSync(cmd, {
      stdio: 'inherit',
      env: { ...process.env, NEXTRUSH_SKIP_POSTINSTALL: '1' },
    });
    console.log('[nextrush] @nextrush/dev installed successfully.');
    return true;
  } catch {
    console.warn('[nextrush] Warning: Failed to auto-install @nextrush/dev.');
    console.warn(`[nextrush] Run manually: ${cmd}`);
    return false;
  }
}

/**
 * Print a non-destructive, one-time notice telling the user how to install the
 * optional dev CLI. This is the DEFAULT behavior — it spawns no process and
 * mutates nothing.
 */
export function printDevNotice(packageManager) {
  const cmd = getInstallCommand(packageManager);
  console.log(
    '\n[nextrush] Optional: install the dev server & build CLI (@nextrush/dev):\n' +
      `           ${cmd}\n` +
      '           (set NEXTRUSH_AUTO_INSTALL_DEV=1 to install it automatically)',
  );
}

// Only run when executed directly (not imported for testing)
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('postinstall.js') || process.argv[1].endsWith('postinstall'));

if (isMainModule) {
  if (shouldSkip()) {
    process.exit(0);
  }

  // Never self-install inside the framework's own monorepo — that recurses.
  if (isMonorepo()) {
    process.exit(0);
  }

  if (isDevInstalled()) {
    process.exit(0);
  }

  const pm = detectPackageManager();
  // Safe default: advise, don't spawn. Auto-install is strictly opt-in.
  if (shouldAutoInstall()) {
    const success = installDevPackage(pm);
    process.exit(success ? 0 : 0); // Never fail the parent install.
  }
  printDevNotice(pm);
  process.exit(0);
}
