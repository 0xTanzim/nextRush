/**
 * @nextrush/runtime — the shared boot gate.
 *
 * @remarks
 * One boot barrier, adopted by every adapter entry point that builds a request
 * handler before the application has booted. The contract pinned here: boot runs
 * before the first dispatch, concurrent first requests share a single boot, a
 * failed boot is retryable, and a steady-state request reads an already-resolved
 * handler instead of re-entering the boot path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBootGate, type BootableApp } from '../boot-gate';

type Handler = (ctx: string) => Promise<void>;

interface Calls {
  ready: number;
  start: number;
}

interface FakeApp {
  readonly app: BootableApp<Handler>;
  readonly calls: Calls;
  readonly handler: Handler;
}

/**
 * Build a structural stand-in for `Application`. The gate deliberately does not
 * depend on `@nextrush/core`, so the fake is the real contract surface: a
 * `ready()` that resolves, a `callback()` that returns the handler, and a
 * `start()`.
 */
function makeApp(override?: (calls: Calls) => Partial<BootableApp<Handler>>): FakeApp {
  const calls: Calls = { ready: 0, start: 0 };
  const handler: Handler = async () => undefined;
  const app: BootableApp<Handler> = {
    isReady: false,
    ready: () => {
      calls.ready += 1;
      return Promise.resolve();
    },
    callback: () => handler,
    start: () => {
      calls.start += 1;
    },
    isProduction: false,
    ...(override?.(calls) ?? {}),
  };
  return { app, calls, handler };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createBootGate — boot ordering', () => {
  it('exposes no handler until the first ensure() resolves', async () => {
    const { app } = makeApp();
    const gate = createBootGate(app, { label: 'test' });

    expect(gate.handler).toBeUndefined();

    await gate.ensure();

    expect(gate.handler).toBeDefined();
  });

  it('resolves ensure() to the handler the application composes after boot', async () => {
    const { app, handler, calls } = makeApp();
    const gate = createBootGate(app, { label: 'test' });

    await expect(gate.ensure()).resolves.toBe(handler);
    expect(calls.ready).toBe(1);
  });

  it('shares one boot across concurrent first requests', async () => {
    let release: () => void = () => undefined;
    const booted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app, calls, handler } = makeApp(() => ({
      ready: () => {
        calls.ready += 1;
        return booted;
      },
    }));
    const gate = createBootGate(app, { label: 'test' });

    const first = gate.ensure();
    const second = gate.ensure();

    expect(first).toBe(second);
    expect(calls.ready).toBe(1);
    expect(gate.handler).toBeUndefined();

    release();

    await expect(first).resolves.toBe(handler);
    expect(gate.handler).toBe(handler);
  });

  it('reuses the memoized boot for every later ensure() call', async () => {
    const { app, handler, calls } = makeApp();
    const gate = createBootGate(app, { label: 'test' });

    await gate.ensure();
    await expect(gate.ensure()).resolves.toBe(handler);

    expect(calls.ready).toBe(1);
  });
});

describe('createBootGate — failed boot', () => {
  it('rejects every concurrent caller when boot fails', async () => {
    const failure = new Error('extension setup failed');
    const { app, calls } = makeApp((c) => ({
      ready: () => {
        c.ready += 1;
        return Promise.reject(failure);
      },
    }));
    const gate = createBootGate(app, { label: 'test' });

    const first = gate.ensure();
    const second = gate.ensure();

    await expect(first).rejects.toThrow('extension setup failed');
    await expect(second).rejects.toThrow('extension setup failed');
    expect(calls.ready).toBe(1);
    expect(gate.handler).toBeUndefined();
  });

  it('clears the memo after a failed boot so the next request re-attempts boot', async () => {
    let attempts = 0;
    const { app, handler } = makeApp(() => ({
      ready: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('transient')) : Promise.resolve();
      },
    }));
    const gate = createBootGate(app, { label: 'test' });

    await expect(gate.ensure()).rejects.toThrow('transient');
    await expect(gate.ensure()).resolves.toBe(handler);

    expect(attempts).toBe(2);
  });
});

describe('createBootGate — an application booted before the gate was built', () => {
  it('exposes the composed handler synchronously, with no boot attempt', () => {
    const { app, handler, calls } = makeApp(() => ({ isReady: true }));

    const gate = createBootGate(app, { label: 'test' });

    expect(gate.handler).toBe(handler);
    expect(calls.ready).toBe(0);
  });

  it('never re-enters ready() through ensure()', async () => {
    const { app, handler, calls } = makeApp(() => ({ isReady: true }));
    const gate = createBootGate(app, { label: 'test' });

    await expect(gate.ensure()).resolves.toBe(handler);

    expect(calls.ready).toBe(0);
  });
});

describe('createBootGate — running state', () => {
  it('does not mark the application running unless asked', async () => {
    const { app, calls } = makeApp();

    await createBootGate(app, { label: 'test' }).ensure();

    expect(calls.start).toBe(0);
  });

  it('marks the application running exactly once when markRunning is set', async () => {
    const { app, calls } = makeApp();
    const gate = createBootGate(app, { label: 'test', markRunning: true });

    await gate.ensure();
    await gate.ensure();

    expect(calls.start).toBe(1);
  });
});

describe('createBootGate — boot-reuse warning', () => {
  /**
   * The warning bookkeeping is module-level (one warning per process/isolate),
   * so each test needs its own copy of the module to observe it.
   */
  async function freshCreateBootGate(): Promise<typeof createBootGate> {
    vi.resetModules();
    return (await import('../boot-gate')).createBootGate;
  }

  it('does not warn when the same application boots once', async () => {
    const create = await freshCreateBootGate();
    const { app } = makeApp();

    await create(app, { label: 'edge' }).ensure();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when the same application is booted by a second gate', async () => {
    const create = await freshCreateBootGate();
    const { app } = makeApp();

    await create(app, { label: 'edge' }).ensure();
    await create(app, { label: 'edge' }).ensure();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once when a second, distinct application boots through the gate', async () => {
    const create = await freshCreateBootGate();

    await create(makeApp().app, { label: 'edge' }).ensure();
    await create(makeApp().app, { label: 'edge' }).ensure();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/\[nextrush\/edge\].*module scope/i);
  });

  it('does not warn in production', async () => {
    const create = await freshCreateBootGate();

    await create(makeApp(() => ({ isProduction: true })).app, { label: 'edge' }).ensure();
    await create(makeApp(() => ({ isProduction: true })).app, { label: 'edge' }).ensure();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns only once across many distinct applications', async () => {
    const create = await freshCreateBootGate();

    for (let i = 0; i < 4; i++) {
      await create(makeApp().app, { label: 'bun' }).ensure();
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/\[nextrush\/bun\]/);
  });
});
