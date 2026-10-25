import { describe, expect, it } from 'vitest';
import { parseChangesetFrontmatter } from '../validate-changeset-baselines.js';

const FILE = 'test-changeset.md';

describe('parseChangesetFrontmatter', () => {
  it('parses single-quoted keys (the repository convention)', () => {
    const contents = ['---', "'@nextrush/core': minor", "'@nextrush/types': patch", '---', ''].join(
      '\n'
    );

    expect(parseChangesetFrontmatter(contents, FILE)).toEqual([
      { packageName: '@nextrush/core', bumpType: 'minor' },
      { packageName: '@nextrush/types', bumpType: 'patch' },
    ]);
  });

  it('parses double-quoted and unquoted keys', () => {
    const contents = ['---', '"@nextrush/router": major', 'nextrush: patch', '---', ''].join('\n');

    expect(parseChangesetFrontmatter(contents, FILE)).toEqual([
      { packageName: '@nextrush/router', bumpType: 'major' },
      { packageName: 'nextrush', bumpType: 'patch' },
    ]);
  });

  it('ignores body lines and malformed entries', () => {
    const contents = [
      '---',
      "'@nextrush/core': minor",
      'not a bump line',
      "'@nextrush/types': huge",
      '---',
      "'@nextrush/router': major",
      '',
    ].join('\n');

    expect(parseChangesetFrontmatter(contents, FILE)).toEqual([
      { packageName: '@nextrush/core', bumpType: 'minor' },
    ]);
  });

  it('returns [] when there is no frontmatter and throws on unclosed frontmatter', () => {
    expect(parseChangesetFrontmatter('no frontmatter here', FILE)).toEqual([]);

    expect(() =>
      parseChangesetFrontmatter(['---', "'@nextrush/core': minor"].join('\n'), FILE)
    ).toThrow(/no closing "---"/);
  });
});
