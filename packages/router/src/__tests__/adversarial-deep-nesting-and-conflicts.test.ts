/**
 * @nextrush/router - Adversarial Deep Nesting & Route Conflicts Verification
 *
 * Empirical challenger test suite verifying:
 * 1. Deep Nesting: Multi-prefix sub-routers mounted inside multi-prefix sub-routers (3+ levels).
 * 2. Parameter Extraction & Wildcards: Parameter binding and wildcard resolution across all mounted prefixes.
 * 3. Route Conflicts: Verifying true conflicts throw "Route conflict" while distinct multi-prefixes do NOT trigger false positives.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

describe('Empirical Challenger: Deep Nesting & Route Conflicts Verification', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('1. Deep Nesting with Multi-Prefixes Across Multiple Levels', () => {
    it('accurately compiles and dispatches a 3-level deep hierarchy where all levels use multi-prefixes', () => {
      // Level 3 (leaf)
      const leafRouter = createRouter();
      const pingHandler = vi.fn();
      const userHandler = vi.fn();
      const wildcardHandler = vi.fn();

      leafRouter.get('/ping', pingHandler);
      leafRouter.get('/users/:userId', userHandler);
      leafRouter.get('/files/*', wildcardHandler);

      // Level 2 (child) - mounts leaf at 2 prefixes
      const childRouter = createRouter();
      childRouter.mount(['/sub1', '/sub2'], leafRouter);

      // Level 1 (parent) - mounts child at 2 prefixes
      const parentRouter = createRouter();
      parentRouter.mount(['/tenantA', '/tenantB'], childRouter);

      // Level 0 (top/root) - mounts parent at 2 prefixes
      router.mount(['/api', '/v1'], parentRouter);

      // Total route combinations: 2 * 2 * 2 = 8 combinations per leaf endpoint
      const topPrefixes = ['/api', '/v1'];
      const parentPrefixes = ['/tenantA', '/tenantB'];
      const childPrefixes = ['/sub1', '/sub2'];

      for (const top of topPrefixes) {
        for (const parent of parentPrefixes) {
          for (const child of childPrefixes) {
            const basePath = `${top}${parent}${child}`;

            // 1. Static route
            const pingMatch = router.match('GET', `${basePath}/ping`);
            expect(pingMatch, `Expected match for ${basePath}/ping`).not.toBeNull();
            expect(pingMatch?.handler).toBe(pingHandler);

            // 2. Param route
            const userMatch = router.match('GET', `${basePath}/users/usr_99`);
            expect(userMatch, `Expected match for ${basePath}/users/usr_99`).not.toBeNull();
            expect(userMatch?.handler).toBe(userHandler);
            expect(userMatch?.params.userId).toBe('usr_99');

            // 3. Wildcard route
            const wildMatch = router.match('GET', `${basePath}/files/images/banner.png`);
            expect(wildMatch, `Expected match for ${basePath}/files/images/banner.png`).not.toBeNull();
            expect(wildMatch?.handler).toBe(wildcardHandler);
            expect(wildMatch?.params['*']).toBe('images/banner.png');
          }
        }
      }

      // Negative check: wrong combination or partial path
      expect(router.match('GET', '/api/tenantA/ping')).toBeNull();
      expect(router.match('GET', '/api/sub1/ping')).toBeNull();
      expect(router.match('GET', '/tenantA/sub1/ping')).toBeNull();
    });

    it('propagates middleware across all 4 levels in strict order: top -> parent -> child -> leaf', async () => {
      const topRouter = createRouter();
      const parentRouter = createRouter();
      const childRouter = createRouter();
      const leafRouter = createRouter();

      const sequence: string[] = [];

      topRouter.use(async (_ctx, next) => {
        sequence.push('top:enter');
        if (next) await next();
        sequence.push('top:exit');
      });

      parentRouter.use(async (_ctx, next) => {
        sequence.push('parent:enter');
        if (next) await next();
        sequence.push('parent:exit');
      });

      childRouter.use(async (_ctx, next) => {
        sequence.push('child:enter');
        if (next) await next();
        sequence.push('child:exit');
      });

      leafRouter.use(async (_ctx, next) => {
        sequence.push('leaf:enter');
        if (next) await next();
        sequence.push('leaf:exit');
      });

      leafRouter.get('/action', async () => {
        sequence.push('handler:action');
      });

      childRouter.mount(['/c1', '/c2'], leafRouter);
      parentRouter.mount(['/p1', '/p2'], childRouter);
      topRouter.mount(['/top1', '/top2'], parentRouter);
      topRouter.routes(); // Seals top-level router middleware into route executors

      // Verify execution order on one of the 8 combinatorial paths
      const match = topRouter.match('GET', '/top2/p1/c2/action');
      expect(match).not.toBeNull();

      if (match) {
        const dummyCtx = {} as any;
        await match.executor(dummyCtx);
        expect(sequence).toEqual([
          'top:enter',
          'parent:enter',
          'child:enter',
          'leaf:enter',
          'handler:action',
          'leaf:exit',
          'child:exit',
          'parent:exit',
          'top:exit',
        ]);
      }
    });

    it('supports multiple sibling branches in deep nesting without cross-contamination', () => {
      const authLeaf = createRouter();
      const authHandler = vi.fn();
      authLeaf.get('/token', authHandler);

      const billingLeaf = createRouter();
      const billingHandler = vi.fn();
      billingLeaf.get('/invoice', billingHandler);

      const authSub = createRouter();
      authSub.mount(['/oauth', '/saml'], authLeaf);

      const billingSub = createRouter();
      billingSub.mount(['/stripe', '/paypal'], billingLeaf);

      const v1Router = createRouter();
      v1Router.mount(['/auth', '/security'], authSub);
      v1Router.mount(['/billing', '/finance'], billingSub);

      router.mount(['/api', '/public'], v1Router);

      // Check auth combinations
      expect(router.match('GET', '/api/auth/oauth/token')?.handler).toBe(authHandler);
      expect(router.match('GET', '/api/security/saml/token')?.handler).toBe(authHandler);
      expect(router.match('GET', '/public/auth/oauth/token')?.handler).toBe(authHandler);
      expect(router.match('GET', '/public/security/saml/token')?.handler).toBe(authHandler);

      // Check billing combinations
      expect(router.match('GET', '/api/billing/stripe/invoice')?.handler).toBe(billingHandler);
      expect(router.match('GET', '/api/finance/paypal/invoice')?.handler).toBe(billingHandler);
      expect(router.match('GET', '/public/billing/stripe/invoice')?.handler).toBe(billingHandler);
      expect(router.match('GET', '/public/finance/paypal/invoice')?.handler).toBe(billingHandler);

      // Cross-checks: sibling paths must not be crossed
      expect(router.match('GET', '/api/auth/stripe/invoice')).toBeNull();
      expect(router.match('GET', '/api/billing/oauth/token')).toBeNull();
    });

    it('handles root prefix ["/"] combined with other prefixes in deep hierarchy', () => {
      const leaf = createRouter();
      const leafHandler = vi.fn();
      leaf.get('/ping', leafHandler);

      const child = createRouter();
      child.mount(['/', '/sub'], leaf);

      const parent = createRouter();
      parent.mount(['/api', '/'], child);

      router.mount(['/', '/v1'], parent);

      // Routes produced:
      // router at / and /v1
      // parent at /api and /
      // child at / and /sub
      //
      // Paths for ping:
      // /v1/api/sub/ping
      // /v1/api/ping
      // /v1/sub/ping
      // /v1/ping
      // /api/sub/ping
      // /api/ping
      // /sub/ping
      // /ping

      expect(router.match('GET', '/v1/api/sub/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/v1/api/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/v1/sub/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/v1/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/api/sub/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/api/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/sub/ping')?.handler).toBe(leafHandler);
      expect(router.match('GET', '/ping')?.handler).toBe(leafHandler);
    });
  });

  describe('2. Parameter Extraction & Wildcards across Multi-Prefixes', () => {
    it('extracts multi-level parameters across all mounted prefixes', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/orgs/:orgId/teams/:teamId/members/:memberId', handler);

      const prefixes = ['/api', '/v1', '/enterprise/v2'];
      router.mount(prefixes, subRouter);

      for (const prefix of prefixes) {
        const match = router.match(
          'GET',
          `${prefix}/orgs/acme-corp/teams/backend-devs/members/usr_42`
        );
        expect(match, `Expected match for prefix ${prefix}`).not.toBeNull();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({
          orgId: 'acme-corp',
          teamId: 'backend-devs',
          memberId: 'usr_42',
        });
      }
    });

    it('matches and extracts wildcards across all mounted prefixes', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/static/*', handler);

      const prefixes = ['/cdn', '/public', '/assets/cached'];
      router.mount(prefixes, subRouter);

      for (const prefix of prefixes) {
        const match1 = router.match('GET', `${prefix}/static/app.js`);
        expect(match1).not.toBeNull();
        expect(match1?.params['*']).toBe('app.js');

        const match2 = router.match('GET', `${prefix}/static/nested/deep/theme.min.css`);
        expect(match2).not.toBeNull();
        expect(match2?.params['*']).toBe('nested/deep/theme.min.css');
      }
    });

    it('combines parameters and wildcards in the same route across all mounted prefixes', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/repos/:owner/:repo/blobs/*', handler);

      const prefixes = ['/git', '/v1/git'];
      router.mount(prefixes, subRouter);

      for (const prefix of prefixes) {
        const match = router.match('GET', `${prefix}/repos/nextrush/core/blobs/main/src/index.ts`);
        expect(match).not.toBeNull();
        expect(match?.handler).toBe(handler);
        expect(match?.params.owner).toBe('nextrush');
        expect(match?.params.repo).toBe('core');
        expect(match?.params['*']).toBe('main/src/index.ts');
      }
    });

    it('preserves parameter extraction when mount prefixes contain parameters themselves', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/settings', handler);

      // Mount prefixes with parameters
      router.mount(['/users/:userId', '/accounts/:userId'], subRouter);

      const userMatch = router.match('GET', '/users/usr_100/settings');
      expect(userMatch).not.toBeNull();
      expect(userMatch?.handler).toBe(handler);
      expect(userMatch?.params.userId).toBe('usr_100');

      const accountMatch = router.match('GET', '/accounts/acc_200/settings');
      expect(accountMatch).not.toBeNull();
      expect(accountMatch?.handler).toBe(handler);
      expect(accountMatch?.params.userId).toBe('acc_200');
    });

    it('decodes URI-encoded values in parameters identically across all mounted prefixes', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/search/:query', handler);

      const prefixes = ['/api', '/v1'];
      router.mount(prefixes, subRouter);

      for (const prefix of prefixes) {
        // Space as %20
        const matchSpace = router.match('GET', `${prefix}/search/hello%20world`);
        expect(matchSpace?.params.query).toBe('hello world');

        // At sign as %40
        const matchEmail = router.match('GET', `${prefix}/search/user%40test.com`);
        expect(matchEmail?.params.query).toBe('user@test.com');

        // Plus character %2B
        const matchPlus = router.match('GET', `${prefix}/search/c%2B%2B`);
        expect(matchPlus?.params.query).toBe('c++');
      }
    });
  });

  describe('3. Route Conflict Detection: True Positives vs False Positives', () => {
    describe('False Conflict Prevention (Must NOT throw)', () => {
      it('does NOT conflict when mounting distinct routes on identical multi-prefixes', () => {
        const subA = createRouter();
        subA.get('/users', vi.fn());

        const subB = createRouter();
        subB.get('/posts', vi.fn());

        expect(() => {
          router.mount(['/api', '/v1'], subA);
          router.mount(['/api', '/v1'], subB);
        }).not.toThrow();

        expect(router.match('GET', '/api/users')).not.toBeNull();
        expect(router.match('GET', '/v1/users')).not.toBeNull();
        expect(router.match('GET', '/api/posts')).not.toBeNull();
        expect(router.match('GET', '/v1/posts')).not.toBeNull();
      });

      it('does NOT conflict with sibling overlapping prefixes: ["/api", "/api/v1", "/api/v2"]', () => {
        const sub = createRouter();
        sub.get('/data', vi.fn());

        expect(() => {
          router.mount(['/api', '/api/v1', '/api/v2'], sub);
        }).not.toThrow();

        expect(router.match('GET', '/api/data')).not.toBeNull();
        expect(router.match('GET', '/api/v1/data')).not.toBeNull();
        expect(router.match('GET', '/api/v2/data')).not.toBeNull();
      });

      it('does NOT conflict when registering different HTTP methods on identical mounted paths', () => {
        const subA = createRouter();
        subA.get('/items', vi.fn());

        const subB = createRouter();
        subB.post('/items', vi.fn());

        const subC = createRouter();
        subC.delete('/items', vi.fn());

        expect(() => {
          router.mount(['/api', '/v1'], subA);
          router.mount(['/api', '/v1'], subB);
          router.mount(['/api', '/v1'], subC);
        }).not.toThrow();

        expect(router.match('GET', '/api/items')).not.toBeNull();
        expect(router.match('POST', '/api/items')).not.toBeNull();
        expect(router.match('DELETE', '/api/items')).not.toBeNull();
        expect(router.match('GET', '/v1/items')).not.toBeNull();
        expect(router.match('POST', '/v1/items')).not.toBeNull();
        expect(router.match('DELETE', '/v1/items')).not.toBeNull();
      });

      it('does NOT conflict when explicit HEAD is mounted alongside GET autoHead', () => {
        const sub = createRouter();
        sub.get('/status', vi.fn());
        sub.head('/status', vi.fn()); // explicit HEAD replaces autoHead

        expect(() => {
          router.mount(['/api', '/v1'], sub);
        }).not.toThrow();

        expect(router.match('HEAD', '/api/status')).not.toBeNull();
        expect(router.match('HEAD', '/v1/status')).not.toBeNull();
      });
    });

    describe('True Conflict Detection (MUST throw Route conflict)', () => {
      it('throws Route conflict when two sub-routers register the exact same route on the same mounted prefix', () => {
        const subA = createRouter();
        subA.get('/users', vi.fn());

        const subB = createRouter();
        subB.get('/users', vi.fn());

        router.mount(['/api', '/v1'], subA);

        expect(() => {
          router.mount(['/v1', '/v2'], subB);
        }).toThrow(/Route conflict: GET \/v1\/users is already registered/);
      });

      it('throws Route conflict when overlapping relative prefixes collide with mount prefixes', () => {
        const subA = createRouter();
        subA.get('/v2/items', vi.fn()); // Effective: /api/v2/items

        const subB = createRouter();
        subB.get('/items', vi.fn()); // When mounted at /api/v2 -> /api/v2/items

        router.mount(['/api'], subA);

        expect(() => {
          router.mount(['/api/v2'], subB);
        }).toThrow(/Route conflict: GET \/api\/v2\/items is already registered/);
      });

      it('throws Route conflict when a directly registered route collides with a subsequently mounted route', () => {
        router.get('/api/users', vi.fn());

        const sub = createRouter();
        sub.get('/users', vi.fn());

        expect(() => {
          router.mount(['/api', '/v1'], sub);
        }).toThrow(/Route conflict: GET \/api\/users is already registered/);
      });

      it('throws Route conflict when a mounted route collides with a subsequently registered direct route', () => {
        const sub = createRouter();
        sub.get('/users', vi.fn());

        router.mount(['/api', '/v1'], sub);

        expect(() => {
          router.get('/v1/users', vi.fn());
        }).toThrow(/Route conflict: GET \/v1\/users is already registered/);
      });

      it('throws Route param name conflict when mounted sub-routers have mismatched param names at the same position', () => {
        const subA = createRouter();
        subA.get('/users/:userId', vi.fn());

        const subB = createRouter();
        subB.get('/users/:id', vi.fn());

        router.mount(['/api'], subA);

        expect(() => {
          router.mount(['/api'], subB);
        }).toThrow(/Route param name conflict at "\/api\/users\/:id": ":id" conflicts with existing ":userId"/);
      });

      it('throws Route conflict in deeply nested sub-router hierarchies when a collision occurs', () => {
        const leafA = createRouter();
        leafA.get('/health', vi.fn());

        const leafB = createRouter();
        leafB.get('/health', vi.fn());

        const midA = createRouter();
        midA.mount(['/svc1', '/svc2'], leafA);

        const midB = createRouter();
        midB.mount(['/svc2', '/svc3'], leafB);

        router.mount(['/api'], midA);

        expect(() => {
          router.mount(['/api'], midB);
        }).toThrow(/Route conflict: GET \/api\/svc2\/health is already registered/);
      });
    });
  });
});
