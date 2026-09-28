#!/usr/bin/env node
/**
 * ensure-swc-node-ts6.mjs — self-heal + CI guard for the @swc-node/register ↔ TypeScript
 * pairing (RFC-037, discovered 2026-09-28).
 *
 * `@swc-node/register` (the `nextrush dev` TypeScript loader — kept because SWC emits
 * `emitDecoratorMetadata`, which DI constructor injection requires) declares
 * `peerDependencies.typescript: ">= 4.3 < 7"` and uses 21 TypeScript JS APIs at runtime
 * (`ts.Extension`, `ts.sys`, `ts.readConfigFile`, …). TypeScript 7's main entry exposes
 * only `version`/`versionMajorMinor` — the API moved — so pairing the register with
 * TypeScript 7 crashes it at module init:
 * `TypeError: Cannot read properties of undefined (reading 'Js')`.
 *
 * The workspace pins it in `pnpm-workspace.yaml`:
 *     overrides:
 *       '@swc-node/register>typescript': '6.0.3'
 *
 * pnpm 12.6.0 applies that override at the *spec* level (`pnpm peers check` reports
 * `Wanted: 6.0.3`) but still *binds* the peer from the dependent's own context
 * (`typescript@7.0.2`) — the known "override not applied to peer deps on version
 * mismatch" class (pnpm/pnpm#9913, pnpm/pnpm#12345). `pnpm update` re-resolves the
 * graph and re-introduces it (observed: it clobbered a corrected lockfile).
 *
 * This script restores the two facts the override intends:
 *   1. the lockfile importer binding + variant key + snapshot dep pin `typescript@6.0.3`;
 *   2. the installed variant's `node_modules/typescript` symlink points at the
 *      `typescript@6.0.3` store package.
 *
 * Modes:
 *   - repair (default): rewrite whatever is wrong. Runs from the root `postinstall` and
 *     from `scripts/update-all.sh`.
 *   - `--check`: report-only, exit 1 on drift. Wired into the root `verify` chain so a
 *     clobbered state can never pass CI silently.
 *
 * No network, no pnpm child processes — pure file/symlink inspection, postinstall-safe.
 */
import { existsSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = join(ROOT, 'pnpm-lock.yaml');
const DEV_REGISTER_LINK = join(ROOT, 'packages/dev/node_modules/@swc-node/register');
const TS6_TARGET = '../../typescript@6.0.3/node_modules/typescript';
const WANTED = '6.0.3';

const checkOnly = process.argv.includes('--check');
const problems = [];
const repairs = [];

/* ── 1. Lockfile: importer binding, variant key, snapshot dependency ─────────── */

const lines = readFileSync(LOCKFILE, 'utf8').split('\n');
let inSwcSnapshot = false;
let expectingImporterVersion = false;
const swap = (s) => s.replace(/\(typescript@[0-9][^)]*\)/g, `(typescript@${WANTED})`);

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];

  if (/^\s*'@swc-node\/register':\s*$/.test(line)) {
    expectingImporterVersion = true;
    continue;
  }
  if (expectingImporterVersion && /^\s*version:/.test(line)) {
    expectingImporterVersion = false;
    const fixed = swap(line);
    if (fixed !== line) {
      if (checkOnly) problems.push(`pnpm-lock.yaml:${i + 1} importer binding: ${line.trim()}`);
      else {
        lines[i] = fixed;
        repairs.push(`pnpm-lock.yaml:${i + 1} importer binding → typescript@${WANTED}`);
      }
    }
    continue;
  }

  // Variant key line: `'@swc-node/register@<ver>(<peers>)':`
  if (line.includes("'@swc-node/register@")) {
    inSwcSnapshot = /^\s*'[^\s]+':\s*$/.test(line);
    const fixed = swap(line);
    if (fixed !== line) {
      if (checkOnly) problems.push(`pnpm-lock.yaml:${i + 1} variant key: ${line.trim()}`);
      else {
        lines[i] = fixed;
        repairs.push(`pnpm-lock.yaml:${i + 1} variant key → typescript@${WANTED}`);
      }
    }
    continue;
  }

  // Inside that snapshot: resolved `typescript:` dependency line; block ends at next
  // 2-space-indent key.
  if (inSwcSnapshot) {
    if (/^\s{2}\S/.test(line)) {
      inSwcSnapshot = false;
    } else if (/^\s+typescript:\s/.test(line)) {
      const fixed = line.replace(/typescript:\s*[0-9][^\s]*/, `typescript: ${WANTED}`);
      if (fixed !== line) {
        if (checkOnly) problems.push(`pnpm-lock.yaml:${i + 1} snapshot dep: ${line.trim()}`);
        else {
          lines[i] = fixed;
          repairs.push(`pnpm-lock.yaml:${i + 1} snapshot dependency → typescript@${WANTED}`);
        }
      }
    }
  }
}

if (!checkOnly && repairs.some((r) => r.startsWith('pnpm-lock.yaml'))) {
  writeFileSync(LOCKFILE, `${lines.join('\n')}`);
}

/* ── 2. Installed variant: node_modules/typescript symlink ───────────────────── */

let linkTarget = null;
try {
  linkTarget = realpathSync(DEV_REGISTER_LINK);
} catch {
  problems.push(`${DEV_REGISTER_LINK}: missing (run \`pnpm install\`)`);
}

if (linkTarget) {
  // linkTarget = <variant>/node_modules/@swc-node/register → sibling at <variant>/node_modules
  const variantNodeModules = dirname(dirname(linkTarget));
  const tsLink = join(variantNodeModules, 'typescript');
  const store6 = join(ROOT, 'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript');

  let current = null;
  try {
    current = readlinkSync(tsLink);
  } catch {
    problems.push(`${tsLink}: symlink missing`);
  }

  if (current !== null && !current.includes('typescript@6.0.3')) {
    if (checkOnly) {
      problems.push(`${tsLink}: → ${current} (expected typescript@6.0.3)`);
    } else if (!existsSync(store6)) {
      problems.push(`cannot repair: ${store6} missing (typescript 6.0.3 left the workspace?)`);
    } else {
      rmSync(tsLink, { force: true });
      symlinkSync(TS6_TARGET, tsLink);
      repairs.push(`${tsLink} → ${TS6_TARGET}`);
    }
  }
}

/* ── 3. Functional probe: what does swc-node actually resolve? ───────────────── */

if (linkTarget) {
  const { createRequire } = await import('node:module');
  const regRequire = createRequire(join(linkTarget, 'package.json'));
  try {
    const ts = regRequire('typescript');
    if (ts.version !== WANTED || typeof ts.Extension === 'undefined') {
      problems.push(
        `swc-node resolves typescript ${ts.version} (Extension: ${typeof ts.Extension}) — expected ${WANTED} with a working API`
      );
    }
  } catch (err) {
    problems.push(`probe failed: ${err.message}`);
  }
}

/* ── Report ──────────────────────────────────────────────────────────────────── */

if (checkOnly) {
  if (problems.length > 0) {
    console.error('ensure-swc-node-ts6 --check FAILED:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('  fix: `node scripts/ensure-swc-node-ts6.mjs` (runs automatically on postinstall)');
    process.exit(1);
  }
  console.log('ensure-swc-node-ts6: OK (typescript@6.0.3 bound to @swc-node/register)');
} else {
  for (const r of repairs) console.log(`ensure-swc-node-ts6: repaired ${r}`);
  if (problems.length > 0) {
    console.error('ensure-swc-node-ts6: UNRECOVERABLE:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  if (repairs.length === 0) console.log('ensure-swc-node-ts6: OK (no repair needed)');
}

