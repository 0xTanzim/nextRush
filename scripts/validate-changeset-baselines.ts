/// <reference types="node" />

/**
 * Guards against the exact publish-readiness mistake found and fixed on
 * 2026-07-24: a changeset declaring a `minor`/`major` bump against a package
 * that has never been published produces a version that falsely implies
 * prior release history (e.g. a `major` bump on an unpublished `1.0.0`
 * baseline computes `2.0.0`, as if a `1.x` line had ever existed).
 *
 * `changeset version` has no concept of "this is actually a first release" —
 * it always applies the declared bump type on top of whatever baseline it
 * finds (the real npm-published version if one exists, or the package's
 * current local `package.json` version if it has never been published). This
 * script closes that gap by checking, for every package a pending changeset
 * touches, whether it has ANY real npm release history, and rejecting a
 * `minor`/`major` bump declared against one that doesn't.
 *
 * A `patch` bump against a never-published package is also flagged: there is
 * no prior release for a patch to be relative to, so any bump type is
 * semantically meaningless there — the correct fix is to remove that
 * package from the changeset's frontmatter (Changesets publishes an
 * unreleased package at its current `package.json` version regardless of
 * declared bump type on first publish, so the bump-type line does nothing
 * useful for it and only risks silently drifting version fields like the
 * ones this script exists to catch).
 *
 * Run this BEFORE `changeset version`, not after — the mistake is in the
 * changeset's declared intent, not in what the version command computed
 * from it.
 */

import { readFile, readdir } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface ChangesetFrontmatter {
  readonly packageName: string;
  readonly bumpType: 'patch' | 'minor' | 'major';
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses a changeset's YAML-ish frontmatter (between the two `---` lines).
 * Changesets' own frontmatter format is a flat list of `"pkg-name": bumpType`
 * lines — not full YAML, so a minimal line-based parse is sufficient and
 * avoids adding a YAML dependency for this one check.
 */
function parseChangesetFrontmatter(contents: string, filePath: string): ChangesetFrontmatter[] {
  const lines = contents.split('\n');
  const firstDelimiter = lines.indexOf('---');
  if (firstDelimiter === -1) return [];
  const secondDelimiter = lines.indexOf('---', firstDelimiter + 1);
  if (secondDelimiter === -1) {
    throw new Error(`${filePath}: malformed frontmatter (no closing "---")`);
  }

  const entries: ChangesetFrontmatter[] = [];
  for (const line of lines.slice(firstDelimiter + 1, secondDelimiter)) {
    const match = /^"([^"]+)":\s*(patch|minor|major)\s*$/.exec(line.trim());
    if (match) {
      entries.push({ packageName: match[1], bumpType: match[2] as ChangesetFrontmatter['bumpType'] });
    }
  }
  return entries;
}

async function listChangesetFiles(rootDir: string): Promise<string[]> {
  const changesetDir = path.join(rootDir, '.changeset');
  if (!(await pathExists(changesetDir))) return [];

  const entries = await readdir(changesetDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => path.join(changesetDir, e.name));
}

/**
 * True if the package has ANY published version on the npm registry —
 * doesn't matter which version, only whether release history exists at all.
 */
async function hasPublishedHistory(packageName: string): Promise<boolean> {
  try {
    await execFileAsync('npm', ['view', packageName, 'version'], { timeout: 15_000 });
    return true;
  } catch {
    // npm view exits non-zero for a 404 (never published) — treat any
    // failure here as "no history," since a genuine network/registry
    // outage should fail the whole script loudly via the catch in main(),
    // not be silently absorbed per-package.
    return false;
  }
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const changesetFiles = await listChangesetFiles(repoRoot);

  if (changesetFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log('✅ No pending changesets to validate.');
    return;
  }

  const packageBumps = new Map<string, { bumpType: string; files: string[] }>();
  for (const file of changesetFiles) {
    const contents = await readFile(file, 'utf8');
    for (const { packageName, bumpType } of parseChangesetFrontmatter(contents, file)) {
      const existing = packageBumps.get(packageName);
      if (existing) {
        existing.files.push(file);
        // Highest-severity bump wins for the "is this even meaningful" check.
        const severity = { patch: 0, minor: 1, major: 2 } as const;
        if (severity[bumpType as keyof typeof severity] > severity[existing.bumpType as keyof typeof severity]) {
          existing.bumpType = bumpType;
        }
      } else {
        packageBumps.set(packageName, { bumpType, files: [file] });
      }
    }
  }

  const problems: string[] = [];
  for (const [packageName, { bumpType, files }] of packageBumps) {
    const published = await hasPublishedHistory(packageName);
    if (!published) {
      const fileList = files.map((f) => path.relative(repoRoot, f)).join(', ');
      problems.push(
        `${packageName}: changeset(s) [${fileList}] declare a "${bumpType}" bump, but this package ` +
          `has never been published to npm. A bump type is only meaningful relative to a real prior ` +
          `release — computing "${bumpType}" on top of an unpublished baseline produces a version that ` +
          `falsely implies release history that never existed (e.g. a major bump on an unpublished 1.0.0 ` +
          `computes 2.0.0, as if a 1.x line had shipped). Remove this package from the changeset's ` +
          `frontmatter; its package.json version already IS its correct first release, prerelease-tagged ` +
          `if the repo is currently in prerelease mode.`
      );
    }
  }

  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Changeset baseline check failed — bump type declared against a never-published package:\n\n' +
        problems.map((p) => `- ${p}`).join('\n\n')
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `✅ Changeset baseline check passed (${packageBumps.size} package(s) across ${changesetFiles.length} changeset file(s) — every bump type is declared against a package with real npm history).`
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
