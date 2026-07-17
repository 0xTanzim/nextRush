/**
 * TypeScript file discovery and scanning
 *
 * Discovers TypeScript files (.ts, .tsx, .mts, .cts) while excluding
 * declaration files, tests, and specs. Returns files with their source
 * extensions intact for proper mapping to output.
 */

import { resolvePath } from '../../runtime/index.js';
import { NODE_FS_PROMISES, NODE_PATH } from '../../runtime/node-modules.js';

export interface TypeScriptFile {
  path: string;
  ext: '.ts' | '.tsx' | '.mts' | '.cts';
}

/**
 * Map source extension to output extension
 * .ts/.tsx → .js
 * .mts → .mjs
 * .cts → .cjs
 */
export function mapExtension(ext: '.ts' | '.tsx' | '.mts' | '.cts'): '.js' | '.mjs' | '.cjs' {
  if (ext === '.mts') return '.mjs';
  if (ext === '.cts') return '.cjs';
  return '.js'; // .ts and .tsx both map to .js
}

export async function findTypeScriptFiles(cwd: string, entry: string): Promise<TypeScriptFile[]> {
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  const path = await import(/* @vite-ignore */ NODE_PATH);

  const files: TypeScriptFile[] = [];
  const entryDir = path.dirname(resolvePath(cwd, entry));

  // Workspace-aware scoping (spec: dev-workspace-build-scoping). The scan root is resolved
  // to the nearest enclosing `package.json` directory, walking upward from the entry's own
  // directory. This is the package boundary: the scan never ascends above it (there is no
  // upward-recursion path once scanning starts), and a nested subdirectory with its own
  // `package.json` is excluded during the downward scan (see `hasPackageJson` below). When
  // no `package.json` exists anywhere above entryDir, this falls back to the prior
  // behavior — entryDir itself as the scan root.
  const boundary = await findPackageBoundary(fs, path, entryDir);
  const scanRoot = boundary ?? entryDir;

  async function scanDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories.
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        // A subdirectory with its own package.json is a separate package — never
        // descend into it. This is what keeps a nested workspace package (vendored
        // or otherwise) out of the current package's build output. The scan root
        // itself is exempt from this check (it legitimately owns the package.json
        // that defined the boundary in the first place).
        if (fullPath !== scanRoot && (await hasPackageJson(fs, path, fullPath))) {
          continue;
        }
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        // Check for TypeScript source files (not declarations or tests)
        const name = entry.name;
        if (name.endsWith('.d.ts') || name.endsWith('.test.ts') || name.endsWith('.spec.ts') ||
            name.endsWith('.test.tsx') || name.endsWith('.spec.tsx') ||
            name.endsWith('.test.mts') || name.endsWith('.spec.mts') ||
            name.endsWith('.test.cts') || name.endsWith('.spec.cts')) {
          continue;
        }

        // Match .ts, .tsx, .mts, .cts
        if (name.endsWith('.ts')) {
          files.push({ path: fullPath, ext: '.ts' });
        } else if (name.endsWith('.tsx')) {
          files.push({ path: fullPath, ext: '.tsx' });
        } else if (name.endsWith('.mts')) {
          files.push({ path: fullPath, ext: '.mts' });
        } else if (name.endsWith('.cts')) {
          files.push({ path: fullPath, ext: '.cts' });
        }
      }
    }
  }

  await scanDir(scanRoot);
  return files;
}

/**
 * Check whether `dir` directly contains a `package.json` file.
 *
 * Used by {@link findTypeScriptFiles} to exclude nested workspace packages from the
 * current package's build scan (spec: dev-workspace-build-scoping).
 */
async function hasPackageJson(
  fs: typeof import('node:fs/promises'),
  path: typeof import('node:path'),
  dir: string
): Promise<boolean> {
  try {
    await fs.access(path.join(dir, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the nearest enclosing `package.json` directory for `startDir`, walking upward
 * from `startDir` itself. Returns `null` when no `package.json` is found before reaching
 * the filesystem root — {@link findTypeScriptFiles} falls back to the prior
 * `entryDir`-rooted scan in that case.
 *
 * This directory becomes the scan root; the build never ascends above it.
 */
async function findPackageBoundary(
  fs: typeof import('node:fs/promises'),
  path: typeof import('node:path'),
  startDir: string
): Promise<string | null> {
  let dir = startDir;
  for (;;) {
    if (await hasPackageJson(fs, path, dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached the filesystem root without finding a package.json.
      return null;
    }
    dir = parent;
  }
}
