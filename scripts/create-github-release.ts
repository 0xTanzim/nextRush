/// <reference types="node" />

/**
 * Creates the ONE canonical GitHub Release for a publish cycle.
 *
 * Run by `.github/workflows/release.yml` immediately after `changesets/action` publishes.
 * The action's own `createGithubReleases` is disabled, so with this step the release page
 * shows exactly one entry per cycle — `NextRush vX.Y.Z` — instead of one per package.
 *
 * Rules (the invariant this repo intentionally enforces):
 *
 *   1. A canonical release is created ONLY when the `nextrush` meta-package was published.
 *      A package-only wave (e.g. just `@nextrush/openapi` + `@nextrush/dev`) publishes to
 *      npm, writes changelogs, and creates `@<pkg>@<version>` git tags — but NO GitHub
 *      Release. GitHub Releases mean exactly one thing: a version of the NextRush product.
 *   2. Per-package git tags remain untouched (they're provenance, not Release-page noise).
 *   3. The release tag is `v<version>`, the title is `NextRush v<version>`, targeted at the
 *      version-merge commit (`HEAD` at publish time — `gh` resolves refs server-side).
 *   4. Idempotent with respect to the RELEASE, not the tag: an existing `v<version>` release
 *      is left alone, and a `v<version>` tag that has no release (a create that failed after
 *      `gh` pushed the tag ref) is completed by attaching the release to that tag. Existing
 *      tags are never moved.
 *
 * Environment:
 *   PUBLISHED_PACKAGES  the `changesets/action` output JSON (`[{name, version}]`)
 *   GITHUB_REPOSITORY   `owner/repo` (set automatically on GitHub runners)
 *   GH_TOKEN            GitHub token with `contents: write` (pass `secrets.GITHUB_TOKEN`)
 *   DRY_RUN=true        or `--dry-run` — render the body and exit without any API call
 */

import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  assembleReleaseBody,
  deriveProductVersion,
  extractChangelogSection,
  extractMeaningfulBullets,
  parsePublishedPackages,
} from './release-notes.js';

const execFileAsync = promisify(execFile);
const REPO = process.env.GITHUB_REPOSITORY ?? '0xTanzim/nextrush';
const REPO_ROOT = process.cwd();

/** Mirrors the workspace globs in `pnpm-workspace.yaml` (and `verify-release-state.ts`). */
const WORKSPACE_PACKAGE_DIRS = [
  'packages',
  'packages/middleware',
  'packages/extensions',
  'packages/adapters',
  'packages/interop',
];

// eslint-disable-next-line no-console
const log = (message: string): void => console.log(message);
// eslint-disable-next-line no-console
const error = (message: string): void => console.error(message);

interface ExecError extends Error {
  readonly stderr?: string;
  readonly stdout?: string;
}

const MAX_ERROR_DETAIL = 4000;

function cap(text: string): string {
  return text.length > MAX_ERROR_DETAIL ? `${text.slice(0, MAX_ERROR_DETAIL)}…` : text;
}

/**
 * `gh` and `git` write the actual reason for a failure to stderr; the `Error.message` from
 * `execFile` only carries the command line and exit code. Swallowing stderr made the v4.1.0
 * `gh release create` failure undebuggable from the workflow log.
 */
function describeExecFailure(err: unknown, command: readonly string[]): string {
  const head = `${command[0]} ${command[1] ?? ''} failed`.trim();
  if (err instanceof Error) {
    const execErr = err as ExecError;
    const detail = [execErr.stderr, execErr.stdout]
      .map((stream) => stream?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
    return `${head}: ${cap(detail || execErr.message)}`;
  }
  return `${head}: ${cap(String(err))}`;
}

async function runGh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    throw new Error(describeExecFailure(err, ['gh', ...args]));
  }
}

async function runGit(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    throw new Error(describeExecFailure(err, ['git', ...args]));
  }
}

/**
 * Resolves the commit the canonical release tag should point at.
 *
 * `gh release create --target` sends `target_commitish` verbatim to the GitHub API, which
 * rejects the literal string `HEAD` ("Release.target_commitish is invalid"). Resolve the
 * working-tree HEAD to its full SHA first. On a runner this is the version state the
 * workflow checked out, which is also pushed (the publish path never leaves an unpushed
 * HEAD), so the SHA is guaranteed to exist server-side. Falls back to `GITHUB_SHA` (the
 * workflow dispatch SHA) when git resolution is unavailable.
 */
async function resolveTargetCommit(): Promise<string> {
  try {
    return await runGit(['rev-parse', 'HEAD']);
  } catch {
    const sha = process.env.GITHUB_SHA;
    if (sha) return sha;
    throw new Error('Unable to resolve target commit (git rev-parse HEAD and GITHUB_SHA both unavailable).');
  }
}

/** Finds the CHANGELOG.md for a published package by walking the workspace manifests. */
async function findChangelogPath(packageName: string): Promise<string | null> {
  for (const glob of WORKSPACE_PACKAGE_DIRS) {
    const dir = path.join(REPO_ROOT, glob);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const manifestPath = path.join(dir, entry.name, 'package.json');
      try {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { name?: string };
        if (manifest.name !== packageName) continue;
        const changelogPath = path.join(dir, entry.name, 'CHANGELOG.md');
        try {
          await access(changelogPath, fsConstants.F_OK);
          return changelogPath;
        } catch {
          return null;
        }
      } catch {
        // Not a directory with a parseable package.json — keep scanning.
      }
    }
  }
  return null;
}

async function tagExists(tag: string): Promise<boolean> {
  try {
    await runGh(['api', `repos/${REPO}/git/ref/tags/${encodeURIComponent(tag)}`, '--jq', '.ref']);
    return true;
  } catch {
    return false;
  }
}

async function releaseExists(tag: string): Promise<boolean> {
  try {
    await runGh(['api', `repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, '--jq', '.id']);
    return true;
  } catch {
    return false;
  }
}

export interface ReleaseCreationDecision {
  /** `create` runs `gh release create`; `skip` leaves GitHub untouched. */
  readonly action: 'create' | 'skip';
  /** Extra `gh release create` arguments. `--target` is only valid when the tag is being made. */
  readonly ghArgs: readonly string[];
  readonly reason: string;
}

/**
 * Decides what a run should do, given the current GitHub state.
 *
 * The tag, not the release, is the fragile half: `gh release create` writes the tag ref before
 * the release, so v4.1.0 was left as a tag with no release when the release call failed.
 * `--target` only picks the commit for a tag being created, so an existing tag has to be used
 * as-is. Planning on the release makes the step idempotent without ever moving a tag.
 */
export function planReleaseCreation(input: {
  tag: string;
  title: string;
  repo: string;
  notesPath: string;
  releaseExists: boolean;
  tagExists: boolean;
  targetCommit: string;
}): ReleaseCreationDecision {
  const {
    tag,
    title,
    repo,
    notesPath,
    releaseExists: hasRelease,
    tagExists: hasTag,
    targetCommit,
  } = input;

  if (hasRelease) {
    return { action: 'skip', ghArgs: [], reason: `Release ${tag} already exists — nothing to do.` };
  }

  const base = [
    'release',
    'create',
    tag,
    '--repo',
    repo,
    '--title',
    title,
    '--notes-file',
    notesPath,
  ];

  if (hasTag) {
    return {
      action: 'create',
      ghArgs: base,
      reason: `Tag ${tag} exists with no release — attaching the release to the existing tag ${targetCommit}.`,
    };
  }

  return {
    action: 'create',
    ghArgs: [...base, '--target', targetCommit],
    reason: `Creating ${tag} at ${targetCommit}.`,
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const rawPublished = process.env.PUBLISHED_PACKAGES ?? '';
  const published = parsePublishedPackages(rawPublished);

  if (published.length === 0) {
    log('No published packages (PUBLISHED_PACKAGES empty) — nothing to do.');
    return;
  }

  const productVersion = deriveProductVersion(published);
  if (!productVersion) {
    log(
      '`nextrush` was not among the published packages — no canonical GitHub Release for this cycle '
    );
    log(
      `  (package-only wave). npm versions, changelogs, and @<pkg>@<version> git tags still exist for: ` +
        published.map((pkg) => `${pkg.name}@${pkg.version}`).join(', ')
    );
    return;
  }

  const changes = new Map<string, string>();
  for (const pkg of published) {
    const changelogPath = await findChangelogPath(pkg.name);
    const changelog = changelogPath ? await readFile(changelogPath, 'utf8') : '';
    const section = extractChangelogSection(changelog, pkg.version);
    changes.set(pkg.name, section ?? '');
  }

  const highlights = extractMeaningfulBullets(changes.get('nextrush') ?? '');
  const body = assembleReleaseBody({ productVersion, packages: published, changes, highlights });
  const tag = `v${productVersion}`;
  const title = `NextRush v${productVersion}`;

  log(`Prepared canonical release: ${title} (tag ${tag})`);
  log('');
  if (dryRun) {
    log('DRY RUN — no GitHub API calls made. Assembled body:');
    log('----------------------------------------------');
    process.stdout.write(body);
    log('----------------------------------------------');
    return;
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'nr-release-'));
  const notesPath = path.join(tmpDir, 'release-notes.md');
  await writeFile(notesPath, body, 'utf8');
  try {
    const [hadRelease, hadTag] = await Promise.all([releaseExists(tag), tagExists(tag)]);
    const decision = planReleaseCreation({
      tag,
      title,
      repo: REPO,
      notesPath,
      releaseExists: hadRelease,
      tagExists: hadTag,
      targetCommit: await resolveTargetCommit(),
    });
    log(decision.reason);
    if (decision.action === 'skip') return;
    const created = await runGh([...decision.ghArgs]);
    log(created);
    log(`✅ Created ${title}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

// Only run when executed directly (not imported for testing).
const isMainModule = process.argv[1]?.endsWith('create-github-release.ts');
if (isMainModule) {
  main().catch((err: unknown) => {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
