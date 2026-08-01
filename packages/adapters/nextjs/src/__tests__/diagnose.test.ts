import { describe, expect, it } from 'vitest';
import { explainMountMismatch } from '../diagnose';

describe('explainMountMismatch', () => {
  it('names the mounted prefix and the missing app.route() call for a single-segment catch-all', () => {
    const message = explainMountMismatch({
      pathname: '/api/hello',
      params: { route: ['hello'] },
      routeExists: (path) => path === '/hello',
    });

    expect(message).toBeDefined();
    expect(message).toContain('/api');
    expect(message).toContain('/hello');
    expect(message).toContain("app.route('/api'");
  });

  it('names the mounted prefix for a multi-segment catch-all', () => {
    const message = explainMountMismatch({
      pathname: '/api/users/1',
      params: { route: ['users', '1'] },
      routeExists: (path) => path === '/users/1',
    });

    expect(message).toContain('/api');
    expect(message).toContain('/users/1');
  });

  it('resolves an empty optional catch-all (the route file itself) to the whole path as prefix', () => {
    const message = explainMountMismatch({
      pathname: '/api',
      params: { route: [] },
      routeExists: (path) => path === '/',
    });

    expect(message).toContain('/api');
  });

  it('preserves percent-encoding when comparing the stripped path', () => {
    const message = explainMountMismatch({
      pathname: '/api/hello%20world',
      params: { route: ['hello world'] },
      routeExists: (path) => path === '/hello%20world',
    });

    expect(message).toBeDefined();
  });

  it('skips diagnosis when params has no array-valued (catch-all) key at all — a static route file', () => {
    const message = explainMountMismatch({
      pathname: '/api/health',
      params: {},
      routeExists: () => true, // even if this WOULD match, there's nothing to strip/infer
    });

    expect(message).toBeUndefined();
  });

  it('skips diagnosis for a single dynamic segment ([id]-style), which is string-valued, not array-valued', () => {
    const message = explainMountMismatch({
      pathname: '/api/users/1',
      params: { id: '1' },
      routeExists: () => false,
    });

    expect(message).toBeUndefined();
  });

  it('returns undefined when the app genuinely has no such route (real 404)', () => {
    const message = explainMountMismatch({
      pathname: '/api/does-not-exist',
      params: { route: ['does-not-exist'] },
      routeExists: () => false,
    });

    expect(message).toBeUndefined();
  });

  it('never calls routeExists with the original, unstripped path', () => {
    const seen: string[] = [];
    explainMountMismatch({
      pathname: '/api/hello',
      params: { route: ['hello'] },
      routeExists: (path) => {
        seen.push(path);
        return path === '/hello';
      },
    });

    expect(seen).not.toContain('/api/hello');
  });
});
