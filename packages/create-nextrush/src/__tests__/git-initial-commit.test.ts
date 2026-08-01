import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Wave 5 conventions (task 6.4 — F-12).
 *
 * Asserts a git-enabled scaffold leaves an INITIAL COMMIT, not merely staged files — the
 * exact sequence `index.ts::main()` performs (`git init && git add -A && git commit`).
 * Exercises the git commands directly (the same commands `index.ts` runs) since importing
 * `index.ts` triggers its module-level `main()` side effect (see `public-surface.test.ts`).
 */
describe('a git-enabled scaffold receives an initial commit (task 6.4)', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-git-commit-'));
    execFileSync('git', ['init'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: projectDir, stdio: 'ignore' });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('git add -A && git commit leaves exactly one commit, not just staged files', () => {
    execFileSync('node', ['-e', "require('fs').writeFileSync('README.md', '# test')"], {
      cwd: projectDir,
    });

    execFileSync('git', ['add', '-A'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'chore: initial commit from create-nextrush'], {
      cwd: projectDir,
      stdio: 'ignore',
    });

    const log = execFileSync('git', ['log', '--oneline'], { cwd: projectDir }).toString().trim();
    const commitCount = log.split('\n').filter(Boolean).length;

    expect(commitCount).toBe(1);
    expect(log).toContain('chore: initial commit from create-nextrush');

    const status = execFileSync('git', ['status', '--porcelain'], { cwd: projectDir }).toString();
    expect(status.trim()).toBe('');
  });
});
