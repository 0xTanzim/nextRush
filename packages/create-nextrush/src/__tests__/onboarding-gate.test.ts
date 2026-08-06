import { describe, expect, it } from 'vitest';

/**
 * Wave 2 verifier backstop (task 3.1 — design decision 5).
 *
 * Progressive onboarding: a first-time interactive user is offered the recommended Node API
 * starter (functional + node + api middleware) FIRST, and accepting it skips style/runtime/
 * middleware prompts. Customization exposes every choice. An explicit CLI flag always wins.
 *
 * RED against the current flow, which asks style/runtime/middleware separately with no
 * recommended-starter gate.
 */
import { RECOMMENDED_STARTER, shouldCustomize, recommendedStarterOptions } from '../prompts.js';
import type { ParsedArgs } from '../types.js';

const baseArgs = (overrides: Partial<ParsedArgs> = {}): ParsedArgs => ({
  install: true,
  installExplicit: false,
  git: true,
  gitExplicit: false,
  yes: false,
  help: false,
  version: false,
  json: false,
  dryRun: false,
  overwrite: false,
  offline: false,
  skipRuntimeCheck: false,
  ...overrides,
});

describe('recommended starter (task 3.1 / F-06)', () => {
  it('is the documented Node API starter: functional + node + api middleware', () => {
    expect(RECOMMENDED_STARTER).toEqual({
      style: 'functional',
      runtime: 'node',
      middleware: 'api',
    });
  });

  it('accepting the starter yields exactly the recommended defaults with no architecture prompts', () => {
    const options = recommendedStarterOptions('my-app', './my-app');
    expect(options).toMatchObject({
      name: 'my-app',
      directory: './my-app',
      style: 'functional',
      runtime: 'node',
      middleware: 'api',
    });
  });

  it('an explicit flag disables the recommended gate for that dimension (flag wins)', () => {
    // Passing --style means the user already chose; the recommended gate must not override it.
    expect(shouldCustomize(baseArgs({ style: 'class-based' }))).toBe(true);
    expect(shouldCustomize(baseArgs({ runtime: 'bun' }))).toBe(true);
    expect(shouldCustomize(baseArgs({ middleware: 'minimal' }))).toBe(true);
  });

  it('without any explicit architecture flags, a first-time user gets the recommended gate', () => {
    expect(shouldCustomize(baseArgs({}))).toBe(false);
  });

  it('--yes / non-interactive mode skips the gate entirely', () => {
    expect(shouldCustomize(baseArgs({ yes: true }))).toBe(false);
    expect(shouldCustomize(baseArgs({ json: true }))).toBe(false);
  });
});
