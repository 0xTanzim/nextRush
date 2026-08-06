import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveScaffoldPlan } from '../plan.js';
import {
  createErrorResult,
  createSuccessResult,
  renderInputError,
  renderSuccess,
  requestedJsonOutput,
  RESULT_SCHEMA_VERSION,
} from '../result.js';
import type { ScaffoldPlan } from '../plan.js';
import type { CliErrorPayload } from '../types.js';
import { setVersions } from '../version-store.js';

/**
 * Unit coverage for the result/plan model (Wave 2 / task 2.4 & 7.1).
 * The CLI entry runs main() at import, so the pure result/plan surface is
 * exercised here directly instead.
 */
const requiredVersions = {
  nextrush: '^3.1.0',
  '@nextrush/dev': '^1.0.0',
  '@nextrush/types': '^3.1.0',
  '@nextrush/class': '^3.1.0',
  '@nextrush/cors': '^3.1.0',
  '@nextrush/body-parser': '^3.1.0',
  '@nextrush/helmet': '^3.1.0',
  '@nextrush/rate-limit': '^1.0.0',
  '@nextrush/compression': '^3.1.0',
  '@nextrush/request-id': '^1.0.0',
  '@nextrush/adapter-bun': '^1.0.0',
  '@nextrush/adapter-deno': '^1.0.0',
};

function makePlan(overrides: Partial<ScaffoldPlan['options']> = {}): ScaffoldPlan {
  return resolveScaffoldPlan({
    name: 'plan-app',
    directory: './plan-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  });
}

describe('result model (task 2.4 / 7.1)', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cc-result-'));
    setVersions(requiredVersions);
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('createErrorResult carries the schema version, ok=false, and the error payload', () => {
    const payload: CliErrorPayload = { code: 'E_TEST', message: 'boom', remediation: 'fix it' };
    expect(createErrorResult(payload)).toEqual({
      schemaVersion: RESULT_SCHEMA_VERSION,
      ok: false,
      error: payload,
    });
  });

  it('createSuccessResult reports dry-run/offline, the project summary, and per-file actions', () => {
    const plan = makePlan();
    const result = createSuccessResult(plan, true, true);
    expect(result.schemaVersion).toBe(RESULT_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.offline).toBe(true);
    expect(result.project).toMatchObject({
      name: 'plan-app',
      directory: './plan-app',
      style: 'functional',
      runtime: 'node',
      packageManager: 'npm',
    });
    expect(result.files.some((f) => f.path === 'package.json' && f.action === 'create')).toBe(true);
  });

  it('createSuccessResult marks an existing file as replace', () => {
    writeFileSync(join(tmp, 'package.json'), '{}', 'utf-8');
    const plan = makePlan({ directory: tmp });
    const result = createSuccessResult(plan, false, false);
    const pkg = result.files.find((f) => f.path === 'package.json');
    expect(pkg?.action).toBe('replace');
  });

  it('renderInputError emits one JSON error document to stdout in json mode', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      renderInputError({ code: 'E_JSON', message: 'bad', remediation: 'fix' }, true);
      const written = out.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('"code":"E_JSON"');
      expect(written).toContain('"schemaVersion":1');
      expect(err).not.toHaveBeenCalled();
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  });

  it('renderInputError writes an actionable message to stderr in human mode', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      renderInputError({ code: 'E_HUMAN', message: 'bad', remediation: 'fix it' }, false);
      const written = err.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('E_HUMAN');
      expect(written).toContain('fix it');
      expect(out).not.toHaveBeenCalled();
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  });

  it('renderSuccess emits JSON to stdout in json mode', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      renderSuccess(createSuccessResult(makePlan(), false, false), true);
      expect(String(out.mock.calls[0]?.[0])).toContain('"ok":true');
    } finally {
      out.mockRestore();
    }
  });

  it('renderSuccess prints the dry-run plan to stdout in human mode, including offline note', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      renderSuccess(createSuccessResult(makePlan(), true, true), false);
      const written = out.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('Dry run — no files were written.');
      expect(written).toContain('Offline mode');
      expect(written).toContain('Health check: http://localhost:8080/health');
    } finally {
      out.mockRestore();
    }
  });

  it('renderSuccess writes nothing in human mode when the run is not a dry run', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      renderSuccess(createSuccessResult(makePlan(), false, false), false);
      expect(out).not.toHaveBeenCalled();
    } finally {
      out.mockRestore();
    }
  });

  it('requestedJsonOutput detects --json in argv', () => {
    expect(requestedJsonOutput(['node', 'x', '--json'])).toBe(true);
    expect(requestedJsonOutput(['node', 'x'])).toBe(false);
  });
});
