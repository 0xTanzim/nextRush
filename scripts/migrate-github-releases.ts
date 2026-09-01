/// <reference types="node" />

/**
 * One-time migration tool: deletes the historical per-package GitHub Releases and builds the
 * canonical `NextRush vX.Y.Z` product timeline retroactively.
 *
 * Safety model (never wired into CI):
 *
 *   - DRY RUN by default. Every read-only action (inventory, git-tag dereference, plan
 *     rendering) runs first; NOTHING is deleted or created without `--apply`.
 *   - `--apply` is the only flag that mutates GitHub; it deletes ONLY releases matching the
 *     per-package pattern (`nextrush@4.0.1`, `@nextrush/<pkg>@x.y.z`, `create-nextrush@x.y.z`).
 *   - Git tags are NEVER touched — deleting a GitHub Release leaves the `@<pkg>@<version>`
 *     tag behind; per-package npm history, changelogs, and tags all survive.
 *   - Canonical (`NextRush v…` / `vX.Y.Z`) and unknown releases are always preserved.
 *   - A canonical release is created for a wave ONLY when `nextrush` was part of it (product
 *     version rule — see `scripts/release-notes.ts`). Package-only waves get their package
 *     releases deleted and nothing created.
 *   - Waves are grouped by the commit their git tags point at (all packages in one
 *     Changesets run share the version-merge commit) — no time-window guessing.
 *   - Existing `vX.Y.Z` tags are never clobbered (skip + warn).
 *
 * Usage:
 *   pnpm release:github:cleanup                # inventory + plan (+ sample body), no changes
 *   pnpm release:github:cleanup -- --apply     # execute (prompts for confirmation)
 *   pnpm release:github:cleanup -- --apply --yes
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import {
  assembleReleaseBody,
  buildCanonicalReleasePlans,
  groupWaves,
  isCanonicalReleaseName,
  isPackageReleaseName,
  type CanonicalReleasePlan,
  type PackageReleaseInfo,
  type Wave,
} from './release-notes.js';

const execFileAsync = promisify(execFile);

interface Flags {
  readonly apply: boolean;
  readonly yes: boolean;
  readonly repo: string;
}

export function parseFlags(argv: string[]): Flags {
  let apply = false;
  let yes = false;
  let repo = process.env.GITHUB_REPOSITORY ?? '0xTanzim/nextrush';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--apply') apply = true;
    else if (arg === '--yes') yes = true;
    else if (arg.startsWith('--repo=')) repo = arg.slice('--repo='.length);
    else if (arg === '--repo' && argv[i + 1]) {
      i++;
      repo = argv[i]!;
    }
  }
  return { apply, yes, repo };
}

interface ApiRelease {
  readonly name: string;
  readonly tagName: string;
  readonly body: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
}

// eslint-disable-next-line no-console
const log = (message: string): void => console.log(message);
// eslint-disable-next-line no-console
const error = (message: string): void => console.error(message);

async function runGh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 32 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    throw new Error(`gh ${args[0]} failed: ${detail}`);
  }
}

async function fetchReleases(repo: string): Promise<ApiRelease[]> {
  const json = await runGh([
    'api',
    '--paginate',
    `repos/${repo}/releases`,
    '--jq',
    '.[] | {name, tagName: .tag_name, body, draft, prerelease}',
  ]);
  const releases: ApiRelease[] = [];
  for (const line of json.split('\n')) {
    if (!line.trim()) continue;
    try {
      releases.push(JSON.parse(line) as ApiRelease);
    } catch {
      // Malformed line from pagination — skip rather than abort the inventory.
    }
  }
  return releases;
}

/** Dereferences a git tag to its commit (annotated tags need a second hop). `null` when unresolvable. */
async function resolveTagCommit(repo: string, tag: string): Promise<string | null> {
  try {
    const refJson = await runGh([
      'api',
      `repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,
      '--jq',
      '{sha: .object.sha, type: .object.type}',
    ]);
    const ref = JSON.parse(refJson) as { sha: string; type: string };
    if (ref.type === 'commit') return ref.sha;
    if (ref.type === 'tag') {
      const tagJson = await runGh([
        'api',
        `repos/${repo}/git/tags/${ref.sha}`,
        '--jq',
        '{sha: .object.sha, type: .object.type}',
      ]);
      const tagObject = JSON.parse(tagJson) as { sha: string; type: string };
      return tagObject.type === 'commit' ? tagObject.sha : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function tagExists(repo: string, tag: string): Promise<boolean> {
  try {
    await runGh(['api', `repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`, '--jq', '.ref']);
    return true;
  } catch {
    return false;
  }
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return ['yes', 'y'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

interface PlanContext {
  readonly repo: string;
  readonly waves: readonly Wave[];
  readonly plans: readonly CanonicalReleasePlan[];
  readonly total: number;
  readonly packageStyle: number;
  readonly unresolved: readonly ApiRelease[];
  readonly unknown: readonly ApiRelease[];
  readonly canonical: readonly ApiRelease[];
}

function renderPlan(ctx: PlanContext): void {
  const waveWithProduct = ctx.waves.filter((wave) => wave.productVersion !== null).length;
  const wavePackageOnly = ctx.waves.length - waveWithProduct;

  log('GitHub Releases migration plan');
  log('==============================');
  log(`Repository: ${ctx.repo}`);
  log('');
  log('Inventory');
  log('---------');
  log(`${ctx.total} releases found`);
  log(`  - ${ctx.packageStyle} package-style     → delete candidates (git tags preserved)`);
  for (const rel of ctx.canonical) {
    log(`  - canonical    → preserved: ${rel.name} (tag ${rel.tagName || 'none'})`);
  }
  if (ctx.unknown.length > 0) {
    for (const rel of ctx.unknown) {
      log(`  - unknown/draft → preserved: ${rel.name} (tag ${rel.tagName || 'none'})`);
    }
  }
  for (const rel of ctx.unresolved) {
    log(`  - unresolved tag → preserved: ${rel.name} (could not dereference git tag)`);
  }
  log('');
  log('Waves (grouped by the commit their git tags point at)');
  log('-----------------------------------------------------');
  log(
    `${ctx.waves.length} wave(s): ${waveWithProduct} contain \`nextrush\` (get a canonical release), ` +
      `${wavePackageOnly} are package-only (delete only, no canonical release).`
  );
  log('');
  ctx.waves.forEach((wave, index) => {
    const header = wave.productVersion
      ? `[${index + 1}/${ctx.waves.length}] NextRush v${wave.productVersion}  commit ${wave.commit.slice(0, 7)}`
      : `[${index + 1}/${ctx.waves.length}] (package-only wave)  commit ${wave.commit.slice(0, 7)}`;
    log(header);
    if (wave.productVersion) {
      const tag = `v${wave.productVersion}`;
      const plan = ctx.plans.find((candidate) => candidate.tag === tag);
      const action = plan
        ? `create ${plan.title} (tag ${tag})`
        : `create ${tag} (SKIP — tag already exists)`;
      log(`    ${action}`);
    } else {
      log('    no canonical release (nextrush was not part of this wave)');
    }
    log(
      `    delete ${wave.releases.length} release(s): ${wave.releases.map((rel) => rel.name).join(', ')}`
    );
    log('');
  });

  if (ctx.plans.length > 0) {
    log('Canonical releases to create');
    log('----------------------------');
    for (const plan of ctx.plans) {
      log(
        `  ${plan.title}  → tag ${plan.tag}, target ${plan.commit.slice(0, 7)}, ${plan.packages.length} package(s)`
      );
    }
    log('');
    log('Sample body — most recent canonical release:');
    log('-------------------------------------------');
    const sample = ctx.plans[0]!;
    const body = assembleReleaseBody({
      productVersion: sample.productVersion,
      packages: sample.packages,
      changes: sample.changes,
      highlights: sample.highlights,
    });
    process.stdout.write(body);
    log('-------------------------------------------');
  }

  log('');
  log(
    `Summary: delete ${ctx.packageStyle - ctx.unresolved.length} package release(s), ` +
      `create ${ctx.plans.length} canonical release(s), ` +
      `preserve ${ctx.canonical.length} canonical + ${ctx.unknown.length} unknown + ${ctx.unresolved.length} unresolved.`
  );
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const repo = flags.repo;

  log(`Loading releases for ${repo}...`);
  const releases = await fetchReleases(repo);

  const packageStyle: ApiRelease[] = [];
  const canonical: ApiRelease[] = [];
  const unknown: ApiRelease[] = [];
  for (const rel of releases) {
    if (rel.draft || rel.prerelease) {
      unknown.push(rel);
    } else if (isPackageReleaseName(rel.name)) {
      packageStyle.push(rel);
    } else if (isCanonicalReleaseName(rel.name, rel.tagName)) {
      canonical.push(rel);
    } else {
      unknown.push(rel);
    }
  }

  log(`Resolving git tags → commits for ${packageStyle.length} package release(s)...`);
  const resolved = await mapWithConcurrency(packageStyle, 12, async (rel) => {
    if (!rel.tagName) return { release: rel, commit: null };
    const commit = await resolveTagCommit(repo, rel.tagName);
    return { release: rel, commit };
  });

  const withCommit: PackageReleaseInfo[] = [];
  const unresolved: ApiRelease[] = [];
  for (const item of resolved) {
    if (item.commit) {
      withCommit.push({
        name: item.release.name,
        tagName: item.release.tagName,
        commit: item.commit,
        body: item.release.body,
      });
    } else {
      unresolved.push(item.release);
    }
  }

  const waves = groupWaves(withCommit);
  const plans = buildCanonicalReleasePlans(waves);

  renderPlan({
    repo,
    waves,
    plans,
    total: releases.length,
    packageStyle: packageStyle.length,
    unresolved,
    unknown,
    canonical,
  });

  if (!flags.apply) {
    log('');
    log('DRY RUN — nothing was changed. Re-run with --apply to execute this plan.');
    return;
  }

  if (!flags.yes) {
    const ok = await promptYesNo(
      `Delete ${withCommit.length} package release(s) and create ${plans.length} canonical release(s)? Type yes to confirm: `
    );
    if (!ok) {
      log('Aborted — no changes made.');
      return;
    }
  }

  log('');
  log('Deleting package releases (git tags preserved)...');
  for (const rel of withCommit) {
    await runGh(['release', 'delete', rel.tagName, '--repo', repo, '--yes']);
    log(`  deleted ${rel.name}`);
  }

  log('');
  let created = 0;
  let skipped = 0;
  for (const plan of plans) {
    if (await tagExists(repo, plan.tag)) {
      log(`  SKIP ${plan.title} — tag ${plan.tag} already exists (would never clobber).`);
      skipped++;
      continue;
    }
    const body = assembleReleaseBody({
      productVersion: plan.productVersion,
      packages: plan.packages,
      changes: plan.changes,
      highlights: plan.highlights,
    });
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'nr-migrate-'));
    const notesPath = path.join(tmpDir, 'release-notes.md');
    await writeFile(notesPath, body, 'utf8');
    try {
      const createdUrl = await runGh([
        'release',
        'create',
        plan.tag,
        '--repo',
        repo,
        '--title',
        plan.title,
        '--target',
        plan.commit,
        '--notes-file',
        notesPath,
      ]);
      log(`  created ${plan.title} → ${createdUrl}`);
      created++;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  log('');
  log(
    `Done: deleted ${withCommit.length} package release(s), created ${created} canonical release(s), skipped ${skipped} existing tag(s).`
  );
}

// Only run when executed directly (not imported for testing).
const isMainModule = process.argv[1]?.endsWith('migrate-github-releases.ts');
if (isMainModule) {
  main().catch((err: unknown) => {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
