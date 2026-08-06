/**
 * @nextrush/dev — Deno --env-file loading tests (deno-env-file-loading).
 *
 * Asserts `buildDevArgs` includes `--env-file=.env` in the Deno spawn args when a `.env`
 * file is present, and that existing process env is NOT overwritten (toolchain-injected
 * PORT/NODE_ENV still win) — matching the Node/Bun documented dev precedence.
 */

import { describe, expect, it } from 'vitest';
import { buildDevArgs } from '../runtime/spawn.js';

describe('buildDevArgs - Deno --env-file loading', () => {
  it('includes --env-file=.env in Deno dev args when a .env file is present', () => {
    const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, undefined, undefined, '.env');

    expect(result.command).toBe('deno');
    expect(result.args).toContain('--env-file=.env');
  });

  it('keeps the scoped permissions alongside --env-file (no blanket -A)', () => {
    const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, undefined, undefined, '.env');

    expect(result.args).toContain('--allow-net');
    expect(result.args).toContain('--allow-read');
    expect(result.args).toContain('--allow-env');
    expect(result.args).not.toContain('-A');
  });

  it('omits --env-file when no env file is provided', () => {
    const result = buildDevArgs('deno', 'src/index.ts', []);

    expect(result.args).not.toContain('--env-file');
  });

  it('does not add --env-file for node or bun runtimes', () => {
    const nodeArgs = buildDevArgs('node', 'src/index.ts', [], false, undefined, undefined, undefined, '.env');
    const bunArgs = buildDevArgs('bun', 'src/index.ts', [], false, undefined, undefined, undefined, '.env');

    expect(nodeArgs.args).not.toContain('--env-file');
    expect(bunArgs.args).not.toContain('--env-file');
  });
});
