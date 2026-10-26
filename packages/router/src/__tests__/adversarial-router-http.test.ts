/**
 * @nextrush/router - Adversarial Routing & HTTP Edge-Case Suite
 *
 * Exercises route precedence, param decoding, wildcard matching, trailing slashes,
 * canonicalization, automatic HEAD handling, body-forbidden status codes, and 404
 * miss path settlement invariants.
 */

import { describe, expect, it, vi } from 'vitest';
import { createRouter } from '../router';
import {
  DISPATCH_SETTLED_SYNC,
  RESOLVED_PROMISE,
  type Context,
  type DispatchMarkerCarrier,
} from '@nextrush/types';

function createMockContext(overrides: Partial<Context> = {}): Context & DispatchMarkerCarrier {
  const headers: Record<string, string> = {};
  return {
    method: 'GET',
    url: '/',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers,
    status: 200,
    state: {},
    responded: false,
    json: vi.fn((data: unknown) => {
      (ctx as Context & { responseBody?: unknown }).responseBody = data;
      ctx.responded = true;
    }),
    send: vi.fn((data: unknown) => {
      (ctx as Context & { responseBody?: unknown }).responseBody = data;
      ctx.responded = true;
    }),
    set: vi.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    }),
    get: vi.fn((k: string) => headers[k.toLowerCase()]),
    setNext: vi.fn(),
    ...overrides,
  } as unknown as Context & DispatchMarkerCarrier;
  var ctx: Context & DispatchMarkerCarrier; // eslint-disable-line no-var
}

describe('Adversarial Router & HTTP Edge-Case Suite', () => {
  describe('1. Route Precedence & Ambiguity Disambiguation', () => {
    it('prioritizes exact static routes over parameterized routes regardless of registration order', async () => {
      // Register param route FIRST, then static route
      const router = createRouter();
      let matchedRoute = '';

      router.get('/users/:id', (ctx) => {
        matchedRoute = `param:${ctx.params.id}`;
      });

      router.get('/users/profile', () => {
        matchedRoute = 'static:profile';
      });

      const dispatch = router.routes();

      // Hit static route
      const ctxStatic = createMockContext({ path: '/users/profile' });
      await dispatch(ctxStatic);
      expect(matchedRoute).toBe('static:profile');

      // Hit param route
      const ctxParam = createMockContext({ path: '/users/12345' });
      await dispatch(ctxParam);
      expect(matchedRoute).toBe('param:12345');
    });

    it('prioritizes parameterized routes over wildcard catch-all routes', async () => {
      const router = createRouter();
      let matched = '';

      router.get('/files/*', (ctx) => {
        matched = `wildcard:${ctx.params['*'] ?? ''}`;
      });

      router.get('/files/:category', (ctx) => {
        matched = `category:${ctx.params.category}`;
      });

      const dispatch = router.routes();

      // Hit single segment: should match category
      const ctx1 = createMockContext({ path: '/files/documents' });
      await dispatch(ctx1);
      expect(matched).toBe('category:documents');

      // Hit multiple segments: should match wildcard
      const ctx2 = createMockContext({ path: '/files/documents/2026/report.pdf' });
      await dispatch(ctx2);
      expect(matched).toBe('wildcard:documents/2026/report.pdf');
    });

    it('disambiguates identical prefixes with different downstream parameter branches', async () => {
      const router = createRouter();
      let outcome = '';

      router.get('/orgs/:org/repos', (ctx) => {
        outcome = `repos:${ctx.params.org}`;
      });

      router.get('/orgs/:org/members/:memberId', (ctx) => {
        outcome = `member:${ctx.params.org}/${ctx.params.memberId}`;
      });

      const dispatch = router.routes();

      const ctxRepo = createMockContext({ path: '/orgs/google/repos' });
      await dispatch(ctxRepo);
      expect(outcome).toBe('repos:google');

      const ctxMember = createMockContext({ path: '/orgs/google/members/alice' });
      await dispatch(ctxMember);
      expect(outcome).toBe('member:google/alice');
    });
  });

  describe('2. Path Normalization, Trailing Slashes & URL Parameter Decoding', () => {
    it('normalizes paths with and without trailing slash', async () => {
      const router = createRouter();
      let called = false;

      router.get('/dashboard', () => {
        called = true;
      });

      const dispatch = router.routes();

      const ctx = createMockContext({ path: '/dashboard/' });
      await dispatch(ctx);
      expect(called).toBe(true);
    });

    it('properly decodes percent-encoded UTF-8 route parameters', async () => {
      const router = createRouter();
      let decodedParam = '';

      router.get('/tags/:tag', (ctx) => {
        decodedParam = ctx.params.tag;
      });

      const dispatch = router.routes();
      // %E2%9C%93 is UTF-8 checkmark ✓
      const ctx = createMockContext({ path: '/tags/%E2%9C%93' });
      await dispatch(ctx);
      expect(decodedParam).toBe('✓');
    });

    it('preserves spaces encoded as %20 in route parameters', async () => {
      const router = createRouter();
      let decoded = '';

      router.get('/search/:query', (ctx) => {
        decoded = ctx.params.query;
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ path: '/search/enterprise%20architecture' });
      await dispatch(ctx);
      expect(decoded).toBe('enterprise architecture');
    });
  });

  describe('3. HTTP Methods & Automatic HEAD Handling', () => {
    it('automatically answers HEAD requests when a GET route exists', async () => {
      const router = createRouter();
      let getExecuted = false;

      router.get('/health', (ctx) => {
        getExecuted = true;
        ctx.status = 200;
        ctx.set('content-type', 'application/json');
        ctx.body = { status: 'healthy' };
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ method: 'HEAD', path: '/health' });
      await dispatch(ctx);

      expect(getExecuted).toBe(true);
      expect(ctx.status).toBe(200);
      expect(ctx.get('content-type')).toBe('application/json');
    });

    it('prefers explicit HEAD route if one was registered over automatic GET delegation', async () => {
      const router = createRouter();
      let chosen = '';

      router.get('/items', () => {
        chosen = 'get';
      });

      router.head('/items', () => {
        chosen = 'explicit-head';
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ method: 'HEAD', path: '/items' });
      await dispatch(ctx);

      expect(chosen).toBe('explicit-head');
    });

    it('returns 404 when path matches but method does not', async () => {
      const router = createRouter();
      router.post('/submit', (ctx) => {
        ctx.status = 201;
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ method: 'GET', path: '/submit' });
      await dispatch(ctx);

      expect(ctx.status).toBe(404);
      expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
    });
  });

  describe('4. Status Codes, Headers & Body-Forbidden Invariants', () => {
    it('handles 204 No Content without body and settles synchronously', async () => {
      const router = createRouter();
      router.delete('/resource/:id', (ctx) => {
        ctx.status = 204;
        ctx.body = undefined;
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ method: 'DELETE', path: '/resource/99' });
      const res = dispatch(ctx);

      expect(res).toBe(RESOLVED_PROMISE);
      expect(ctx.status).toBe(204);
      expect(ctx.body).toBeUndefined();
      expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
    });

    it('handles 304 Not Modified without body and settles synchronously', async () => {
      const router = createRouter();
      router.get('/cached', (ctx) => {
        ctx.status = 304;
        ctx.set('etag', '"abc1234"');
        ctx.body = undefined;
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ method: 'GET', path: '/cached' });
      const res = dispatch(ctx);

      expect(res).toBe(RESOLVED_PROMISE);
      expect(ctx.status).toBe(304);
      expect(ctx.get('etag')).toBe('"abc1234"');
      expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
    });
  });

  describe('5. Route Misses & Custom Not-Found Interception', () => {
    it('marks DISPATCH_SETTLED_SYNC on unmatched route miss with no downstream next()', async () => {
      const router = createRouter();
      router.get('/known', (ctx) => {
        ctx.status = 200;
      });

      const dispatch = router.routes();
      const ctx = createMockContext({ path: '/completely-unknown-route' });
      const res = dispatch(ctx);

      expect(res).toBe(RESOLVED_PROMISE);
      expect(ctx.status).toBe(404);
      expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
    });

    it('delegates unmatched routes to downstream next() when provided', async () => {
      const router = createRouter();
      router.get('/known', (ctx) => {
        ctx.status = 200;
      });

      let downstreamNextCalled = false;
      const next = (): Promise<void> => {
        downstreamNextCalled = true;
        return RESOLVED_PROMISE;
      };

      const dispatch = router.routes();
      const ctx = createMockContext({ path: '/unmatched' });
      const res = dispatch(ctx, next);

      expect(res).toBe(RESOLVED_PROMISE);
      expect(downstreamNextCalled).toBe(true);
    });
  });
});
