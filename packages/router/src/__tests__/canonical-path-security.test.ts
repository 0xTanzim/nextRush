/**
 * @nextrush/router - SEC-02 / SEC-09 canonical-path security regression suite
 *
 * RED tests (tasks 3.1-3.3) for RFC-029: the router folds case and collapses
 * structure for its own lookup, but never publishes that decision, and never
 * rejects a dot segment. A path-based policy comparing raw `ctx.path` (the
 * idiomatic prefix-guard pattern shown in this framework's own README) sees a
 * different string than the one the router matched on.
 *
 * @see docs/RFC/request-data/029-canonical-request-path.md
 */

import type { Context, RouteHandler } from '@nextrush/types';
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
    status: 200,
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

describe('SEC-02: case-fold path-prefix authorization bypass (P1)', () => {
  let router: Router;
  let handler: RouteHandler;

  beforeEach(() => {
    router = createRouter();
    handler = vi.fn();
    router.get('/admin/users', handler);
  });

  it('3.1: dispatches a mixed-case request while a naive raw-ctx.path prefix guard never fires', () => {
    // The exact PoC from report/security-review.md SEC-02: a policy comparing
    // ctx.path.startsWith('/admin') against the RAW request target, guarding a
    // route the router matches after folding.
    const rawPath = '/ADMIN/users';
    const guardWouldFire = rawPath.startsWith('/admin');

    const match = router.match('GET', rawPath);

    expect(guardWouldFire).toBe(false); // the guard never runs
    expect(match).not.toBeNull(); // the router dispatches anyway
    expect(match?.handler).toBe(handler);
  });

  it('3.1: a trailing-slash variant also dispatches while failing a naive equality guard', () => {
    const rawPath = '/admin/users/';
    const guardWouldFire = rawPath === '/admin/users';

    const match = router.match('GET', rawPath);

    expect(guardWouldFire).toBe(false);
    expect(match).not.toBeNull();
  });

  it('3.1: a repeated-slash variant also dispatches while failing a naive equality guard', () => {
    const rawPath = '//admin//users';
    const guardWouldFire = rawPath === '/admin/users';

    const match = router.match('GET', rawPath);

    expect(guardWouldFire).toBe(false);
    expect(match).not.toBeNull();
  });
});

describe('SEC-09: no dot-segment normalization (P2)', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
    router.get('/api/webhooks/handler', vi.fn());
    router.get('/admin', vi.fn());
    router.get('/users/:id', vi.fn());
    router.get('/files/*', vi.fn());
  });

  it.each([
    ['/api/webhooks/../admin', 'literal dot segment'],
    ['/api/./users', 'single-dot segment'],
    ['/../..', 'leading dot segments past root'],
  ])(
    '3.2: %s (%s) is never rejected — it either 404s or resolves past its own directory, both unsafe for a canonical-path contract',
    (path) => {
      // TODAY: the router has no dot-segment concept at all — a dot segment is
      // just an opaque path component. This test documents the RED state: no
      // 400 is ever produced, because nothing in matching.ts/match-route.ts
      // inspects segments for `.`/`..`. Once RFC-029 P0 lands, dot-segment
      // paths must be rejected with 400 before reaching match() at all — this
      // test's premise (the router matches or 404s, never rejects) must flip.
      const match = router.match('GET', path);

      // Current behavior: no route happens to be registered at the resolved
      // literal segments, so this 404s (null) today — proving the absence of
      // any dot-segment handling, not proving safety. A registered route at
      // the resolved target would dispatch silently instead.
      expect(match).toBeNull();
    }
  );

  it('3.2: a percent-encoded double-dot segment is likewise passed through as an opaque literal segment', () => {
    // %2e%2e is never decoded by matchRoute for structural purposes — only
    // param VALUES are percent-decoded (decodeParam), and only after a param
    // slot in the trie already matched. A dot segment used for traversal
    // purposes is a static path segment, so it is compared literally as
    // `%2e%2e`, which matches nothing today.
    const match = router.match('GET', '/api/%2e%2e/admin');
    expect(match).toBeNull();
  });

  it('3.2: a two-character segment starting with a dot but not a double-dot is not flagged as a traversal segment', () => {
    router.get('/files/.x', vi.fn());
    const match = router.match('GET', '/files/.x');
    expect(match).not.toBeNull();
  });

  it('3.2: a dot as filename content (not a traversal segment) is accepted and dispatches normally', () => {
    router.get('/files/archive.tar.gz', vi.fn());
    const match = router.match('GET', '/files/archive.tar.gz');
    expect(match).not.toBeNull();
  });
});

describe('3.3: published-path contract (ctx.path / ctx.originalPath)', () => {
  it('3.3: the router publishes the canonical path onto ctx.path and preserves the raw target on ctx.originalPath', async () => {
    const router = createRouter();
    let seenPath = '';
    let seenOriginal: string | undefined;
    router.get('/admin/users', (ctx) => {
      seenPath = ctx.path;
      seenOriginal = ctx.originalPath;
    });

    const ctx = createMockContext({ path: '/ADMIN/users?x=1' });
    const middleware = router.routes();
    await middleware(ctx, async () => {});

    expect(seenPath).toBe('/admin/users');
    expect(seenOriginal).toBe('/ADMIN/users?x=1');
    expect(seenPath).not.toContain('?');
  });

  it('3.3: both ctx.path and ctx.originalPath are populated on a 404 (no route matched)', async () => {
    const router = createRouter();
    router.get('/users', () => undefined);

    const ctx = createMockContext({ path: '/USERS/999' });
    const middleware = router.routes();
    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(404);
    expect(ctx.path).toBe('/users/999');
    expect((ctx as unknown as { originalPath?: string }).originalPath).toBe('/USERS/999');
  });

  it('a mocked ctx not yet touched by router dispatch has no originalPath — optional field, absent by default', () => {
    const ctx = createMockContext({ path: '/ADMIN/users' });
    expect((ctx as unknown as { originalPath?: string }).originalPath).toBeUndefined();
  });

  it('3.3: a dot-segment request rejected by dispatch sets 400 and still populates ctx.originalPath', async () => {
    const router = createRouter();
    router.get('/admin', vi.fn());

    const ctx = createMockContext({ path: '/../admin' });
    const middleware = router.routes();
    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(ctx.status).toBe(400);
    expect((ctx as unknown as { originalPath?: string }).originalPath).toBe('/../admin');
    // A dot-segment rejection stops the chain outright — it never falls
    // through to a 404/allowedMethods handler the way a plain miss does.
    expect(nextCalled).toBe(false);
  });
});
