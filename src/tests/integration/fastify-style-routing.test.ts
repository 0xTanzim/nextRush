/**
 * Integration tests for Fastify-style routing
 * Tests that Fastify-style routes actually work with real HTTP requests
 */

import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Fastify-Style Routing Integration', () => {
  let app: Application;
  let server: any;
  const PORT = 3099; // Use unique port to avoid conflicts

  beforeAll(async () => {
    app = createApp({
      port: PORT,
      host: 'localhost',
      debug: false,
    });

    // Basic middleware
    app.use(app.json());
    app.use(app.cors());

    // Test 1: Basic Fastify-style route with handler only
    app.get('/fastify/basic', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Fastify-style routing works!',
          style: 'basic',
        });
      },
    });

    // Test 2: Fastify-style route with middleware
    const authMiddleware = async (ctx: any, next: any) => {
      const token = ctx.headers.authorization;
      if (!token) {
        ctx.res.status(401).json({ error: 'No token provided' });
        return;
      }
      ctx.state = ctx.state || {};
      ctx.state.user = { id: 'user123', token };
      await next();
    };

    app.get('/fastify/protected', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Protected route accessed',
          user: ctx.state?.['user'],
        });
      },
      middleware: [authMiddleware],
    });

    // Test 3: Fastify-style route with schema and options
    app.post('/fastify/users', {
      handler: async ctx => {
        const { name, email, age } = ctx.body as any;
        ctx.res.status(201).json({
          message: 'User created with Fastify-style routing',
          user: { name, email, age, id: 'generated-id' },
        });
      },
      middleware: [
        async (ctx, next) => {
          // Simple validation middleware
          const { name, email } = (ctx.body as any) || {};
          if (!name || !email) {
            ctx.res.status(400).json({
              error: 'Name and email are required',
              received: ctx.body,
            });
            return;
          }
          await next();
        },
      ],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            age: { type: 'number', minimum: 18 },
          },
        },
      },
      options: {
        name: 'createUser',
        description: 'Create a new user via Fastify-style route',
        tags: ['users', 'fastify'],
        version: '1.0.0',
        summary: 'User creation endpoint',
      },
    });

    // Test 4: Fastify-style route with params
    app.get('/fastify/users/:id', {
      handler: async ctx => {
        const { id } = ctx.params;
        ctx.res.json({
          message: 'User retrieved via Fastify-style routing',
          userId: id,
          params: ctx.params,
        });
      },
      options: {
        name: 'getUser',
        description: 'Get user by ID',
      },
    });

    // Test 5: Fastify-style route with query validation
    app.get('/fastify/search', {
      handler: async ctx => {
        const { q, page, limit } = ctx.query;
        ctx.res.json({
          message: 'Search via Fastify-style routing',
          query: q,
          pagination: {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 10,
          },
          results: ['result1', 'result2'],
        });
      },
      middleware: [
        async (ctx, next) => {
          const { q } = ctx.query;
          if (!q) {
            ctx.res
              .status(400)
              .json({ error: 'Query parameter "q" is required' });
            return;
          }
          await next();
        },
      ],
    });

    // Test 6: Multiple middleware chain (3-4 middleware)
    const middleware1 = async (ctx: any, next: any) => {
      ctx.state = ctx.state || {};
      ctx.state.step1 = 'middleware1-executed';
      ctx.state.executionOrder = ['middleware1'];
      await next();
    };

    const middleware2 = async (ctx: any, next: any) => {
      ctx.state.step2 = 'middleware2-executed';
      ctx.state.executionOrder.push('middleware2');
      // Add some processing time
      ctx.state.timestamp = Date.now();
      await next();
    };

    const middleware3 = async (ctx: any, next: any) => {
      ctx.state.step3 = 'middleware3-executed';
      ctx.state.executionOrder.push('middleware3');
      // Validate that previous middleware ran
      if (!ctx.state.step1 || !ctx.state.step2) {
        ctx.res.status(500).json({ error: 'Previous middleware failed' });
        return;
      }
      await next();
    };

    const middleware4 = async (ctx: any, next: any) => {
      ctx.state.step4 = 'middleware4-executed';
      ctx.state.executionOrder.push('middleware4');
      ctx.state.finalCheck = 'all-middleware-executed';
      await next();
    };

    app.post('/fastify/multi-middleware', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Multi-middleware chain executed successfully',
          state: ctx.state,
          body: ctx.body,
          totalMiddleware: 4,
        });
      },
      middleware: [middleware1, middleware2, middleware3, middleware4],
    });

    // Test 7: Error handling in middleware chain
    const errorMiddleware1 = async (ctx: any, next: any) => {
      ctx.state = ctx.state || {};
      ctx.state.beforeError = true;
      await next();
    };

    const errorMiddleware2 = async (ctx: any, next: any) => {
      const shouldFail = ctx.headers['x-trigger-error'];
      if (shouldFail === 'true') {
        ctx.res.status(422).json({
          error: 'Middleware triggered error',
          middlewareLevel: 2,
          state: ctx.state,
        });
        return;
      }
      ctx.state.passedError = true;
      await next();
    };

    const errorMiddleware3 = async (ctx: any, next: any) => {
      ctx.state.afterError = true;
      await next();
    };

    app.put('/fastify/error-chain', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Error chain passed successfully',
          state: ctx.state,
        });
      },
      middleware: [errorMiddleware1, errorMiddleware2, errorMiddleware3],
    });

    // Test 8: Complex middleware with async operations
    const asyncMiddleware1 = async (ctx: any, next: any) => {
      ctx.state = ctx.state || {};
      // Simulate async operation (database query, API call, etc.)
      await new Promise(resolve => setTimeout(resolve, 5));
      ctx.state.asyncOp1 = 'completed';
      await next();
    };

    const asyncMiddleware2 = async (ctx: any, next: any) => {
      // Simulate another async operation
      await new Promise(resolve => setTimeout(resolve, 3));
      ctx.state.asyncOp2 = 'completed';
      // Add some data processing
      const data = ctx.body as any;
      if (data && data.processMe) {
        ctx.state.processed = data.processMe.toUpperCase();
      }
      await next();
    };

    const asyncMiddleware3 = async (ctx: any, next: any) => {
      // Final async operation
      await new Promise(resolve => setTimeout(resolve, 2));
      ctx.state.asyncOp3 = 'completed';
      ctx.state.totalAsyncTime = 10; // 5 + 3 + 2
      await next();
    };

    app.patch('/fastify/async-chain', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Async middleware chain completed',
          state: ctx.state,
          timing: 'all-async-operations-completed',
        });
      },
      middleware: [asyncMiddleware1, asyncMiddleware2, asyncMiddleware3],
    });

    // Test 9: Edge case - Empty middleware array
    app.get('/fastify/empty-middleware', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Route with empty middleware array',
          middlewareCount: 0,
        });
      },
      middleware: [], // Empty array
    });

    // Test 10: Edge case - Single middleware
    app.get('/fastify/single-middleware', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Route with single middleware',
          state: ctx.state,
        });
      },
      middleware: [
        async (ctx, next) => {
          ctx.state = { singleMiddleware: 'executed' };
          await next();
        },
      ],
    });

    // Test 11: Edge case - Middleware modifying request body
    const bodyModifierMiddleware = async (ctx: any, next: any) => {
      if (ctx.body && typeof ctx.body === 'object') {
        ctx.body.modified = true;
        ctx.body.modifiedAt = new Date().toISOString();
        ctx.body.originalKeys = Object.keys(ctx.body).filter(
          k => k !== 'modified' && k !== 'modifiedAt'
        );
      }
      await next();
    };

    app.post('/fastify/body-modifier', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Body was modified by middleware',
          modifiedBody: ctx.body,
        });
      },
      middleware: [bodyModifierMiddleware],
    });

    // Test 12: Edge case - Middleware with conditional logic
    const conditionalMiddleware = async (ctx: any, next: any) => {
      const userType = ctx.headers['x-user-type'];
      ctx.state = ctx.state || {};

      if (userType === 'admin') {
        ctx.state.permissions = ['read', 'write', 'delete'];
        ctx.state.level = 'admin';
      } else if (userType === 'user') {
        ctx.state.permissions = ['read'];
        ctx.state.level = 'user';
      } else {
        ctx.res.status(403).json({ error: 'Invalid user type' });
        return;
      }
      await next();
    };

    app.get('/fastify/conditional', {
      handler: async ctx => {
        ctx.res.json({
          message: 'Conditional middleware executed',
          userLevel: ctx.state?.['level'],
          permissions: ctx.state?.['permissions'],
        });
      },
      middleware: [conditionalMiddleware],
    });

    server = await app.listen();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('should handle basic Fastify-style route with handler only', async () => {
    const response = await fetch(`http://localhost:${PORT}/fastify/basic`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'Fastify-style routing works!',
      style: 'basic',
    });
  });

  it('should handle Fastify-style route with middleware', async () => {
    // Test without token - should fail
    const responseWithoutToken = await fetch(
      `http://localhost:${PORT}/fastify/protected`
    );
    const errorData = (await responseWithoutToken.json()) as any;

    expect(responseWithoutToken.status).toBe(401);
    expect(errorData.error).toBe('No token provided');

    // Test with token - should succeed
    const responseWithToken = await fetch(
      `http://localhost:${PORT}/fastify/protected`,
      {
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    );
    const successData = (await responseWithToken.json()) as any;

    expect(responseWithToken.status).toBe(200);
    expect(successData.message).toBe('Protected route accessed');
    expect(successData.user).toEqual({
      id: 'user123',
      token: 'Bearer test-token',
    });
  });

  it('should handle Fastify-style POST route with validation middleware', async () => {
    // Test with missing data - should fail
    const responseInvalid = await fetch(
      `http://localhost:${PORT}/fastify/users`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }), // Missing email
      }
    );
    const errorData = (await responseInvalid.json()) as any;

    expect(responseInvalid.status).toBe(400);
    expect(errorData.error).toBe('Name and email are required');

    // Test with valid data - should succeed
    const responseValid = await fetch(
      `http://localhost:${PORT}/fastify/users`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
        }),
      }
    );
    const successData = (await responseValid.json()) as any;

    expect(responseValid.status).toBe(201);
    expect(successData.message).toBe('User created with Fastify-style routing');
    expect(successData.user).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
      id: 'generated-id',
    });
  });

  it('should handle Fastify-style route with params', async () => {
    const response = await fetch(`http://localhost:${PORT}/fastify/users/123`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'User retrieved via Fastify-style routing',
      userId: '123',
      params: { id: '123' },
    });
  });

  it('should handle Fastify-style route with query parameter validation', async () => {
    // Test without required query param - should fail
    const responseWithoutQuery = await fetch(
      `http://localhost:${PORT}/fastify/search`
    );
    const errorData = (await responseWithoutQuery.json()) as any;

    expect(responseWithoutQuery.status).toBe(400);
    expect(errorData.error).toBe('Query parameter "q" is required');

    // Test with query params - should succeed
    const responseWithQuery = await fetch(
      `http://localhost:${PORT}/fastify/search?q=test&page=2&limit=5`
    );
    const successData = (await responseWithQuery.json()) as any;

    expect(responseWithQuery.status).toBe(200);
    expect(successData).toEqual({
      message: 'Search via Fastify-style routing',
      query: 'test',
      pagination: { page: 2, limit: 5 },
      results: ['result1', 'result2'],
    });
  });

  it('should work alongside Koa-style routes', async () => {
    // Add a Koa-style route for comparison
    app.get('/koa/basic', async ctx => {
      ctx.res.json({
        message: 'Koa-style routing works!',
        style: 'koa',
      });
    });

    // Test both styles work
    const fastifyResponse = await fetch(
      `http://localhost:${PORT}/fastify/basic`
    );
    const fastifyData = (await fastifyResponse.json()) as any;

    const koaResponse = await fetch(`http://localhost:${PORT}/koa/basic`);
    const koaData = (await koaResponse.json()) as any;

    expect(fastifyResponse.status).toBe(200);
    expect(koaResponse.status).toBe(200);
    expect(fastifyData.style).toBe('basic');
    expect(koaData.style).toBe('koa');
  });

  it('should execute 4 middleware in correct order', async () => {
    const response = await fetch(
      `http://localhost:${PORT}/fastify/multi-middleware`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      }
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.message).toBe('Multi-middleware chain executed successfully');
    expect(data.totalMiddleware).toBe(4);
    expect(data.state.step1).toBe('middleware1-executed');
    expect(data.state.step2).toBe('middleware2-executed');
    expect(data.state.step3).toBe('middleware3-executed');
    expect(data.state.step4).toBe('middleware4-executed');
    expect(data.state.finalCheck).toBe('all-middleware-executed');
    expect(data.state.executionOrder).toEqual([
      'middleware1',
      'middleware2',
      'middleware3',
      'middleware4',
    ]);
    expect(data.body).toEqual({ test: 'data' });
  });

  it('should handle error in middleware chain correctly', async () => {
    // Test with error trigger
    const responseWithError = await fetch(
      `http://localhost:${PORT}/fastify/error-chain`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-trigger-error': 'true',
        },
        body: JSON.stringify({ test: 'error' }),
      }
    );
    const errorData = (await responseWithError.json()) as any;

    expect(responseWithError.status).toBe(422);
    expect(errorData.error).toBe('Middleware triggered error');
    expect(errorData.middlewareLevel).toBe(2);
    expect(errorData.state.beforeError).toBe(true);

    // Test without error trigger
    const responseWithoutError = await fetch(
      `http://localhost:${PORT}/fastify/error-chain`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'success' }),
      }
    );
    const successData = (await responseWithoutError.json()) as any;

    expect(responseWithoutError.status).toBe(200);
    expect(successData.message).toBe('Error chain passed successfully');
    expect(successData.state.beforeError).toBe(true);
    expect(successData.state.passedError).toBe(true);
    expect(successData.state.afterError).toBe(true);
  });

  it('should execute async middleware chain correctly', async () => {
    const response = await fetch(
      `http://localhost:${PORT}/fastify/async-chain`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processMe: 'hello world' }),
      }
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.message).toBe('Async middleware chain completed');
    expect(data.timing).toBe('all-async-operations-completed');
    expect(data.state.asyncOp1).toBe('completed');
    expect(data.state.asyncOp2).toBe('completed');
    expect(data.state.asyncOp3).toBe('completed');
    expect(data.state.processed).toBe('HELLO WORLD');
    expect(data.state.totalAsyncTime).toBe(10);
  });

  it('should handle empty middleware array', async () => {
    const response = await fetch(
      `http://localhost:${PORT}/fastify/empty-middleware`
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.message).toBe('Route with empty middleware array');
    expect(data.middlewareCount).toBe(0);
  });

  it('should handle single middleware correctly', async () => {
    const response = await fetch(
      `http://localhost:${PORT}/fastify/single-middleware`
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.message).toBe('Route with single middleware');
    expect(data.state.singleMiddleware).toBe('executed');
  });

  it('should allow middleware to modify request body', async () => {
    const originalBody = { name: 'John', age: 30 };
    const response = await fetch(
      `http://localhost:${PORT}/fastify/body-modifier`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(originalBody),
      }
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.message).toBe('Body was modified by middleware');
    expect(data.modifiedBody.modified).toBe(true);
    expect(data.modifiedBody.name).toBe('John');
    expect(data.modifiedBody.age).toBe(30);
    expect(data.modifiedBody.originalKeys).toEqual(['name', 'age']);
    expect(data.modifiedBody.modifiedAt).toBeDefined();
  });

  it('should execute conditional middleware based on headers', async () => {
    // Test admin user
    const adminResponse = await fetch(
      `http://localhost:${PORT}/fastify/conditional`,
      {
        headers: { 'x-user-type': 'admin' },
      }
    );
    const adminData = (await adminResponse.json()) as any;

    expect(adminResponse.status).toBe(200);
    expect(adminData.message).toBe('Conditional middleware executed');
    expect(adminData.userLevel).toBe('admin');
    expect(adminData.permissions).toEqual(['read', 'write', 'delete']);

    // Test regular user
    const userResponse = await fetch(
      `http://localhost:${PORT}/fastify/conditional`,
      {
        headers: { 'x-user-type': 'user' },
      }
    );
    const userData = (await userResponse.json()) as any;

    expect(userResponse.status).toBe(200);
    expect(userData.userLevel).toBe('user');
    expect(userData.permissions).toEqual(['read']);

    // Test invalid user type
    const invalidResponse = await fetch(
      `http://localhost:${PORT}/fastify/conditional`,
      {
        headers: { 'x-user-type': 'invalid' },
      }
    );
    const invalidData = (await invalidResponse.json()) as any;

    expect(invalidResponse.status).toBe(403);
    expect(invalidData.error).toBe('Invalid user type');
  });

  it('should handle edge case: missing headers in conditional middleware', async () => {
    const response = await fetch(
      `http://localhost:${PORT}/fastify/conditional`
    );
    const data = (await response.json()) as any;

    expect(response.status).toBe(403);
    expect(data.error).toBe('Invalid user type');
  });

  it('should handle concurrent requests with middleware', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      fetch(`http://localhost:${PORT}/fastify/multi-middleware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: i }),
      })
    );

    const responses = await Promise.all(promises);
    const data = (await Promise.all(responses.map(r => r.json()))) as any[];

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Each request should have proper middleware execution
    data.forEach((item, index) => {
      expect(item.totalMiddleware).toBe(4);
      expect(item.state.executionOrder).toEqual([
        'middleware1',
        'middleware2',
        'middleware3',
        'middleware4',
      ]);
      expect(item.body.requestId).toBe(index);
    });
  });

  it('should handle stress test with multiple async middleware', async () => {
    const startTime = Date.now();

    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(`http://localhost:${PORT}/fastify/async-chain`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processMe: `test-${i}` }),
      })
    );

    const responses = await Promise.all(promises);
    const data = (await Promise.all(responses.map(r => r.json()))) as any[];
    const endTime = Date.now();

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Each request should have all async operations completed
    data.forEach((item, index) => {
      expect(item.state.asyncOp1).toBe('completed');
      expect(item.state.asyncOp2).toBe('completed');
      expect(item.state.asyncOp3).toBe('completed');
      expect(item.state.processed).toBe(`TEST-${index}`);
    });

    // Performance check - should complete in reasonable time
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(1000); // Should complete in less than 1 second
  });
});
