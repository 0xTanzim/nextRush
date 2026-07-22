import { describe, expect, it } from 'vitest';

import { parseArgs } from '../cli.js';

/**
 * Wave 5 conventions (task 6.5 — F-13, F-14, F-15, F-18).
 *
 * F-13: explicit `--install`/`--git` are distinguished from the unset default via
 * `installExplicit`/`gitExplicit`, so `runPrompts` can correctly skip re-asking only when
 * the user actually passed the flag (the previous `!args.install` check couldn't tell "user
 * said yes" apart from "user said nothing" since both are `true`).
 */
describe('explicit install/git flags are distinguishable from their defaults (task 6.5 / F-13)', () => {
  it('marks installExplicit=false when --install/--no-install was never passed', () => {
    const result = parseArgs(['node', 'create-nextrush']);
    expect(result.install).toBe(true);
    expect(result.installExplicit).toBe(false);
  });

  it('marks installExplicit=true when --install is explicitly passed', () => {
    const result = parseArgs(['node', 'create-nextrush', '--install']);
    expect(result.install).toBe(true);
    expect(result.installExplicit).toBe(true);
  });

  it('marks installExplicit=true when --no-install is explicitly passed', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-install']);
    expect(result.install).toBe(false);
    expect(result.installExplicit).toBe(true);
  });

  it('marks gitExplicit=false when --git/--no-git was never passed', () => {
    const result = parseArgs(['node', 'create-nextrush']);
    expect(result.git).toBe(true);
    expect(result.gitExplicit).toBe(false);
  });

  it('marks gitExplicit=true when --git is explicitly passed', () => {
    const result = parseArgs(['node', 'create-nextrush', '--git']);
    expect(result.git).toBe(true);
    expect(result.gitExplicit).toBe(true);
  });

  it('marks gitExplicit=true when --no-git is explicitly passed', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-git']);
    expect(result.git).toBe(false);
    expect(result.gitExplicit).toBe(true);
  });
});
