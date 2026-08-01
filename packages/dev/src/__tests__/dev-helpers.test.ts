/**
 * @nextrush/dev - `dev-helpers.ts` unit tests
 *
 * `resolveDevPort` / `parsePositiveInteger` / `detectProjectRuntime` are pure
 * port/runtime-resolution logic extracted from `dev.ts` — real unit-testable business
 * logic (engineering-standards.md: "separate business logic from infrastructure"), not
 * infrastructure glue. `detectProjectRuntime` reads real temp `package.json` files rather
 * than mocking `fs` — the only true external boundary here (the filesystem) is exercised
 * directly, per tdd-workflow's "prefer real objects over mocks."
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as runtime from '../runtime/index.js';
import { detectRuntime, initFsSync } from '../runtime/index.js';
import {
    DEFAULT_DEV_PORT,
    detectProjectRuntime,
    parsePositiveInteger,
    resolveDevPort,
} from '../commands/dev-helpers.js';

describe('parsePositiveInteger', () => {
  it('returns the parsed integer for a valid positive value', () => {
    expect(parsePositiveInteger('9229', '--inspect-port')).toBe(9229);
  });

  it('exits with an error for a missing, non-numeric, or non-positive value', () => {
    // exitProcess is `never` (calls process.exit) — mock it exactly like the repo's
    // established arg-parsing test pattern so this never kills the test worker.
    const exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
      throw new Error('exit');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parsePositiveInteger(undefined, '--port')).toThrow('exit');
    expect(() => parsePositiveInteger('abc', '--port')).toThrow('exit');
    expect(() => parsePositiveInteger('-1', '--port')).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('resolveDevPort', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('returns the explicit port when provided, ignoring PORT env var', () => {
    process.env.PORT = '9999';
    expect(resolveDevPort(4000)).toBe(4000);
  });

  it('falls back to the PORT env var when no explicit port is given', () => {
    process.env.PORT = '5050';
    expect(resolveDevPort(undefined)).toBe(5050);
  });

  it('falls back to DEFAULT_DEV_PORT when PORT is unset', () => {
    delete process.env.PORT;
    expect(resolveDevPort(undefined)).toBe(DEFAULT_DEV_PORT);
  });

  it('falls back to DEFAULT_DEV_PORT when PORT is not a positive integer', () => {
    process.env.PORT = 'not-a-number';
    expect(resolveDevPort(undefined)).toBe(DEFAULT_DEV_PORT);

    process.env.PORT = '-5';
    expect(resolveDevPort(undefined)).toBe(DEFAULT_DEV_PORT);
  });
});

describe('detectProjectRuntime (real temp package.json)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nextrush-runtime-detect-'));
    // readFileSync's sync fs path requires initFsSync() to have cached the fs module —
    // without it, detectProjectRuntime's try/catch silently swallows the throw and falls
    // through to the runtime fallback, masking the real detection path under test here.
    await initFsSync();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('detects bun from a @nextrush/adapter-bun dependency', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@nextrush/adapter-bun': '^1.0.0' } })
    );
    expect(detectProjectRuntime(dir)).toBe('bun');
  });

  it('detects deno from a @nextrush/adapter-deno devDependency', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { '@nextrush/adapter-deno': '^1.0.0' } })
    );
    expect(detectProjectRuntime(dir)).toBe('deno');
  });

  it('falls back to the CLI process runtime when no adapter dependency is present', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
    expect(detectProjectRuntime(dir)).toBe(detectRuntime());
  });

  it('falls back to the CLI process runtime when package.json is missing', () => {
    // No package.json written in this temp dir at all.
    expect(detectProjectRuntime(dir)).toBe(detectRuntime());
  });

  it('falls back to the CLI process runtime when package.json is malformed', () => {
    writeFileSync(join(dir, 'package.json'), '{ not valid json');
    expect(detectProjectRuntime(dir)).toBe(detectRuntime());
  });
});
