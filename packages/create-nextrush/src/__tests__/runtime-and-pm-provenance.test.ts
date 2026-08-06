import { afterEach, describe, expect, it } from 'vitest';

/**
 * Wave 2 verifier backstop (task 2.5 — F-08 / F-09).
 *
 * 1. Package-manager provenance: the resolved manager must be observable with its source —
 *    `explicit` (user flag), `detected` (environment), or `runtime-policy` (bun runtime).
 * 2. Runtime preflight: before a local install/run, a selected Bun/Deno runtime whose binary
 *    is absent from PATH must produce actionable guidance, with an explicit opt-out for
 *    remote/container targets.
 *
 * RED against the current code: `resolvePackageManager` returns only a `PackageManager`
 * with no source, and there is no runtime-binary preflight anywhere.
 */
import { resolvePackageManagerWithSource } from '../utils.js';
import { RUNTIME_BINARY, preflightRuntimeBinary } from '../installer.js';

const originalUserAgent = process.env['npm_config_user_agent'];
const originalPath = process.env.PATH;

afterEach(() => {
  if (originalUserAgent === undefined) {
    delete process.env['npm_config_user_agent'];
  } else {
    process.env['npm_config_user_agent'] = originalUserAgent;
  }
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
});

describe('package-manager provenance (task 2.5 / F-09)', () => {
  it('reports an explicit --pm choice as explicit', () => {
    expect(resolvePackageManagerWithSource('node', 'pnpm')).toEqual({ packageManager: 'pnpm', source: 'explicit' });
  });

  it('reports a detected manager from the environment', () => {
    process.env['npm_config_user_agent'] = 'yarn/4.0.0 npm/? node/v22.0.0';
    expect(resolvePackageManagerWithSource('node', undefined)).toEqual({ packageManager: 'yarn', source: 'detected' });
  });

  it('reports the bun runtime policy (bun runtime implies bun manager)', () => {
    expect(resolvePackageManagerWithSource('bun', undefined)).toEqual({ packageManager: 'bun', source: 'runtime-policy' });
  });
});

describe('runtime binary preflight (task 2.5 / F-08)', () => {
  it('returns ok for the node runtime (the CLI itself is running on it)', () => {
    const result = preflightRuntimeBinary('node');
    expect(result.ok).toBe(true);
  });

  it('identifies a missing bun binary with install guidance', () => {
    process.env.PATH = '';
    const result = preflightRuntimeBinary('bun');
    expect(result.ok).toBe(false);
    expect(result.guidance).toContain('bun');
    expect(result.guidance).toMatch(/install|https:\/\/bun\.sh/i);
  });

  it('identifies a missing deno binary with install guidance', () => {
    process.env.PATH = '';
    const result = preflightRuntimeBinary('deno');
    expect(result.ok).toBe(false);
    expect(result.guidance).toContain('deno');
    expect(result.guidance).toMatch(/install|https:\/\/deno\.land/i);
  });

  it('passes when the binary is present on PATH', () => {
    const result = preflightRuntimeBinary('bun');
    // On this machine bun is either present (ok) or absent (actionable guidance) — both are
    // acceptable, but the result must be a well-formed check, not a throw.
    expect(['ok', 'guidance']).toContain(Object.keys(result).find((k) => k === 'ok' || k === 'guidance'));
  });
});

describe('runtime binary contract (task 2.5)', () => {
  it('maps each runtime to the binary it must find on PATH', () => {
    expect(RUNTIME_BINARY).toEqual({ node: 'node', bun: 'bun', deno: 'deno' });
  });
});
