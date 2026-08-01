/**
 * @nextrush/dev - `dev()` watch-argument decision unit tests (task 4.1)
 *
 * `buildDevArgs` itself (default bare `--watch` vs explicit `--watch-path`) is already
 * unit-tested directly in `spawn-watch-paths.test.ts` — those assertions were re-verified
 * this session and needed NO update, because the default/explicit split lives in `dev.ts`'s
 * CALLER logic, not in `buildDevArgs`. This file tests that caller logic: which watch
 * paths `dev()` actually passes to `buildDevArgs` for a given `DevOptions.watch`.
 *
 * `spawn()` is mocked here — it is a true external boundary (a real child process) and
 * the only way to deterministically observe what `dev()` decided without actually
 * launching a runtime binary.
 *
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dev } from '../commands/dev.js';
import * as runtimeIndex from '../runtime/index.js';
import * as runtime from '../runtime/index.js';

describe("dev() — watch-argument decision (task 4.1)", () => {
  const FIXTURE_DIR = '/tmp/nextrush-4-1-fake-cwd';

  beforeEach(() => {
    vi.spyOn(runtime, 'getCwd').mockReturnValue(FIXTURE_DIR);
    vi.spyOn(runtime, 'existsSync').mockReturnValue(true);
    vi.spyOn(runtime, 'spawn').mockResolvedValue({
      kill: vi.fn(),
      onExit: vi.fn(),
      onError: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes an empty watch-path list to buildDevArgs when no --watch option is given', async () => {
    const buildArgsSpy = vi.spyOn(runtimeIndex, 'buildDevArgs');

    await dev('./index.ts', { clearScreen: false });

    expect(buildArgsSpy).toHaveBeenCalled();
    const watchPathsArg = buildArgsSpy.mock.calls[0]?.[2];
    expect(watchPathsArg).toEqual([]);
  });

  it('passes the explicit paths through to buildDevArgs when --watch is given', async () => {
    const buildArgsSpy = vi.spyOn(runtimeIndex, 'buildDevArgs');

    await dev('./index.ts', { clearScreen: false, watch: ['./src', './config'] });

    expect(buildArgsSpy).toHaveBeenCalled();
    const watchPathsArg = buildArgsSpy.mock.calls[0]?.[2];
    expect(watchPathsArg).toEqual(['./src', './config']);
  });

  it('treats an empty watch array the same as no --watch option (empty list, not a truthy empty array)', async () => {
    const buildArgsSpy = vi.spyOn(runtimeIndex, 'buildDevArgs');

    await dev('./index.ts', { clearScreen: false, watch: [] });

    const watchPathsArg = buildArgsSpy.mock.calls[0]?.[2];
    expect(watchPathsArg).toEqual([]);
  });
});
