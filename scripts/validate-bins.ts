/// <reference types="node" />

import { constants as fsConstants } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

type PackageJson = {
  readonly name?: string;
  readonly bin?: unknown;
  readonly files?: readonly string[];
};

async function pathExists(filePath: string, mode = fsConstants.F_OK): Promise<boolean> {
  try {
    await access(filePath, mode);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

function parsePackageJson(contents: string, pkgJsonPath: string): PackageJson {
  try {
    return JSON.parse(contents) as PackageJson;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid package.json at ${pkgJsonPath}: ${message}`);
  }
}

async function listPackageJsonFiles(rootDir: string): Promise<string[]> {
  const packagesDir = path.join(rootDir, 'packages');

  const work: string[] = [packagesDir];
  const results: string[] = [];

  while (work.length > 0) {
    const current = work.pop();
    if (!current) break;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dir = path.join(current, entry.name);
      const pkgJsonPath = path.join(dir, 'package.json');

      if (await pathExists(pkgJsonPath)) {
        results.push(pkgJsonPath);
      } else {
        work.push(dir);
      }
    }
  }

  return results;
}

function normalizeBinMap(bin: PackageJson['bin'], packageName: string): {
  readonly binMap: Record<string, string>;
  readonly problems: string[];
} {
  const problems: string[] = [];

  if (!bin) return { binMap: {}, problems };

  if (typeof bin === 'string') {
    return { binMap: { [packageName]: bin }, problems };
  }

  if (typeof bin !== 'object' || Array.isArray(bin)) {
    return {
      binMap: {},
      problems: [`${packageName}: bin must be a string or object map`],
    };
  }

  const binMap: Record<string, string> = {};
  for (const [binName, relPath] of Object.entries(bin)) {
    if (typeof relPath !== 'string' || relPath.trim() === '') {
      problems.push(`${packageName}: bin '${binName}' must point to a non-empty string path`);
      continue;
    }

    binMap[binName] = relPath;
  }

  return { binMap, problems };
}

function normalizePackagePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function isPublishedByFiles(relPath: string, files: readonly string[] | undefined): boolean {
  if (!files) return true;

  const normalizedRelPath = normalizePackagePath(relPath);
  return files.some((entry) => {
    const normalizedEntry = normalizePackagePath(entry);
    return normalizedRelPath === normalizedEntry || normalizedRelPath.startsWith(`${normalizedEntry}/`);
  });
}

async function validateOnePackage(pkgJsonPath: string): Promise<string[]> {
  const pkgDir = path.dirname(pkgJsonPath);
  const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);

  const problems: string[] = [];
  const packageName = pkg.name ?? '(unknown)';
  const { binMap, problems: binProblems } = normalizeBinMap(pkg.bin, packageName);
  problems.push(...binProblems);

  for (const [binName, relPath] of Object.entries(binMap)) {
    if (path.isAbsolute(relPath)) {
      problems.push(`${packageName}: bin '${binName}' must use a relative path: ${relPath}`);
      continue;
    }

    const absolute = path.resolve(pkgDir, relPath);
    const relativeFromPackage = path.relative(pkgDir, absolute);

    if (relativeFromPackage.startsWith('..') || path.isAbsolute(relativeFromPackage)) {
      problems.push(`${packageName}: bin '${binName}' points outside the package: ${relPath}`);
      continue;
    }

    if (!isPublishedByFiles(relPath, pkg.files)) {
      problems.push(
        `${packageName}: bin '${binName}' (${relPath}) is not included by package.json files`
      );
    }

    if (!(await pathExists(absolute))) {
      problems.push(
        `${packageName}: bin '${binName}' points to missing file: ${relPath}`
      );
      continue;
    }

    // Basic sanity: JS bins should be executable via shebang.
    if (absolute.endsWith('.js')) {
      const firstLine = (await readFile(absolute, 'utf8')).split('\n')[0] ?? '';
      if (!firstLine.startsWith('#!')) {
        problems.push(
          `${packageName}: bin '${binName}' (${relPath}) missing shebang (#!/...)`
        );
      }

      if (!(await pathExists(absolute, fsConstants.X_OK))) {
        problems.push(`${packageName}: bin '${binName}' (${relPath}) is not executable`);
      }
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const packageJsonFiles = await listPackageJsonFiles(repoRoot);

  const allProblems: string[] = [];
  for (const pkgJsonPath of packageJsonFiles) {
    allProblems.push(...(await validateOnePackage(pkgJsonPath)));
  }

  if (allProblems.length > 0) {
    // eslint-disable-next-line no-console
    console.error('❌ Bin validation failed:\n' + allProblems.map((p) => `- ${p}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log('✅ Bin validation passed');
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
