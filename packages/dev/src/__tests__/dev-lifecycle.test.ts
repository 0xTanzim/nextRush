/**
 * @nextrush/dev - `dev()` lifecycle tests: crash reporting + signal-await (task 4.3, F-04)
 *
 * Two behaviors under test, both regression guards for F-04:
 * 1. A child that exits non-zero (not via a signal-initiated shutdown) makes `dev()`
 *    print an actionable "Dev process exited with code N" error and exit with that
 *    same non-zero code — never silently swallowing a startup crash.
 * 2. `SIGINT`/`SIGTERM` signal the CHILD first (`kill('SIGTERM')`) and only exit the
 *    parent once the child has actually terminated (via its `onExit` callback) — not
 *    immediately on receiving the signal, which would leave the child (and the port it
 *    holds) dangling.
 *
 * `spawn()`/`onSignal()`/`exitProcess()` are mocked — real external process/signal
 * boundaries that cannot be safely triggered for real inside a vitest worker (a real
 * SIGINT would kill the worker; `exitProcess` is `never` for the same reason).
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dev } from '../commands/dev.js';
import * as runtime from '../runtime/index.js';

describe('dev() lifecycle — crash reporting (task 4.3, F-04)', () => {
  const FIXTURE_DIR = '/tmp/nextrush-4-3-fake-cwd';
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorLines: string[];
  let exitCallback: ((code: number | null) => void) | undefined;

  beforeEach(() => {
    exitCallback = undefined;
    errorLines = [];
    vi.spyOn(runtime, 'getCwd').mockReturnValue(FIXTURE_DIR);
    vi.spyOn(runtime, 'existsSync').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      errorLines.push(String(message));
    });
    vi.spyOn(runtime, 'onSignal').mockImplementation(() => {});
    vi.spyOn(runtime, 'spawn').mockImplementation(async () => ({
      kill: vi.fn(),
      onExit: (cb) => {
        exitCallback = cb;
      },
      onError: vi.fn(),
    }));
    exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
      throw new Error('exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an actionable error and exits with the same non-zero code on a startup crash', async () => {
    await dev('./index.ts', { clearScreen: false });

    expect(exitCallback).toBeTypeOf('function');
    expect(() => exitCallback?.(7)).toThrow('exit');

    expect(exitSpy).toHaveBeenCalledWith(7);
    expect(errorLines.some((l) => l.includes('Dev process exited with code 7'))).toBe(true);
  });

  it('does not treat a clean exit (code 0) as a crash', async () => {
    await dev('./index.ts', { clearScreen: false });

    exitCallback?.(0);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorLines.some((l) => l.includes('Dev process exited'))).toBe(false);
  });
});

describe('dev() lifecycle — SIGINT awaits child termination (task 4.3, F-04)', () => {
  const FIXTURE_DIR = '/tmp/nextrush-4-3b-fake-cwd';
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let killSpy: ReturnType<typeof vi.fn<(signal?: string) => void>>;
  let registeredHandlers: Map<string, () => void>;
  let exitCallback: ((code: number | null) => void) | undefined;

  beforeEach(() => {
    registeredHandlers = new Map();
    exitCallback = undefined;
    killSpy = vi.fn<(signal?: string) => void>();

    vi.spyOn(runtime, 'getCwd').mockReturnValue(FIXTURE_DIR);
    vi.spyOn(runtime, 'existsSync').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(runtime, 'onSignal').mockImplementation((signal, handler) => {
      registeredHandlers.set(signal, handler);
    });
    vi.spyOn(runtime, 'spawn').mockImplementation(async () => ({
      kill: killSpy,
      onExit: (cb) => {
        exitCallback = cb;
      },
      onError: vi.fn(),
    }));
    exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
      throw new Error('exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signals the child (SIGTERM) on SIGINT without exiting the parent immediately', async () => {
    await dev('./index.ts', { clearScreen: false });

    const sigintHandler = registeredHandlers.get('SIGINT');
    expect(sigintHandler).toBeTypeOf('function');

    sigintHandler?.();

    // The child was signaled...
    expect(killSpy).toHaveBeenCalledWith('SIGTERM');
    // ...but the parent has NOT exited yet — it is waiting for the child's onExit.
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits the parent only once the child actually terminates', async () => {
    await dev('./index.ts', { clearScreen: false });

    const sigintHandler = registeredHandlers.get('SIGINT');
    sigintHandler?.();
    expect(exitSpy).not.toHaveBeenCalled();

    // Child terminates in response to the SIGTERM — onExit fires.
    expect(() => exitCallback?.(0)).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
