/**
 * @nextrush/router - allowedMethods() middleware characterization
 *
 * `allowedMethods()` (public) wraps `findAllowedMethods()` -> `findNode()`
 * (both private, matching-engine cluster). Before the T014 split moves this
 * cluster into `matching.ts`, this file characterizes its CURRENT end-to-end
 * behavior through the only legitimate entry point — the public middleware —
 * closing a real coverage gap: previously only `typeof middleware ===
 * 'function'` was asserted, and `findNode`'s static/param/wildcard branches
 * were never exercised via any public code path.
 */

import type { Context } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers: {},
    status: 404,
    state: {},
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn(),
    raw: {
      req: {} as never,
      res: {} as never,
    },
    ...overrides,
  } as Context;
}

describe('allowedMethods() middleware — end-to-end characterization', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  it('sets the Allow header and 200 status on an OPTIONS request to a known static path', async () => {
    router.get('/r', vi.fn());
    router.post('/r', vi.fn());

    const ctx = createMockContext({ method: 'OPTIONS', path: '/r', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('POST'));
    expect(ctx.body).toBe('');
  });

  it('sets 405 and Allow header when the method is not registered for a known path', async () => {
    router.get('/r', vi.fn());
    router.post('/r', vi.fn());

    const ctx = createMockContext({ method: 'DELETE', path: '/r', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(405);
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
  });

  it('leaves status untouched when the path is completely unknown (findNode returns null)', async () => {
    router.get('/known', vi.fn());

    const ctx = createMockContext({ method: 'GET', path: '/totally-unknown', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    // No node found for the path at all -> findAllowedMethods returns [] ->
    // early return, status stays 404 (whatever routes() already set).
    expect(ctx.status).toBe(404);
    expect(ctx.set).not.toHaveBeenCalled();
  });

  it('resolves a param route via findNode (paramChild branch)', async () => {
    router.get('/users/:id', vi.fn());

    const ctx = createMockContext({ method: 'OPTIONS', path: '/users/42', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Allow', 'GET, HEAD');
  });

  it('resolves a wildcard route via findNode (wildcardChild branch)', async () => {
    router.get('/files/*', vi.fn());

    const ctx = createMockContext({ method: 'OPTIONS', path: '/files/a/b/c', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Allow', 'GET, HEAD');
  });

  it('resolves a static-child branch deeper than one segment (findNode recursion)', async () => {
    router.get('/api/v1/users', vi.fn());
    router.post('/api/v1/users', vi.fn());

    const ctx = createMockContext({ method: 'OPTIONS', path: '/api/v1/users', status: 404 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('POST'));
  });

  it('does not act when ctx.status is not 404 (route already matched successfully)', async () => {
    router.get('/r', vi.fn());

    const ctx = createMockContext({ method: 'GET', path: '/r', status: 200 });
    const middleware = router.allowedMethods();
    await middleware(ctx, async () => {});

    expect(ctx.set).not.toHaveBeenCalled();
  });

  it('reports allowed methods for a path via the public allowedMethods() middleware (replaces prior direct-private-call test)', async () => {
    router.get('/r', vi.fn());
    router.post('/r', vi.fn());

    const ctx = createMockContext({ method: 'OPTIONS', path: '/r', status: 404 });
    await router.allowedMethods()(ctx, async () => {});

    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('POST'));
    expect(ctx.set).not.toHaveBeenCalledWith('Allow', expect.stringContaining('DELETE'));
  });
});
