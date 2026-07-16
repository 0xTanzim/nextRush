/**
 * @nextrush/router - Comprehensive correctness & edge-case audit
 *
 * Proves routing correctness by exhaustive assertion, not assumption. Organized
 * by audit phase. Tests that assert *actual* behavior of an unsupported feature
 * (brace syntax, regex constraints, param decoding) are marked CHARACTERIZATION
 * and documented in the audit report as limitations, not bugs.
 */

import type { HttpMethod, RouteHandler } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

const h = (): RouteHandler => vi.fn();

describe('Router audit', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  // ── Phase 1: route path syntax ──────────────────────────────────────────
  describe('phase 1 — path syntax support', () => {
    it('supports the colon param syntax /users/:id', () => {
      router.get('/users/:id', h());
      expect(router.match('GET', '/users/42')?.params).toEqual({ id: '42' });
    });

    it('CHARACTERIZATION: brace syntax /users/{id} is a LITERAL static segment (not a param)', () => {
      router.get('/users/{id}', h());
      // Only the literal path matches; it does NOT capture a param.
      expect(router.match('GET', '/users/{id}')).not.toBeNull();
      expect(router.match('GET', '/users/{id}')?.params).toEqual({});
      expect(router.match('GET', '/users/42')).toBeNull();
    });

    it('CHARACTERIZATION: regex constraint /:id(\\d+) is NOT a regex — the param is literally named "id(\\d+)"', () => {
      router.get('/n/:id(\\d+)', h());
      const m = router.match('GET', '/n/abc'); // matches any segment (no regex enforcement)
      expect(m).not.toBeNull();
      expect(m?.params).toHaveProperty('id(\\d+)');
      expect(m?.params['id']).toBeUndefined();
    });
  });

  // ── Phase 2: routing correctness ─────────────────────────────────────────
  describe('phase 2 — correctness', () => {
    it('matches the root route', () => {
      router.get('/', h());
      expect(router.match('GET', '/')).not.toBeNull();
    });

    it('matches static routes exactly', () => {
      router.get('/a/b/c', h());
      expect(router.match('GET', '/a/b/c')).not.toBeNull();
      expect(router.match('GET', '/a/b')).toBeNull();
      expect(router.match('GET', '/a/b/c/d')).toBeNull();
    });

    it('extracts multiple params', () => {
      router.get('/:a/:b/:c', h());
      expect(router.match('GET', '/1/2/3')?.params).toEqual({ a: '1', b: '2', c: '3' });
    });

    it('matches a param between static segments', () => {
      router.get('/files/:name/download', h());
      expect(router.match('GET', '/files/report.pdf/download')?.params).toEqual({
        name: 'report.pdf',
      });
      expect(router.match('GET', '/files/report.pdf')).toBeNull();
    });

    it('captures the rest of the path with a wildcard', () => {
      router.get('/static/*', h());
      expect(router.match('GET', '/static/css/app.css')?.params['*']).toBe('css/app.css');
      expect(router.match('GET', '/static/x')?.params['*']).toBe('x');
    });

    it('normalizes duplicate slashes', () => {
      router.get('/a/b', h());
      expect(router.match('GET', '/a//b')).not.toBeNull();
      expect(router.match('GET', '//a///b')).not.toBeNull();
    });

    it('ignores a trailing slash in non-strict mode (default)', () => {
      router.get('/users', h());
      expect(router.match('GET', '/users/')).not.toBeNull();
      router.get('/p/:id', h());
      expect(router.match('GET', '/p/7/')?.params).toEqual({ id: '7' });
    });

    it('handles long param values', () => {
      router.get('/x/:v', h());
      const long = 'a'.repeat(5000);
      expect(router.match('GET', `/x/${long}`)?.params.v).toBe(long);
    });

    it('handles a param value with dots and dashes', () => {
      router.get('/v/:name', h());
      expect(router.match('GET', '/v/my-file.tar.gz')?.params.name).toBe('my-file.tar.gz');
    });

    it('returns null for a completely unknown path', () => {
      router.get('/known', h());
      expect(router.match('GET', '/unknown/deep/path')).toBeNull();
    });
  });

  // ── Phase 3: priority ────────────────────────────────────────────────────
  describe('phase 3 — priority (static > param > wildcard)', () => {
    it('prefers a static route over a param route', () => {
      const staticH = h();
      const paramH = h();
      router.get('/users/:id', paramH);
      router.get('/users/me', staticH);
      expect(router.match('GET', '/users/me')?.handler).toBe(staticH);
      expect(router.match('GET', '/users/42')?.handler).toBe(paramH);
    });

    it('prefers a param route over a wildcard', () => {
      const paramH = h();
      const wildH = h();
      router.get('/a/*', wildH);
      router.get('/a/:id', paramH);
      expect(router.match('GET', '/a/x')?.handler).toBe(paramH);
    });

    it('backtracks: static subtree miss falls through to the param subtree', () => {
      const meProfile = h();
      const idPosts = h();
      router.get('/users/me/profile', meProfile);
      router.get('/users/:id/posts', idPosts);
      // /users/me/posts must fall back to the :id branch (me is not a dead end)
      expect(router.match('GET', '/users/me/posts')?.handler).toBe(idPosts);
      expect(router.match('GET', '/users/me/profile')?.handler).toBe(meProfile);
    });

    it('is deterministic regardless of registration order', () => {
      const r1 = createRouter();
      r1.get('/users/me', h());
      r1.get('/users/:id', h());
      const r2 = createRouter();
      r2.get('/users/:id', h());
      r2.get('/users/me', h());
      expect(r1.match('GET', '/users/me')).not.toBeNull();
      expect(r2.match('GET', '/users/me')?.params).toEqual({});
    });
  });

  // ── Phase 4: nested / deep routes ────────────────────────────────────────
  describe('phase 4 — nested & deep routes', () => {
    it('matches deeply nested param chains', () => {
      router.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', h());
      expect(
        router.match('GET', '/api/v1/orgs/1/teams/2/members/3')?.params
      ).toEqual({ orgId: '1', teamId: '2', memberId: '3' });
    });

    it('supports many sibling nested routes without ambiguity', () => {
      router.get('/api/users', h());
      router.get('/api/users/:id', h());
      router.get('/api/users/:id/posts', h());
      router.get('/api/users/:id/posts/:postId', h());
      expect(router.match('GET', '/api/users')?.params).toEqual({});
      expect(router.match('GET', '/api/users/9')?.params).toEqual({ id: '9' });
      expect(router.match('GET', '/api/users/9/posts')?.params).toEqual({ id: '9' });
      expect(router.match('GET', '/api/users/9/posts/5')?.params).toEqual({
        id: '9',
        postId: '5',
      });
    });
  });

  // ── Phase 6: query strings must not affect matching ──────────────────────
  describe('phase 6 — query strings are ignored during matching', () => {
    it('matches a static route with a query string', () => {
      router.get('/users', h());
      expect(router.match('GET', '/users?page=5')).not.toBeNull();
    });

    it('matches a param route and excludes the query from the param value', () => {
      router.get('/users/:id', h());
      expect(router.match('GET', '/users/42?expand=true')?.params).toEqual({ id: '42' });
    });

    it('matches the root route with a query string', () => {
      router.get('/', h());
      expect(router.match('GET', '/?a=1&b=2')).not.toBeNull();
    });
  });

  // ── Phase 7: decoding & unicode ──────────────────────────────────────────
  describe('phase 7 — decoding & unicode', () => {
    it('matches unicode path segments (raw)', () => {
      router.get('/u/:name', h());
      expect(router.match('GET', '/u/josé')?.params.name).toBe('josé');
      expect(router.match('GET', '/u/日本語')?.params.name).toBe('日本語');
    });

    it('percent-encoded params are DECODED by default (raw available via decode:false)', () => {
      router.get('/u/:name', h());
      expect(router.match('GET', '/u/hello%20world')?.params.name).toBe('hello world');

      const raw = createRouter({ decode: false });
      raw.get('/u/:name', h());
      expect(raw.match('GET', '/u/hello%20world')?.params.name).toBe('hello%20world');
    });
  });

  // ── Phase 8: HTTP methods ────────────────────────────────────────────────
  describe('phase 8 — HTTP methods', () => {
    it('registers and matches all standard methods', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      for (const m of methods) {
        const r = createRouter();
        r.all('/x', h());
        expect(r.match(m, '/x')).not.toBeNull();
      }
    });

    it('distinguishes the same path by method', () => {
      const getH = h();
      const postH = h();
      router.get('/r', getH);
      router.post('/r', postH);
      expect(router.match('GET', '/r')?.handler).toBe(getH);
      expect(router.match('POST', '/r')?.handler).toBe(postH);
      expect(router.match('DELETE', '/r')).toBeNull();
    });

    it('reports allowed methods for a path (via the public allowedMethods() middleware)', async () => {
      router.get('/r', h());
      router.post('/r', h());
      const ctx = {
        method: 'OPTIONS',
        path: '/r',
        status: 404,
        set: vi.fn(),
      } as unknown as import('@nextrush/types').Context;
      await router.allowedMethods()(ctx, async () => {});
      expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
      expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('POST'));
      expect(ctx.set).not.toHaveBeenCalledWith('Allow', expect.stringContaining('DELETE'));
    });
  });

  // ── Phase 9: large scale ─────────────────────────────────────────────────
  describe('phase 9 — large scale', () => {
    it('stays correct with 1000 mixed static/param routes', () => {
      for (let i = 0; i < 1000; i++) {
        router.get(`/r${i}/static`, h());
        router.get(`/r${i}/:id`, h());
      }
      expect(router.match('GET', '/r0/static')?.params).toEqual({});
      expect(router.match('GET', '/r500/:id'.replace(':id', 'abc'))?.params).toEqual({ id: 'abc' });
      expect(router.match('GET', '/r999/xyz')?.params).toEqual({ id: 'xyz' });
      expect(router.match('GET', '/r1000/nope')).toBeNull();
    });
  });

  // ── Phase 10: failure cases ──────────────────────────────────────────────
  describe('phase 10 — failure & graceful handling', () => {
    it('throws a clear error on duplicate route registration', () => {
      router.get('/dup', h());
      expect(() => router.get('/dup', h())).toThrow(/already registered|conflict/i);
    });

    it('throws a clear error on conflicting param names at the same position', () => {
      router.get('/u/:id', h());
      expect(() => router.get('/u/:name/x', h())).toThrow(/param name conflict/i);
    });

    it('treats an empty path as the root route', () => {
      router.get('', h());
      expect(router.match('GET', '/')).not.toBeNull();
    });

    it('throws a clear TypeError for a non-string path', () => {
      expect(() => router.get(null as unknown as string, h())).toThrow(TypeError);
      expect(() => router.get(undefined as unknown as string, h())).toThrow(TypeError);
      expect(() => router.get(123 as unknown as string, h())).toThrow(TypeError);
    });

    it('requires at least one handler', () => {
      expect(() => router.get('/no-handler')).toThrow(/at least one handler/i);
    });
  });

  // ── Phase 12: historical routing bugs from other frameworks ──────────────
  describe('phase 12 — hardening against known routing bugs', () => {
    it('does not confuse a param value with a similarly-named static route', () => {
      router.get('/search', h());
      router.get('/:term', h());
      expect(router.match('GET', '/search')?.params).toEqual({}); // static wins
      expect(router.match('GET', '/anything')?.params).toEqual({ term: 'anything' });
    });

    it('does not leak params across non-matching branches (backtracking cleanup)', () => {
      router.get('/a/:x/b', h());
      router.get('/a/fixed', h());
      // /a/fixed matches the static branch and must NOT carry an :x param
      expect(router.match('GET', '/a/fixed')?.params).toEqual({});
    });

    it('handles adjacent params without a static separator', () => {
      router.get('/:a/:b', h());
      expect(router.match('GET', '/x/y')?.params).toEqual({ a: 'x', b: 'y' });
      expect(router.match('GET', '/x')).toBeNull();
    });

    it('wildcard does not swallow a more specific static sibling', () => {
      const wild = h();
      const exact = h();
      router.get('/assets/*', wild);
      router.get('/assets/favicon.ico', exact);
      expect(router.match('GET', '/assets/favicon.ico')?.handler).toBe(exact);
      expect(router.match('GET', '/assets/img/logo.png')?.handler).toBe(wild);
    });

    it('does not match a prefix of a longer static route', () => {
      router.get('/api/users/list', h());
      expect(router.match('GET', '/api/users')).toBeNull();
      expect(router.match('GET', '/api')).toBeNull();
    });
  });
});
