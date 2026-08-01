import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findDependencyPeerConflicts,
  findInstallLifecycleScripts,
  listPackageJsonFiles,
  parsePackageJson,
  validateOnePackage,
  type PackageJson,
} from '../validate-manifest-composition.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

describe('findDependencyPeerConflicts', () => {
  it('flags a package declared as both a dependency and a required peer', () => {
    const pkg: PackageJson = {
      name: 'fixture',
      dependencies: { '@nextrush/core': 'workspace:*' },
      peerDependencies: { '@nextrush/core': 'workspace:*' },
    };
    expect(findDependencyPeerConflicts(pkg)).toEqual(['@nextrush/core']);
  });

  it('does not flag a dependency-only or peer-only declaration', () => {
    const pkg: PackageJson = {
      name: 'fixture',
      dependencies: { '@nextrush/core': 'workspace:*' },
      peerDependencies: { '@nextrush/router': 'workspace:*' },
    };
    expect(findDependencyPeerConflicts(pkg)).toEqual([]);
  });

  it('does not flag a dependency also declared as an OPTIONAL peer', () => {
    const pkg: PackageJson = {
      name: 'fixture',
      dependencies: { '@nextrush/class': 'workspace:*' },
      peerDependencies: { '@nextrush/class': 'workspace:*' },
      peerDependenciesMeta: { '@nextrush/class': { optional: true } },
    };
    expect(findDependencyPeerConflicts(pkg)).toEqual([]);
  });
});

describe('findInstallLifecycleScripts', () => {
  it('flags postinstall/preinstall/install scripts', () => {
    const pkg: PackageJson = { name: 'fixture', scripts: { postinstall: 'node x.js' } };
    expect(findInstallLifecycleScripts(pkg)).toEqual(['postinstall']);
  });

  it('does not flag ordinary scripts', () => {
    const pkg: PackageJson = { name: 'fixture', scripts: { build: 'tsup', test: 'vitest run' } };
    expect(findInstallLifecycleScripts(pkg)).toEqual([]);
  });
});

describe('canonical manifest shape — real workspace packages (fixed by tasks 2.2, 2.6, 3.2)', () => {
  it('@nextrush/class no longer double-declares core+router as dependency and required peer', async () => {
    const pkgJsonPath = path.join(repoRoot, 'packages/class/package.json');
    const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);
    // Fixed by task 2.2: the redundant peerDependencies entries were dropped, keeping
    // @nextrush/core/@nextrush/router as plain (non-peer) dependencies only.
    expect(findDependencyPeerConflicts(pkg)).toEqual([]);
  });

  it('nextrush no longer declares a postinstall lifecycle script', async () => {
    const pkgJsonPath = path.join(repoRoot, 'packages/nextrush/package.json');
    const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);
    // Fixed by task 3.2: the install-time hook was removed entirely.
    expect(findInstallLifecycleScripts(pkg)).toEqual([]);
  });

  it('every publishable workspace package is free of manifest violations', async () => {
    const files = await listPackageJsonFiles(repoRoot);
    expect(files.length).toBeGreaterThan(0);

    const allProblems: string[] = [];
    for (const file of files) {
      allProblems.push(...(await validateOnePackage(file)));
    }

    // GREEN target for this whole suite (tasks 2.2, 2.6, 3.2): zero problems across every
    // publishable package.
    expect(allProblems).toEqual([]);
  });
});

describe('nextrush meta-package bin launcher shape (dev-cli-discoverability — ADR-0013)', () => {
  type MetaPkg = {
    readonly bin?: Record<string, string>;
    readonly files?: readonly string[];
    readonly scripts?: Record<string, string>;
  };

  async function readMetaPkg(): Promise<MetaPkg> {
    const pkgJsonPath = path.join(repoRoot, 'packages/nextrush/package.json');
    return parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath) as MetaPkg;
  }

  it('declares a nextrush bin pointing to a file inside the published files allow-list', async () => {
    const pkg = await readMetaPkg();

    const binTarget = pkg.bin?.nextrush;
    expect(binTarget).toBe('./bin/nextrush.js');

    // The bin's top-level directory must be shipped, or the published package has a broken bin.
    const topDir = (binTarget ?? '').replace(/^\.\//, '').split('/')[0];
    expect(pkg.files ?? []).toContain(topDir);
  });

  it('does not wire the bin to any install-lifecycle script (no install-time execution)', async () => {
    const pkg = await readMetaPkg();
    // The first-ever bin field must not reopen the install-time-execution hole RFC-020 closed.
    expect(findInstallLifecycleScripts(pkg)).toEqual([]);
  });
});
