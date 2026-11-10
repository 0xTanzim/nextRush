/**
 * @nextrush/router - Adversarial Multi-Prefix Sub-Router Mounting Stress Tests
 *
 * Empirical challenger tests verifying:
 * 1. Combinatorial Prefix Fuzzing (10, 50, 100 prefixes mounted simultaneously)
 * 2. Deep Path & Sibling Prefix Collisions (['/api/v1', '/api/v2', '/api'])
 * 3. Prefix Normalization Edge Cases (['api//', '//api///', '///'])
 * 4. Error Injection & Mutation Atomicity ([], [null], [123], [''])
 * 5. Multi-Level Nested Router Composition
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

describe('Empirical Challenger: Multi-Prefix Router.mount Stress & Boundary Verification', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('Dimension 1: Combinatorial Prefix Fuzzing (10, 50, 100 prefixes)', () => {
    it('mounts and matches across 10 distinct prefixes simultaneously', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/resource/:id', handler);

      const prefixes = Array.from({ length: 10 }, (_, i) => `/tier-ten-${i}`);
      router.mount(prefixes, subRouter);

      for (let i = 0; i < 10; i++) {
        const match = router.match('GET', `/tier-ten-${i}/resource/abc-${i}`);
        expect(match).not.toBeNull();
        expect(match?.handler).toBe(handler);
        expect(match?.params.id).toBe(`abc-${i}`);
      }

      // Negative check
      expect(router.match('GET', '/tier-ten-10/resource/xyz')).toBeNull();
      expect(router.match('GET', '/tier-ten-0')).toBeNull();
    });

    it('mounts and matches across 50 distinct prefixes simultaneously', () => {
      const subRouter = createRouter();
      const getHandler = vi.fn();
      const postHandler = vi.fn();
      subRouter.get('/items', getHandler);
      subRouter.post('/items', postHandler);

      const prefixes = Array.from({ length: 50 }, (_, i) => `/svc-${i}/v1`);
      router.mount(prefixes, subRouter);

      for (let i = 0; i < 50; i++) {
        const getMatch = router.match('GET', `/svc-${i}/v1/items`);
        expect(getMatch).not.toBeNull();
        expect(getMatch?.handler).toBe(getHandler);

        const postMatch = router.match('POST', `/svc-${i}/v1/items`);
        expect(postMatch).not.toBeNull();
        expect(postMatch?.handler).toBe(postHandler);
      }

      // Negative check
      expect(router.match('GET', '/svc-50/v1/items')).toBeNull();
    });

    it('mounts and matches across 100 distinct prefixes simultaneously with wildcards', () => {
      const subRouter = createRouter();
      const wildcardHandler = vi.fn();
      const staticHandler = vi.fn();
      subRouter.get('/static', staticHandler);
      subRouter.get('/assets/*', wildcardHandler);

      const prefixes = Array.from({ length: 100 }, (_, i) => `/zone-${i}/app`);
      router.mount(prefixes, subRouter);

      for (let i = 0; i < 100; i++) {
        // Static match
        const staticMatch = router.match('GET', `/zone-${i}/app/static`);
        expect(staticMatch).not.toBeNull();
        expect(staticMatch?.handler).toBe(staticHandler);

        // Wildcard match
        const wildcardMatch = router.match('GET', `/zone-${i}/app/assets/images/logo.png`);
        expect(wildcardMatch).not.toBeNull();
        expect(wildcardMatch?.handler).toBe(wildcardHandler);
      }

      // Negative check
      expect(router.match('GET', '/zone-100/app/static')).toBeNull();
      expect(router.match('GET', '/zone-0/static')).toBeNull();
    });
  });

  describe('Dimension 2: Deep Path & Sibling Prefix Collisions', () => {
    it('correctly resolves routes with sibling and nested prefixes: ["/api/v1", "/api/v2", "/api"]', () => {
      const subRouter = createRouter();
      const usersHandler = vi.fn();
      const rootHandler = vi.fn();
      subRouter.get('/', rootHandler);
      subRouter.get('/users', usersHandler);

      router.mount(['/api/v1', '/api/v2', '/api'], subRouter);

      // Root routes under prefixes
      expect(router.match('GET', '/api/v1')?.handler).toBe(rootHandler);
      expect(router.match('GET', '/api/v2')?.handler).toBe(rootHandler);
      expect(router.match('GET', '/api')?.handler).toBe(rootHandler);

      // Sub-routes under prefixes
      expect(router.match('GET', '/api/v1/users')?.handler).toBe(usersHandler);
      expect(router.match('GET', '/api/v2/users')?.handler).toBe(usersHandler);
      expect(router.match('GET', '/api/users')?.handler).toBe(usersHandler);

      // Negative check
      expect(router.match('GET', '/api/v3/users')).toBeNull();
      expect(router.match('GET', '/apigateway/users')).toBeNull();
    });

    it('correctly extracts params with sibling prefixes and param routes', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/orgs/:orgId/repos/:repoId', handler);

      router.mount(['/api/v1', '/api/v2', '/internal'], subRouter);

      const match1 = router.match('GET', '/api/v1/orgs/nextrush/repos/core');
      expect(match1).not.toBeNull();
      expect(match1?.params.orgId).toBe('nextrush');
      expect(match1?.params.repoId).toBe('core');

      const match2 = router.match('GET', '/internal/orgs/acme/repos/infra');
      expect(match2).not.toBeNull();
      expect(match2?.params.orgId).toBe('acme');
      expect(match2?.params.repoId).toBe('infra');
    });

    it('handles inverted prefix order ["/api", "/api/v1", "/api/v2"] identically in trie', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/status', handler);

      router.mount(['/api', '/api/v1', '/api/v2'], subRouter);

      expect(router.match('GET', '/api/status')?.handler).toBe(handler);
      expect(router.match('GET', '/api/v1/status')?.handler).toBe(handler);
      expect(router.match('GET', '/api/v2/status')?.handler).toBe(handler);
    });
  });

  describe('Dimension 3: Prefix Normalization Edge Cases', () => {
    it('normalizes ["api//", "//api///", "///"] correctly in Router.mount without Route conflict', () => {
      const subRouter = createRouter();
      const statusHandler = vi.fn();
      subRouter.get('/status', statusHandler);

      router.mount(['api//', '//api///', '///'], subRouter);

      // "api//" -> "/api"
      // "//api///" -> "/api" (deduplicated or handled)
      // "///" -> "/"
      const matchApi = router.match('GET', '/api/status');
      expect(matchApi).not.toBeNull();
      expect(matchApi?.handler).toBe(statusHandler);

      const matchRoot = router.match('GET', '/status');
      expect(matchRoot).not.toBeNull();
      expect(matchRoot?.handler).toBe(statusHandler);
    });

    it('handles duplicate identical prefixes in Router.mount(["/api", "/api"]) without crashing', () => {
      const subRouter = createRouter();
      subRouter.get('/ping', vi.fn());

      router.mount(['/api', '/api'], subRouter);
      expect(router.match('GET', '/api/ping')).not.toBeNull();
    });

    it('normalizes complex slashes like "///api///v1///"', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/check', handler);

      router.mount(['///api///v1///'], subRouter);

      const match = router.match('GET', '/api/v1/check');
      expect(match).not.toBeNull();
      expect(match?.handler).toBe(handler);
    });
  });

  describe('Dimension 4: Error Injection & Atomicity', () => {
    it('throws synchronous Error on empty array [] in mount()', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount([], subRouter);
      }).toThrow('router.mount() requires at least one path prefix when an array is provided');
    });

    it('throws synchronous Error on empty array [] in use()', () => {
      const subRouter = createRouter();
      expect(() => {
        router.use([], subRouter);
      }).toThrow('router.mount() requires at least one path prefix when an array is provided');
    });

    it('throws synchronous TypeError on [null]', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount([null as unknown as string], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a string, received null'));
    });

    it('throws synchronous TypeError on [123]', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount([123 as unknown as string], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a string, received number'));
    });

    it('throws synchronous TypeError on [""]', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount([''], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
    });

    it('throws TypeError when subRouter is invalid in mount()', () => {
      expect(() => {
        router.mount(['/api'], null as unknown as Router);
      }).toThrow(new TypeError('router.mount() requires a Router instance'));

      expect(() => {
        router.mount(['/api'], {} as unknown as Router);
      }).toThrow(new TypeError('router.mount() requires a Router instance'));
    });

    it('atomicity check: does not register earlier valid prefixes when a later prefix is invalid', () => {
      const subRouter = createRouter();
      subRouter.get('/users', vi.fn());

      expect(() => {
        router.mount(['/atomic1', '/atomic2', null as unknown as string], subRouter);
      }).toThrow();

      // Neither prefix should be mounted in the trie
      expect(router.match('GET', '/atomic1/users')).toBeNull();
      expect(router.match('GET', '/atomic2/users')).toBeNull();
    });
  });

  describe('Dimension 5: Multi-Level Nested Router Composition', () => {
    it('supports 2 levels of multi-prefix mounted routers', () => {
      const leafRouter = createRouter();
      const handler = vi.fn();
      leafRouter.get('/details', handler);

      const midRouter = createRouter();
      midRouter.mount(['/orders', '/invoices'], leafRouter);

      router.mount(['/v1', '/v2'], midRouter);

      expect(router.match('GET', '/v1/orders/details')?.handler).toBe(handler);
      expect(router.match('GET', '/v1/invoices/details')?.handler).toBe(handler);
      expect(router.match('GET', '/v2/orders/details')?.handler).toBe(handler);
      expect(router.match('GET', '/v2/invoices/details')?.handler).toBe(handler);

      // Negative check
      expect(router.match('GET', '/v1/details')).toBeNull();
      expect(router.match('GET', '/orders/details')).toBeNull();
    });
  });

  describe('Dimension 6: Challenger Adversarial Matrix (Iteration 2)', () => {
    describe('6.1 Extreme Slash Variations', () => {
      it('mounts and matches ["///", "////api////", "/api//v1///v2/"] with static and parameterized routes', () => {
        const subRouter = createRouter();
        const statusHandler = vi.fn();
        const userHandler = vi.fn();

        subRouter.get('/status', statusHandler);
        subRouter.get('/users/:id', userHandler);

        router.mount(['///', '////api////', '/api//v1///v2/'], subRouter);

        // 1. Root prefix via '///'
        const matchRoot = router.match('GET', '/status');
        expect(matchRoot?.handler).toBe(statusHandler);
        const matchRootUser = router.match('GET', '/users/alice');
        expect(matchRootUser?.handler).toBe(userHandler);
        expect(matchRootUser?.params.id).toBe('alice');

        // 2. /api prefix via '////api////'
        const matchApi = router.match('GET', '/api/status');
        expect(matchApi?.handler).toBe(statusHandler);
        const matchApiUser = router.match('GET', '/api/users/bob');
        expect(matchApiUser?.handler).toBe(userHandler);
        expect(matchApiUser?.params.id).toBe('bob');

        // 3. /api/v1/v2 prefix via '/api//v1///v2/'
        const matchDeep = router.match('GET', '/api/v1/v2/status');
        expect(matchDeep?.handler).toBe(statusHandler);
        const matchDeepUser = router.match('GET', '/api/v1/v2/users/charlie');
        expect(matchDeepUser?.handler).toBe(userHandler);
        expect(matchDeepUser?.params.id).toBe('charlie');

        // Negative boundaries
        expect(router.match('GET', '/apigateway/status')).toBeNull();
        expect(router.match('GET', '/api/v1/status')).toBeNull();
      });
    });

    describe('6.2 Duplicate Prefixes in Array', () => {
      it('mounts ["/api", "/api", "api", "//api/"] without throwing Route conflict', () => {
        const subRouter = createRouter();
        const handler = vi.fn();
        subRouter.get('/ping', handler);

        expect(() => {
          router.mount(['/api', '/api', 'api', '//api/'], subRouter);
        }).not.toThrow();

        const match = router.match('GET', '/api/ping');
        expect(match?.handler).toBe(handler);
      });

      it('mounts multi-level duplicates ["/api/v1", "/api/v1/", "//api//v1", "api/v1//"] idempotently', () => {
        const subRouter = createRouter();
        const handler = vi.fn();
        subRouter.get('/data', handler);

        expect(() => {
          router.mount(['/api/v1', '/api/v1/', '//api//v1', 'api/v1//'], subRouter);
        }).not.toThrow();

        const match = router.match('GET', '/api/v1/data');
        expect(match?.handler).toBe(handler);
      });

      it('mounts mixed root duplicates ["///", "/", "//"] idempotently', () => {
        const subRouter = createRouter();
        const handler = vi.fn();
        subRouter.get('/health', handler);

        expect(() => {
          router.mount(['///', '/', '//'], subRouter);
        }).not.toThrow();

        const match = router.match('GET', '/health');
        expect(match?.handler).toBe(handler);
      });
    });

    describe('6.3 Empty Prefix Strings & Root Prefixes', () => {
      it('throws synchronous TypeError on [""] in mount() and use()', () => {
        const subRouter = createRouter();
        expect(() => {
          router.mount([''], subRouter);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));

        expect(() => {
          router.use([''], subRouter);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
      });

      it('throws synchronous TypeError on ["/api", ""] and maintains atomic integrity', () => {
        const subRouter = createRouter();
        subRouter.get('/secret', vi.fn());

        expect(() => {
          router.mount(['/api', ''], subRouter);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));

        // Prefix /api/secret must NOT be present in the trie
        expect(router.match('GET', '/api/secret')).toBeNull();
      });

      it('mounts root alongside sub-prefix: ["/api", "/"] and vice versa', () => {
        const routerA = createRouter();
        const subRouterA = createRouter();
        const handlerA = vi.fn();
        subRouterA.get('/check', handlerA);

        routerA.mount(['/api', '/'], subRouterA);
        expect(routerA.match('GET', '/api/check')?.handler).toBe(handlerA);
        expect(routerA.match('GET', '/check')?.handler).toBe(handlerA);

        const routerB = createRouter();
        const subRouterB = createRouter();
        const handlerB = vi.fn();
        subRouterB.get('/check', handlerB);

        routerB.mount(['/', '/api'], subRouterB);
        expect(routerB.match('GET', '/check')?.handler).toBe(handlerB);
        expect(routerB.match('GET', '/api/check')?.handler).toBe(handlerB);
      });
    });

    describe('6.4 Rejection of Non-Router Instances', () => {
      it('throws TypeError when Routable is not an instance of Router', () => {
        expect(() => {
          router.mount(['/api'], {} as unknown as Router);
        }).toThrow(new TypeError('router.mount() requires a Router instance'));

        expect(() => {
          router.mount(['/api'], { routes: () => {} } as unknown as Router);
        }).toThrow(new TypeError('router.mount() requires a Router instance'));
      });
    });

    describe('6.5 Order of Prefix Evaluation, Middleware, and Groups', () => {
      it('applies sub-router middleware across all multi-prefix mounted routes during dispatch', async () => {
        const subRouter = createRouter();
        const mwOrder: string[] = [];

        subRouter.use(async (_ctx, next) => {
          mwOrder.push('sub-mw');
          if (next) await next();
        });

        subRouter.get('/profile', async (ctx) => {
          mwOrder.push('handler');
          ctx.status = 200;
        });

        router.mount(['/v1', '/v2'], subRouter);

        const dispatchMw = router.routes();

        // 1. Dispatch to /v1/profile
        mwOrder.length = 0;
        const mockCtx1 = {
          method: 'GET',
          path: '/v1/profile',
          status: 404,
          params: {},
          state: {},
        };
        await dispatchMw(mockCtx1 as never);
        expect(mwOrder).toEqual(['sub-mw', 'handler']);
        expect(mockCtx1.status).toBe(200);

        // 2. Dispatch to /v2/profile
        mwOrder.length = 0;
        const mockCtx2 = {
          method: 'GET',
          path: '/v2/profile',
          status: 404,
          params: {},
          state: {},
        };
        await dispatchMw(mockCtx2 as never);
        expect(mwOrder).toEqual(['sub-mw', 'handler']);
        expect(mockCtx2.status).toBe(200);
      });

      it('combines route groups with multi-prefix mounting', () => {
        const groupRouter = createRouter();
        const dashHandler = vi.fn();
        groupRouter.group('/admin', (g) => {
          g.get('/dashboard', dashHandler);
        });

        router.mount(['/app', '/console'], groupRouter);

        expect(router.match('GET', '/app/admin/dashboard')?.handler).toBe(dashHandler);
        expect(router.match('GET', '/console/admin/dashboard')?.handler).toBe(dashHandler);
        expect(router.match('GET', '/admin/dashboard')).toBeNull();
      });

      it('correctly dispatches across multiple subrouters mounted on overlapping prefixes', () => {
        const sub1 = createRouter();
        const handlerV1 = vi.fn();
        sub1.get('/users', handlerV1);

        const sub2 = createRouter();
        const handlerGeneral = vi.fn();
        sub2.get('/health', handlerGeneral);

        router.mount(['/api/v1', '/api/v2'], sub1);
        router.mount(['/api'], sub2);

        expect(router.match('GET', '/api/v1/users')?.handler).toBe(handlerV1);
        expect(router.match('GET', '/api/v2/users')?.handler).toBe(handlerV1);
        expect(router.match('GET', '/api/health')?.handler).toBe(handlerGeneral);
      });
    });
  });
});
