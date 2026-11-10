import { describe, expect, it, vi } from 'vitest';
import { memoizeAppSource } from '../memoize-app';

describe('memoizeAppSource', () => {
  it('returns a promise of the direct app instance when passed directly', async () => {
    const dummyApp = { name: 'app-instance' };
    const getApp = memoizeAppSource(dummyApp);

    expect(typeof getApp).toBe('function');
    const app1 = await getApp();
    const app2 = await getApp();

    expect(app1).toBe(dummyApp);
    expect(app2).toBe(dummyApp);
  });

  it('memoizes an async factory on first invocation', async () => {
    const factory = vi.fn(async () => ({ name: 'factory-app' }));
    const getApp = memoizeAppSource(factory);

    expect(factory).not.toHaveBeenCalled();

    const app1 = await getApp();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(app1).toEqual({ name: 'factory-app' });

    const app2 = await getApp();
    expect(factory).toHaveBeenCalledTimes(1); // Not called again!
    expect(app2).toBe(app1);
  });

  it('retries on subsequent calls if the factory rejects', async () => {
    let callCount = 0;
    const flakyFactory = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Transient boot failure');
      }
      return { name: 'recovered-app' };
    });

    const getApp = memoizeAppSource(flakyFactory);

    // Call 1 fails
    await expect(getApp()).rejects.toThrow('Transient boot failure');
    expect(flakyFactory).toHaveBeenCalledTimes(1);

    // Call 2 retries and succeeds
    const app = await getApp();
    expect(flakyFactory).toHaveBeenCalledTimes(2);
    expect(app).toEqual({ name: 'recovered-app' });

    // Call 3 uses the cached success
    const appCached = await getApp();
    expect(flakyFactory).toHaveBeenCalledTimes(2);
    expect(appCached).toBe(app);
  });
});
