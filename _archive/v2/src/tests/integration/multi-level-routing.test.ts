/**
 * Integration tests for multi-level routing patterns
 *
 * Tests real-world scenarios with complex route patterns and parameter extraction
 */

import { OptimizedRouter } from '@/core/router/optimized-router';
import type { Context } from '@/types/context';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Multi-Level Routing Integration', () => {
  let router: OptimizedRouter;

  beforeEach(() => {
    router = new OptimizedRouter();
  });

  describe('Real-World API Patterns', () => {
    it('should handle RESTful API with nested resources', async () => {
      // Simulate a real RESTful API structure
      const userHandler = async (ctx: Context) => {
        ctx.res.json({
          userId: ctx.params['userId'],
          action: 'get-user',
        });
      };

      const userPostsHandler = async (ctx: Context) => {
        ctx.res.json({
          userId: ctx.params['userId'],
          action: 'get-user-posts',
        });
      };

      const userPostHandler = async (ctx: Context) => {
        ctx.res.json({
          userId: ctx.params['userId'],
          postId: ctx.params['postId'],
          action: 'get-user-post',
        });
      };

      const postCommentsHandler = async (ctx: Context) => {
        ctx.res.json({
          userId: ctx.params['userId'],
          postId: ctx.params['postId'],
          action: 'get-post-comments',
        });
      };

      const postCommentHandler = async (ctx: Context) => {
        ctx.res.json({
          userId: ctx.params['userId'],
          postId: ctx.params['postId'],
          commentId: ctx.params['commentId'],
          action: 'get-post-comment',
        });
      };

      // Register nested RESTful routes
      router.get('/api/users/:userId', userHandler);
      router.get('/api/users/:userId/posts', userPostsHandler);
      router.get('/api/users/:userId/posts/:postId', userPostHandler);
      router.get(
        '/api/users/:userId/posts/:postId/comments',
        postCommentsHandler
      );
      router.get(
        '/api/users/:userId/posts/:postId/comments/:commentId',
        postCommentHandler
      );

      // Test each level
      const userMatch = router.find('GET', '/api/users/john123');
      expect(userMatch?.handler).toBe(userHandler);
      expect(userMatch?.params).toEqual({ userId: 'john123' });

      const userPostsMatch = router.find('GET', '/api/users/john123/posts');
      expect(userPostsMatch?.handler).toBe(userPostsHandler);
      expect(userPostsMatch?.params).toEqual({ userId: 'john123' });

      const userPostMatch = router.find(
        'GET',
        '/api/users/john123/posts/post456'
      );
      expect(userPostMatch?.handler).toBe(userPostHandler);
      expect(userPostMatch?.params).toEqual({
        userId: 'john123',
        postId: 'post456',
      });

      const postCommentsMatch = router.find(
        'GET',
        '/api/users/john123/posts/post456/comments'
      );
      expect(postCommentsMatch?.handler).toBe(postCommentsHandler);
      expect(postCommentsMatch?.params).toEqual({
        userId: 'john123',
        postId: 'post456',
      });

      const postCommentMatch = router.find(
        'GET',
        '/api/users/john123/posts/post456/comments/comment789'
      );
      expect(postCommentMatch?.handler).toBe(postCommentHandler);
      expect(postCommentMatch?.params).toEqual({
        userId: 'john123',
        postId: 'post456',
        commentId: 'comment789',
      });
    });

    it('should handle e-commerce product catalog patterns', async () => {
      const categoryHandler = async (ctx: Context) => {
        ctx.res.json({ category: ctx.params['category'] });
      };

      const subcategoryHandler = async (ctx: Context) => {
        ctx.res.json({
          category: ctx.params['category'],
          subcategory: ctx.params['subcategory'],
        });
      };

      const productHandler = async (ctx: Context) => {
        ctx.res.json({
          category: ctx.params['category'],
          subcategory: ctx.params['subcategory'],
          productId: ctx.params['productId'],
        });
      };

      const productVariantHandler = async (ctx: Context) => {
        ctx.res.json({
          category: ctx.params['category'],
          subcategory: ctx.params['subcategory'],
          productId: ctx.params['productId'],
          variantId: ctx.params['variantId'],
        });
      };

      // E-commerce routes
      router.get('/catalog/:category', categoryHandler);
      router.get('/catalog/:category/:subcategory', subcategoryHandler);
      router.get(
        '/catalog/:category/:subcategory/products/:productId',
        productHandler
      );
      router.get(
        '/catalog/:category/:subcategory/products/:productId/variants/:variantId',
        productVariantHandler
      );

      // Test e-commerce routes
      const categoryMatch = router.find('GET', '/catalog/electronics');
      expect(categoryMatch?.params).toEqual({ category: 'electronics' });

      const subcategoryMatch = router.find(
        'GET',
        '/catalog/electronics/laptops'
      );
      expect(subcategoryMatch?.params).toEqual({
        category: 'electronics',
        subcategory: 'laptops',
      });

      const productMatch = router.find(
        'GET',
        '/catalog/electronics/laptops/products/macbook-pro-2024'
      );
      expect(productMatch?.params).toEqual({
        category: 'electronics',
        subcategory: 'laptops',
        productId: 'macbook-pro-2024',
      });

      const variantMatch = router.find(
        'GET',
        '/catalog/electronics/laptops/products/macbook-pro-2024/variants/16gb-512gb'
      );
      expect(variantMatch?.params).toEqual({
        category: 'electronics',
        subcategory: 'laptops',
        productId: 'macbook-pro-2024',
        variantId: '16gb-512gb',
      });
    });

    it('should handle file system-like paths', async () => {
      const folderHandler = async (ctx: Context) => {
        ctx.res.json({
          org: ctx.params['org'],
          repo: ctx.params['repo'],
          branch: ctx.params['branch'],
          action: 'browse-folder',
        });
      };

      const fileHandler = async (ctx: Context) => {
        ctx.res.json({
          org: ctx.params['org'],
          repo: ctx.params['repo'],
          branch: ctx.params['branch'],
          path: ctx.params['path'],
          filename: ctx.params['filename'],
          action: 'view-file',
        });
      };

      // GitHub-like file browser routes
      router.get('/repos/:org/:repo/tree/:branch', folderHandler);
      router.get('/repos/:org/:repo/blob/:branch/:path/:filename', fileHandler);

      const folderMatch = router.find('GET', '/repos/facebook/react/tree/main');
      expect(folderMatch?.params).toEqual({
        org: 'facebook',
        repo: 'react',
        branch: 'main',
      });

      const fileMatch = router.find(
        'GET',
        '/repos/facebook/react/blob/main/src/index.js'
      );
      expect(fileMatch?.params).toEqual({
        org: 'facebook',
        repo: 'react',
        branch: 'main',
        path: 'src',
        filename: 'index.js',
      });
    });
  });

  describe('Your Specific Test Cases', () => {
    it('should handle /root/:param_1/abc/:param2 exactly as requested', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({
          message: 'Your first test route!',
          param_1: ctx.params['param_1'],
          param2: ctx.params['param2'],
        });
      };

      router.get('/root/:param_1/abc/:param2', handler);

      // Test with multiple different values
      const testCases = [
        {
          path: '/root/user123/abc/data456',
          expected: { param_1: 'user123', param2: 'data456' },
        },
        {
          path: '/root/test-value/abc/another-test',
          expected: { param_1: 'test-value', param2: 'another-test' },
        },
        {
          path: '/root/123/abc/456',
          expected: { param_1: '123', param2: '456' },
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const match = router.find('GET', path);
        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual(expected);
        expect(match?.path).toBe(path);
      });
    });

    it('should handle /root/:param_1/abc/:param2/xyz/:parm3 exactly as requested', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({
          message: 'Your second test route!',
          param_1: ctx.params['param_1'],
          param2: ctx.params['param2'],
          parm3: ctx.params['parm3'], // Note: keeping your typo 'parm3' as requested
        });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      // Test with multiple different values
      const testCases = [
        {
          path: '/root/user123/abc/data456/xyz/item789',
          expected: { param_1: 'user123', param2: 'data456', parm3: 'item789' },
        },
        {
          path: '/root/alpha/abc/beta/xyz/gamma',
          expected: { param_1: 'alpha', param2: 'beta', parm3: 'gamma' },
        },
        {
          path: '/root/first/abc/second/xyz/third',
          expected: { param_1: 'first', param2: 'second', parm3: 'third' },
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const match = router.find('GET', path);
        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual(expected);
        expect(match?.path).toBe(path);
      });
    });

    it('should test both routes together to ensure no conflicts', async () => {
      const handler1 = async (ctx: Context) => {
        ctx.res.json({ route: 'shorter', params: ctx.params });
      };

      const handler2 = async (ctx: Context) => {
        ctx.res.json({ route: 'longer', params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler1);
      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler2);

      // Test that shorter route matches correctly
      const shorterMatch = router.find('GET', '/root/test1/abc/test2');
      expect(shorterMatch?.handler).toBe(handler1);
      expect(shorterMatch?.params).toEqual({
        param_1: 'test1',
        param2: 'test2',
      });

      // Test that longer route matches correctly
      const longerMatch = router.find('GET', '/root/test1/abc/test2/xyz/test3');
      expect(longerMatch?.handler).toBe(handler2);
      expect(longerMatch?.params).toEqual({
        param_1: 'test1',
        param2: 'test2',
        parm3: 'test3',
      });

      // Ensure they are different handlers
      expect(shorterMatch?.handler).not.toBe(longerMatch?.handler);
    });

    it('should handle all HTTP methods on your routes', async () => {
      const getHandler = async (ctx: Context) =>
        ctx.res.json({ method: 'GET' });
      const postHandler = async (ctx: Context) =>
        ctx.res.json({ method: 'POST' });
      const putHandler = async (ctx: Context) =>
        ctx.res.json({ method: 'PUT' });
      const deleteHandler = async (ctx: Context) =>
        ctx.res.json({ method: 'DELETE' });
      const patchHandler = async (ctx: Context) =>
        ctx.res.json({ method: 'PATCH' });

      // Register your routes with all HTTP methods
      router.get('/root/:param_1/abc/:param2', getHandler);
      router.post('/root/:param_1/abc/:param2', postHandler);
      router.put('/root/:param_1/abc/:param2', putHandler);
      router.delete('/root/:param_1/abc/:param2', deleteHandler);
      router.patch('/root/:param_1/abc/:param2', patchHandler);

      // Test all methods
      const getMatch = router.find('GET', '/root/test/abc/value');
      const postMatch = router.find('POST', '/root/test/abc/value');
      const putMatch = router.find('PUT', '/root/test/abc/value');
      const deleteMatch = router.find('DELETE', '/root/test/abc/value');
      const patchMatch = router.find('PATCH', '/root/test/abc/value');

      expect(getMatch?.handler).toBe(getHandler);
      expect(postMatch?.handler).toBe(postHandler);
      expect(putMatch?.handler).toBe(putHandler);
      expect(deleteMatch?.handler).toBe(deleteHandler);
      expect(patchMatch?.handler).toBe(patchHandler);

      // All should have same parameters
      const expectedParams = { param_1: 'test', param2: 'value' };
      expect(getMatch?.params).toEqual(expectedParams);
      expect(postMatch?.params).toEqual(expectedParams);
      expect(putMatch?.params).toEqual(expectedParams);
      expect(deleteMatch?.params).toEqual(expectedParams);
      expect(patchMatch?.params).toEqual(expectedParams);
    });
  });

  describe('Complex Parameter Scenarios', () => {
    it('should handle UUIDs as parameters', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const uuid3 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

      const match = router.find(
        'GET',
        `/root/${uuid1}/abc/${uuid2}/xyz/${uuid3}`
      );

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        param_1: uuid1,
        param2: uuid2,
        param3: uuid3,
      });
    });

    it('should handle MongoDB ObjectId-like parameters', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get(
        '/api/collections/:collectionId/documents/:documentId/fields/:fieldId',
        handler
      );

      const objectId1 = '507f1f77bcf86cd799439011';
      const objectId2 = '507f191e810c19729de860ea';
      const objectId3 = '507f191e810c19729de860eb';

      const match = router.find(
        'GET',
        `/api/collections/${objectId1}/documents/${objectId2}/fields/${objectId3}`
      );

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        collectionId: objectId1,
        documentId: objectId2,
        fieldId: objectId3,
      });
    });

    it('should handle timestamp-based parameters', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/analytics/:year/:month/:day/reports/:reportId', handler);

      const match = router.find(
        'GET',
        '/analytics/2024/12/25/reports/daily-summary'
      );

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        year: '2024',
        month: '12',
        day: '25',
        reportId: 'daily-summary',
      });
    });

    it('should handle versioned API patterns', async () => {
      const v1Handler = async (ctx: Context) => {
        ctx.res.json({ version: 'v1', params: ctx.params });
      };

      const v2Handler = async (ctx: Context) => {
        ctx.res.json({ version: 'v2', params: ctx.params });
      };

      router.get('/api/v1/users/:userId/data/:dataId', v1Handler);
      router.get('/api/v2/users/:userId/data/:dataId', v2Handler);

      const v1Match = router.find('GET', '/api/v1/users/user123/data/profile');
      const v2Match = router.find('GET', '/api/v2/users/user123/data/profile');

      expect(v1Match?.handler).toBe(v1Handler);
      expect(v2Match?.handler).toBe(v2Handler);

      expect(v1Match?.params).toEqual({ userId: 'user123', dataId: 'profile' });
      expect(v2Match?.params).toEqual({ userId: 'user123', dataId: 'profile' });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed URLs gracefully', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler);

      // Test various malformed URLs
      expect(router.find('GET', '/root/value1/abc')).toBeNull();
      expect(router.find('GET', '/root//abc/value2')).toBeNull();
      expect(router.find('GET', '/root/value1//value2')).toBeNull();
      expect(router.find('GET', '/root/value1/abc/')).toBeNull();
    });

    it('should differentiate between similar route patterns', async () => {
      const handler1 = async (ctx: Context) => {
        ctx.res.json({ route: 'pattern1' });
      };

      const handler2 = async (ctx: Context) => {
        ctx.res.json({ route: 'pattern2' });
      };

      const handler3 = async (ctx: Context) => {
        ctx.res.json({ route: 'pattern3' });
      };

      router.get('/api/users/:userId/profile', handler1);
      router.get('/api/users/:userId/settings', handler2);
      router.get('/api/users/:userId/posts/:postId', handler3);

      const profileMatch = router.find('GET', '/api/users/123/profile');
      const settingsMatch = router.find('GET', '/api/users/123/settings');
      const postMatch = router.find('GET', '/api/users/123/posts/456');

      expect(profileMatch?.handler).toBe(handler1);
      expect(settingsMatch?.handler).toBe(handler2);
      expect(postMatch?.handler).toBe(handler3);

      expect(profileMatch?.params).toEqual({ userId: '123' });
      expect(settingsMatch?.params).toEqual({ userId: '123' });
      expect(postMatch?.params).toEqual({ userId: '123', postId: '456' });
    });

    it('should handle concurrent requests to multi-level routes', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

      // Simulate concurrent requests with different parameter values
      const requests = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(
          router.find('GET', `/root/user${i}/abc/data${i}/xyz/item${i}`)
        )
      );

      const results = await Promise.all(requests);

      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result?.params).toEqual({
          param_1: `user${i}`,
          param2: `data${i}`,
          param3: `item${i}`,
        });
      });
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle stress test with many multi-level routes', async () => {
      // Register 200 different multi-level routes
      const handlers = [];
      for (let i = 0; i < 200; i++) {
        const handler = async (ctx: Context) => {
          ctx.res.json({ route: i, params: ctx.params });
        };
        handlers.push(handler);
        router.get(
          `/stress/level${i}/:param1/section/:param2/item/:param3`,
          handler
        );
      }

      // Test performance with many routes
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const routeIndex = i % 200;
        const match = router.find(
          'GET',
          `/stress/level${routeIndex}/val1/section/val2/item/val3`
        );
        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          param1: 'val1',
          param2: 'val2',
          param3: 'val3',
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(300); // Should complete within reasonable time
    });

    it('should maintain performance with deep route nesting', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      // Create a very deep route (10 levels)
      router.get(
        '/l1/:p1/l2/:p2/l3/:p3/l4/:p4/l5/:p5/l6/:p6/l7/:p7/l8/:p8/l9/:p9/l10/:p10',
        handler
      );

      const start = performance.now();

      // Test the deep route multiple times
      for (let i = 0; i < 100; i++) {
        const match = router.find(
          'GET',
          '/l1/v1/l2/v2/l3/v3/l4/v4/l5/v5/l6/v6/l7/v7/l8/v8/l9/v9/l10/v10'
        );
        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          p1: 'v1',
          p2: 'v2',
          p3: 'v3',
          p4: 'v4',
          p5: 'v5',
          p6: 'v6',
          p7: 'v7',
          p8: 'v8',
          p9: 'v9',
          p10: 'v10',
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should be fast even with deep nesting
    });
  });
});
