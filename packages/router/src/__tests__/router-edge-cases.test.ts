/**
 * @nextrush/router - Edge Case Tests
 *
 * Comprehensive tests for edge cases, special characters,
 * unicode, overlapping routes, and performance scenarios.
 */

import type { Context, HttpMethod, RouteHandler } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

/**
 * Create mock context for testing
 */
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

describe('Router Edge Cases', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('Special Characters in Paths', () => {
    it('should handle hyphens in path segments', () => {
      router.get('/my-api/user-profile', vi.fn());
      expect(router.match('GET', '/my-api/user-profile')).not.toBeNull();
    });

    it('should handle underscores in path segments', () => {
      router.get('/my_api/user_profile', vi.fn());
      expect(router.match('GET', '/my_api/user_profile')).not.toBeNull();
    });

    it('should handle dots in path segments', () => {
      router.get('/api/v1.0/users', vi.fn());
      expect(router.match('GET', '/api/v1.0/users')).not.toBeNull();
    });

    it('should handle tildes in path segments', () => {
      router.get('/~user/home', vi.fn());
      expect(router.match('GET', '/~user/home')).not.toBeNull();
    });

    it('should handle mixed special characters', () => {
      router.get('/api-v1_test.route~special', vi.fn());
      expect(router.match('GET', '/api-v1_test.route~special')).not.toBeNull();
    });
  });

  describe('Special Characters in Parameters', () => {
    it('should extract parameters with hyphens', () => {
      router.get('/users/:id', vi.fn());
      const match = router.match('GET', '/users/user-123-abc');
      expect(match?.params.id).toBe('user-123-abc');
    });

    it('should extract parameters with underscores', () => {
      router.get('/files/:name', vi.fn());
      const match = router.match('GET', '/files/my_file_name');
      expect(match?.params.name).toBe('my_file_name');
    });

    it('should extract parameters with dots', () => {
      router.get('/files/:filename', vi.fn());
      const match = router.match('GET', '/files/document.pdf');
      expect(match?.params.filename).toBe('document.pdf');
    });

    it('should extract URL-encoded special characters', () => {
      router.get('/search/:query', vi.fn());
      const match = router.match('GET', '/search/hello%20world');
      expect(match?.params.query).toBe('hello%20world');
    });

    it('should extract parameters with plus signs', () => {
      router.get('/calc/:expr', vi.fn());
      const match = router.match('GET', '/calc/1+2');
      expect(match?.params.expr).toBe('1+2');
    });
  });

  describe('Unicode and International Characters', () => {
    it('should handle unicode in static paths', () => {
      router.get('/api/日本語', vi.fn());
      expect(router.match('GET', '/api/日本語')).not.toBeNull();
    });

    it('should handle emoji in paths', () => {
      router.get('/emoji/🚀', vi.fn());
      expect(router.match('GET', '/emoji/🚀')).not.toBeNull();
    });

    it('should extract unicode parameters', () => {
      router.get('/users/:name', vi.fn());
      const match = router.match('GET', '/users/田中');
      expect(match?.params.name).toBe('田中');
    });

    it('should handle cyrillic characters', () => {
      router.get('/привет/:имя', vi.fn());
      expect(router.match('GET', '/привет/мир')).not.toBeNull();
    });

    it('should handle arabic characters', () => {
      router.get('/مرحبا/:اسم', vi.fn());
      expect(router.match('GET', '/مرحبا/عالم')).not.toBeNull();
    });
  });

  describe('Deeply Nested Routes', () => {
    it('should handle 5 levels of nesting', () => {
      router.get('/a/b/c/d/e', vi.fn());
      expect(router.match('GET', '/a/b/c/d/e')).not.toBeNull();
    });

    it('should handle 10 levels of nesting', () => {
      router.get('/1/2/3/4/5/6/7/8/9/10', vi.fn());
      expect(router.match('GET', '/1/2/3/4/5/6/7/8/9/10')).not.toBeNull();
    });

    it('should handle deeply nested parameters', () => {
      router.get('/org/:orgId/team/:teamId/project/:projectId/task/:taskId', vi.fn());
      const match = router.match('GET', '/org/1/team/2/project/3/task/4');
      expect(match?.params).toEqual({
        orgid: '1',
        teamid: '2',
        projectid: '3',
        taskid: '4',
      });
    });

    it('should handle mixed static and param segments at depth', () => {
      router.get('/api/v1/users/:userId/posts/:postId/comments/:commentId/replies', vi.fn());
      const match = router.match('GET', '/api/v1/users/u1/posts/p2/comments/c3/replies');
      expect(match).not.toBeNull();
      expect(match?.params).toEqual({
        userid: 'u1',
        postid: 'p2',
        commentid: 'c3',
      });
    });
  });

  describe('Overlapping Routes', () => {
    it('should prefer static over param at same position', () => {
      const staticHandler = vi.fn();
      const paramHandler = vi.fn();

      router.get('/users/profile', staticHandler);
      router.get('/users/:id', paramHandler);

      const staticMatch = router.match('GET', '/users/profile');
      const paramMatch = router.match('GET', '/users/123');

      expect(staticMatch?.handler).toBe(staticHandler);
      expect(paramMatch?.handler).toBe(paramHandler);
    });

    it('should handle multiple param routes at different levels', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      router.get('/users/:id', handler1);
      router.get('/users/:id/posts', handler2);

      expect(router.match('GET', '/users/123')?.handler).toBe(handler1);
      expect(router.match('GET', '/users/123/posts')?.handler).toBe(handler2);
    });

    it('should differentiate similar patterns', () => {
      const userHandler = vi.fn();
      const postHandler = vi.fn();

      router.get('/users/:userId/profile', userHandler);
      router.get('/users/:userId/settings', postHandler);

      expect(router.match('GET', '/users/1/profile')?.handler).toBe(userHandler);
      expect(router.match('GET', '/users/1/settings')?.handler).toBe(postHandler);
    });

    it('should handle overlapping wildcards', () => {
      const apiHandler = vi.fn();
      const catchAllHandler = vi.fn();

      router.get('/api/*', apiHandler);
      router.get('/*', catchAllHandler);

      // More specific wildcard wins
      expect(router.match('GET', '/api/anything')?.handler).toBe(apiHandler);
      expect(router.match('GET', '/other/path')?.handler).toBe(catchAllHandler);
    });
  });

  describe('Empty and Edge Paths', () => {
    it('should handle root path', () => {
      router.get('/', vi.fn());
      expect(router.match('GET', '/')).not.toBeNull();
    });

    it('should handle empty string path', () => {
      router.get('', vi.fn());
      expect(router.match('GET', '/')).not.toBeNull();
    });

    it('should normalize multiple slashes', () => {
      router.get('/api/users', vi.fn());
      // Double slashes are normalized - this is the correct behavior
      // Most web servers normalize //api//users to /api/users
      expect(router.match('GET', '/api//users')).not.toBeNull();
    });

    it('should handle paths ending with slash (non-strict)', () => {
      router.get('/users', vi.fn());
      expect(router.match('GET', '/users/')).not.toBeNull();
    });
  });

  describe('Wildcard Edge Cases', () => {
    it('should capture entire remaining path in wildcard', () => {
      router.get('/files/*', vi.fn());
      const match = router.match('GET', '/files/a/b/c/d/e.txt');
      expect(match?.params['*']).toBe('a/b/c/d/e.txt');
    });

    it('should handle wildcard with single segment', () => {
      router.get('/catch/*', vi.fn());
      const match = router.match('GET', '/catch/single');
      expect(match?.params['*']).toBe('single');
    });

    it('should handle wildcard with special characters', () => {
      router.get('/assets/*', vi.fn());
      const match = router.match('GET', '/assets/images/logo-v2.png');
      expect(match?.params['*']).toBe('images/logo-v2.png');
    });

    it('should not match wildcard if path ends at parent', () => {
      router.get('/files/*', vi.fn());
      // Path doesn't have anything after /files
      expect(router.match('GET', '/files')).toBeNull();
    });
  });

  describe('Many Routes Performance', () => {
    it('should handle 100 routes efficiently', () => {
      for (let i = 0; i < 100; i++) {
        router.get(`/route${i}`, vi.fn());
      }

      // All routes should be matchable
      for (let i = 0; i < 100; i++) {
        expect(router.match('GET', `/route${i}`)).not.toBeNull();
      }
    });

    it('should handle 100 param routes efficiently', () => {
      for (let i = 0; i < 100; i++) {
        router.get(`/entity${i}/:id`, vi.fn());
      }

      for (let i = 0; i < 100; i++) {
        const match = router.match('GET', `/entity${i}/123`);
        expect(match).not.toBeNull();
        expect(match?.params.id).toBe('123');
      }
    });
  });

  describe('Method Handling', () => {
    it('should differentiate GET and POST on same path', () => {
      const getHandler = vi.fn();
      const postHandler = vi.fn();

      router.get('/api/data', getHandler);
      router.post('/api/data', postHandler);

      expect(router.match('GET', '/api/data')?.handler).toBe(getHandler);
      expect(router.match('POST', '/api/data')?.handler).toBe(postHandler);
    });

    it('should handle HEAD method', () => {
      router.head('/api/check', vi.fn());
      expect(router.match('HEAD', '/api/check')).not.toBeNull();
    });

    it('should handle OPTIONS method', () => {
      router.options('/api/cors', vi.fn());
      expect(router.match('OPTIONS', '/api/cors')).not.toBeNull();
    });

    it('should return null for unregistered method', () => {
      router.get('/api/only-get', vi.fn());
      expect(router.match('DELETE', '/api/only-get')).toBeNull();
    });
  });

  describe('Route Chaining', () => {
    it('should support fluent API', () => {
      const result = router
        .get('/a', vi.fn())
        .post('/b', vi.fn())
        .put('/c', vi.fn())
        .delete('/d', vi.fn())
        .patch('/e', vi.fn())
        .head('/f', vi.fn())
        .options('/g', vi.fn());

      expect(result).toBe(router);
      expect(router.match('GET', '/a')).not.toBeNull();
      expect(router.match('POST', '/b')).not.toBeNull();
      expect(router.match('PUT', '/c')).not.toBeNull();
      expect(router.match('DELETE', '/d')).not.toBeNull();
      expect(router.match('PATCH', '/e')).not.toBeNull();
      expect(router.match('HEAD', '/f')).not.toBeNull();
      expect(router.match('OPTIONS', '/g')).not.toBeNull();
    });
  });

  describe('Prefix Edge Cases', () => {
    it('should handle prefix with trailing slash', () => {
      const r = createRouter({ prefix: '/api/' });
      r.get('/users', vi.fn());
      expect(r.match('GET', '/api/users')).not.toBeNull();
    });

    it('should handle prefix without leading slash', () => {
      const r = createRouter({ prefix: 'api' });
      r.get('/users', vi.fn());
      expect(r.match('GET', '/api/users')).not.toBeNull();
    });

    it('should handle nested prefixes', () => {
      const r = createRouter({ prefix: '/api/v1' });
      r.get('/users/:id', vi.fn());
      const match = r.match('GET', '/api/v1/users/123');
      expect(match).not.toBeNull();
      expect(match?.params.id).toBe('123');
    });
  });

  describe('Middleware Chain', () => {
    it('should execute middleware in order', async () => {
      const order: number[] = [];

      const mw1: RouteHandler = async (_ctx, next) => {
        order.push(1);
        if (next) await next();
        order.push(4);
      };

      const mw2: RouteHandler = async (_ctx, next) => {
        order.push(2);
        if (next) await next();
        order.push(3);
      };

      const handler: RouteHandler = async () => {
        order.push(0);
      };

      router.get('/chain', mw1, mw2, handler);

      const ctx = createMockContext({ method: 'GET', path: '/chain' });
      await router.routes()(ctx, async () => {});

      // Middleware should execute before handler
      expect(order).toEqual([1, 2, 0, 3, 4]);
    });
  });

  describe('Sub-Router Mounting', () => {
    it('should mount sub-router at prefix', () => {
      const subRouter = createRouter();
      subRouter.get('/items', vi.fn());
      subRouter.get('/items/:id', vi.fn());

      router.use('/api', subRouter);

      expect(router.match('GET', '/api/items')).not.toBeNull();
      expect(router.match('GET', '/api/items/123')).not.toBeNull();
    });

    it('should preserve sub-router params', () => {
      const subRouter = createRouter();
      subRouter.get('/:itemId', vi.fn());

      router.use('/items', subRouter);

      const match = router.match('GET', '/items/456');
      expect(match?.params.itemid).toBe('456');
    });
  });
});
