import { describe, expect, it } from 'vitest';
import { planReleaseCreation } from '../create-github-release.js';

const BASE = {
  tag: 'v4.1.0',
  title: 'NextRush v4.1.0',
  repo: '0xTanzim/nextRush',
  notesPath: '/tmp/notes.md',
  targetCommit: 'ba3e85efcb8ce22b69652786b50044f0f3c6c98c',
};

describe('planReleaseCreation', () => {
  it('skips when the release already exists, whatever the tag state', () => {
    for (const tagExists of [true, false]) {
      const decision = planReleaseCreation({ ...BASE, releaseExists: true, tagExists });
      expect(decision.action).toBe('skip');
      expect(decision.ghArgs).toEqual([]);
    }
  });

  it('targets the version commit when neither tag nor release exists', () => {
    const decision = planReleaseCreation({ ...BASE, releaseExists: false, tagExists: false });

    expect(decision.action).toBe('create');
    expect(decision.ghArgs).toEqual([
      'release',
      'create',
      'v4.1.0',
      '--repo',
      '0xTanzim/nextRush',
      '--title',
      'NextRush v4.1.0',
      '--notes-file',
      '/tmp/notes.md',
      '--target',
      BASE.targetCommit,
    ]);
  });

  it('recovers a tag with no release by omitting --target (never moves the existing tag)', () => {
    const decision = planReleaseCreation({ ...BASE, releaseExists: false, tagExists: true });

    expect(decision.action).toBe('create');
    expect(decision.ghArgs).not.toContain('--target');
    expect(decision.ghArgs).not.toContain(BASE.targetCommit);
    expect(decision.ghArgs.slice(0, 3)).toEqual(['release', 'create', 'v4.1.0']);
  });
});
