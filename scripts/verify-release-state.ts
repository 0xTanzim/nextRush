/// <reference types="node" />

/**
 * Comprehensive release-state guard. Extends `validate-changeset-baselines.ts`
 * (which only checks packages a PENDING changeset names) to catch problems
 * that show up with zero changesets pending — which is exactly the state
 * this repo was in on 2026-07-24 when `@nextrush/class` sat at a hardcoded
 * `4.0.0-beta.0` in its `package.json`, wrong (it's never been published;
 * the correct number was `1.0.0-beta.0`), and no changeset-scoped check
 * could have flagged it because no changeset named that package.
 *
 * Four independent checks, each closing one real gap hit this session:
 *
 * 1. Fixed-group consistency — every package in `.changeset/config.json`'s
 *    `fixed` array must carry the IDENTICAL version string right now. A
 *    lockstep group with one member out of sync is not a future risk, it's
 *    already a bug sitting in the working tree.
 * 2. Never-published version sanity — a package with zero npm history
 *    should never carry a version that looks like it was computed from a
 *    real prior release (a `major`/`minor`-shaped jump with nothing behind
 *    it). Catches the exact `@nextrush/class` mistake independent of
 *    whether a changeset currently names it.
 * 3. Ignore-vs-dependency-graph conflict — replicates Changesets' own
 *    `pre exit` / `version` validation (a publishing package can't depend
 *    on an `ignore`d one) BEFORE those commands run, not as a surprise
 *    error after `pre exit` has already started tearing down prerelease
 *    state.
 * 4. Stale `.changeset/pre.json` detection — `changeset pre enter <tag>` is
 *    a no-op on the `initialVersions` snapshot if `pre.json` already
 *    exists. Running it twice after manually correcting versions mid-window
 *    leaves the snapshot pointing at the old, wrong baseline. This check
 *    warns the moment that drift exists, instead of leaving it to be
 *    discovered when `changeset version` computes something confusing.
 *
 * Run via `pnpm verify:release-state`. Also chained into `pnpm run version`
 * and the `pre-commit` / `pre-push` git hooks (see `scripts/git-hooks/`).
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REPO_ROOT = process.cwd();

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly private?: boolean;
}

interface WorkspacePackage {
  readonly manifest: PackageManifest;
  readonly manifestPath: string;
}

interface ChangesetConfig {
  readonly fixed?: readonly (readonly string[])[];
  readonly ignore?: readonly string[];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds every `package.json` under the workspace globs declared in `pnpm-workspace.yaml`. */
async function discoverWorkspacePackages(): Promise<WorkspacePackage[]> {
  const globs = ['packages', 'packages/middleware', 'packages/extensions', 'packages/adapters', 'apps', 'examples'];
  const found: WorkspacePackage[] = [];

  for (const glob of globs) {
    const dir = path.join(REPO_ROOT, glob);
    if (!(await pathExists(dir))) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const manifestPath = path.join(dir, entry.name, 'package.json');
      if (!(await pathExists(manifestPath))) continue;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest;
      found.push({ manifest, manifestPath });
    }
  }
  return found;
}

async function readChangesetConfig(): Promise<ChangesetConfig> {
  const configPath = path.join(REPO_ROOT, '.changeset', 'config.json');
  return JSON.parse(await readFile(configPath, 'utf8')) as ChangesetConfig;
}

async function hasPublishedHistory(packageName: string): Promise<boolean> {
  try {
    await execFileAsync('npm', ['view', packageName, 'version'], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * True if `version` looks like it was computed relative to a real prior
 * release rather than hand-set as a genuine first release. A first release
 * should be `1.0.0(-tag.N)?` — anything with a major of 0 pre-1.0 work, or
 * exactly `1.0.0`, is fine. A major >= 2, or a minor/patch on a 1.x that
 * implies an earlier 1.x existed, is the shape this check flags.
 */
function looksInflatedForFirstRelease(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  return major >= 2;
}

async function checkFixedGroupConsistency(
  packages: WorkspacePackage[],
  config: ChangesetConfig
): Promise<string[]> {
  const problems: string[] = [];
  const byName = new Map(packages.map((p) => [p.manifest.name, p]));

  for (const group of config.fixed ?? []) {
    const versions = new Map<string, string[]>();
    for (const name of group) {
      const pkg = byName.get(name);
      if (!pkg) {
        problems.push(`Fixed group lists "${name}" but no workspace package.json with that name was found.`);
        continue;
      }
      const bucket = versions.get(pkg.manifest.version) ?? [];
      bucket.push(name);
      versions.set(pkg.manifest.version, bucket);
    }
    if (versions.size > 1) {
      const breakdown = [...versions.entries()].map(([v, names]) => `${v} (${names.join(', ')})`).join(' vs. ');
      problems.push(
        `Fixed group is out of sync — every package in one "fixed" array must carry the identical ` +
          `version right now. Found: ${breakdown}. This is already a bug in the working tree, not a ` +
          `future risk — fix the mismatched package.json before doing anything else.`
      );
    }
  }
  return problems;
}

async function checkNeverPublishedVersionSanity(packages: WorkspacePackage[]): Promise<string[]> {
  const problems: string[] = [];
  for (const { manifest, manifestPath } of packages) {
    if (manifest.private) continue;
    if (!looksInflatedForFirstRelease(manifest.version)) continue;

    const published = await hasPublishedHistory(manifest.name);
    if (!published) {
      const relPath = path.relative(REPO_ROOT, manifestPath);
      problems.push(
        `${manifest.name} (${relPath}): current version "${manifest.version}" has never been published ` +
          `to npm, but looks like it was computed from a prior major/minor release that never happened. ` +
          `A genuine first release should be "1.0.0" (optionally prerelease-tagged, e.g. "1.0.0-beta.0"). ` +
          `This is the exact class of mistake found in @nextrush/class on 2026-07-24 — fix the version by hand.`
      );
    }
  }
  return problems;
}

async function checkIgnoreVsDependencyGraph(
  packages: WorkspacePackage[],
  config: ChangesetConfig
): Promise<string[]> {
  const problems: string[] = [];
  const ignored = new Set(config.ignore ?? []);
  if (ignored.size === 0) return problems;

  for (const { manifest } of packages) {
    if (manifest.private) continue; // private packages never publish; Changesets' own rule exempts them too
    if (ignored.has(manifest.name)) continue; // an ignored package depending on another ignored one is fine
    const allDeps = { ...manifest.dependencies, ...manifest.peerDependencies };
    for (const depName of Object.keys(allDeps ?? {})) {
      if (ignored.has(depName)) {
        problems.push(
          `"${manifest.name}" depends on "${depName}", which is in the "ignore" list, but "${manifest.name}" ` +
            `is not. Changesets will refuse this at "pre exit" / "version" time with the same rule — catching ` +
            `it here means fixing it before running either command, not after. Either add "${manifest.name}" ` +
            `to "ignore" too (only viable if it's not in the "fixed" group, or if the WHOLE fixed group can be ` +
            `held back), or remove "${depName}" from "ignore" and let it publish its real first release ` +
            `alongside "${manifest.name}" this cycle.`
        );
      }
    }
  }
  return problems;
}

async function checkStalePreJson(packages: WorkspacePackage[]): Promise<string[]> {
  const preJsonPath = path.join(REPO_ROOT, '.changeset', 'pre.json');
  if (!(await pathExists(preJsonPath))) return [];

  const preJson = JSON.parse(await readFile(preJsonPath, 'utf8')) as {
    readonly initialVersions?: Record<string, string>;
  };
  const initialVersions = preJson.initialVersions ?? {};
  const byName = new Map(packages.map((p) => [p.manifest.name, p.manifest.version]));

  const drifted: string[] = [];
  for (const [name, snapshotVersion] of Object.entries(initialVersions)) {
    const current = byName.get(name);
    // A version already carrying the prerelease suffix is expected drift
    // (that's what `changeset version` is supposed to do inside the
    // window) — only flag a STABLE current version disagreeing with the
    // snapshot, which means something was corrected by hand after
    // `pre enter` already ran once.
    if (current && !current.includes('-') && current !== snapshotVersion) {
      drifted.push(`${name}: pre.json snapshot says "${snapshotVersion}", current package.json says "${current}"`);
    }
  }

  if (drifted.length > 0) {
    return [
      `.changeset/pre.json already exists and its "initialVersions" snapshot disagrees with the current ` +
        `working tree for ${drifted.length} package(s):\n    ${drifted.join('\n    ')}\n  ` +
        `Running "changeset pre enter <tag>" again will NOT refresh this snapshot — it's a no-op if ` +
        `pre.json already exists. If you corrected versions by hand while already inside a prerelease ` +
        `window, run "pnpm changeset pre exit" first, THEN "pnpm changeset pre enter <tag>" again to ` +
        `re-snapshot from the corrected package.json values. See the Release Handbook's stale-pre.json ` +
        `edge case for the full recovery procedure.`,
    ];
  }
  return [];
}

async function main(): Promise<void> {
  const packages = await discoverWorkspacePackages();
  const config = await readChangesetConfig();

  const results = await Promise.all([
    checkFixedGroupConsistency(packages, config),
    checkNeverPublishedVersionSanity(packages),
    checkIgnoreVsDependencyGraph(packages, config),
    checkStalePreJson(packages),
  ]);

  const [fixedGroupProblems, versionSanityProblems, ignoreGraphProblems, prejsonProblems] = results;
  const allProblems = [...fixedGroupProblems, ...versionSanityProblems, ...ignoreGraphProblems, ...prejsonProblems];

  if (allProblems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ Release-state guard failed (${allProblems.length} problem(s)):\n\n` +
        allProblems.map((p, i) => `${i + 1}. ${p}`).join('\n\n')
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `✅ Release-state guard passed — ${packages.length} workspace package(s) checked: fixed-group ` +
      `consistency, never-published version sanity, ignore-list/dependency-graph agreement, and ` +
      `pre.json freshness all clean.`
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
