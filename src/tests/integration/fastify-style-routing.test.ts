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
});
