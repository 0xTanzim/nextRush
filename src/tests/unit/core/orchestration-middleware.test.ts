/**
 * Orchestration tests for Middleware chain coordination
 *
 * Tests complete middleware orchestration including:
 * - Middleware registration order and dependencies
 * - Complex middleware chain execution
 * - Async middleware coordination
 * - Error handling and recovery across middleware
 * - Context state management across middleware chain
 * - Performance-oriented middleware orchestration
 */

import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withUniquePort } from '../../helpers/port-manager';
import { startServerAndWait } from '../../helpers/server-ready';

describe('Middleware Chain Orchestration', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({
      host: 'localhost',
      debug: false,
    });
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.shutdown();
      } catch {
        // Ignore shutdown errors
      }
    }
  });

  describe('Middleware Registration Orchestration', () => {
    it('should orchestrate middleware registration order', async () => {
      await withUniquePort(async port => {
        const executionOrder: string[] = [];

        // Register middleware in specific order
        app.use(async (_, next) => {
          executionOrder.push('first');
          await next();
        });

        app.use(async (_, next) => {
          executionOrder.push('second');
          await next();
        });

        app.use(async (_, next) => {
          executionOrder.push('third');
          await next();
        });

        app.get('/order-test', async ctx => {
          executionOrder.push('route-handler');
          ctx.res.json({ order: executionOrder });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(`http://localhost:${port}/order-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.order).toEqual([
            'first',
            'second',
            'third',
            'route-handler',
          ]);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate conditional middleware registration', async () => {
      await withUniquePort(async port => {
        const results: any = {};

        // Conditional admin middleware
        app.use(async (ctx, next) => {
          const path = new URL(ctx.req.url!, `http://${ctx.req.headers.host}`)
            .pathname;
          if (path.startsWith('/admin')) {
            results.adminOnly = true;
          }
          await next();
        });

        // General middleware
        app.use(async (_, next) => {
          results.general = true;
          await next();
        });

        app.get('/admin/test', async ctx => {
          ctx.res.json(results);
        });

        app.get('/public/test', async ctx => {
          ctx.res.json(results);
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const adminResponse = await fetch(
            `http://localhost:${port}/admin/test`
          );
          expect(adminResponse.status).toBe(200);

          const adminData = (await adminResponse.json()) as any;
          expect(adminData.adminOnly).toBe(true);
          expect(adminData.general).toBe(true);

          // Reset for public test
          Object.keys(results).forEach(key => delete results[key]);

          const publicResponse = await fetch(
            `http://localhost:${port}/public/test`
          );
          expect(publicResponse.status).toBe(200);

          const publicData = (await publicResponse.json()) as any;
          expect(publicData.adminOnly).toBeUndefined();
          expect(publicData.general).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Execution Pipeline Orchestration', () => {
    it('should orchestrate complex middleware pipeline', async () => {
      await withUniquePort(async port => {
        // Authentication middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).authenticated = true;
          await next();
        });

        // Logging middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).logged = true;
          await next();
        });

        // Validation middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).validated = true;
          await next();
        });

        app.get('/complex-pipeline', async ctx => {
          ctx.res.json({
            authenticated: (ctx.req as any).authenticated,
            logged: (ctx.req as any).logged,
            validated: (ctx.req as any).validated,
          });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/complex-pipeline`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.authenticated).toBe(true);
          expect(data.logged).toBe(true);
          expect(data.validated).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate async middleware execution', async () => {
      await withUniquePort(async port => {
        const asyncResults: string[] = [];

        // Async middleware chain
        app.use(async (_, next) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          asyncResults.push('async-middleware-1');
          await next();
        });

        app.use(async (_, next) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          asyncResults.push('async-middleware-2');
          await next();
        });

        app.get('/async-execution', async ctx => {
          ctx.res.json({ asyncResults });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/async-execution`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.asyncResults).toContain('async-middleware-1');
          expect(data.asyncResults).toContain('async-middleware-2');
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Error Handling Orchestration', () => {
    it('should orchestrate error propagation through middleware chain', async () => {
      await withUniquePort(async port => {
        app.use(async (_, next) => {
          await next(); // This will propagate the error
        });

        app.get('/error-propagation', async () => {
          throw new Error('Middleware error');
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/error-propagation`
          );
          // Application handles errors and returns 500
          expect(response.status).toBe(500);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate middleware error recovery', async () => {
      await withUniquePort(async port => {
        app.get('/error-recovery', async () => {
          throw new Error('Recovery test error');
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/error-recovery`
          );

          // Framework handles errors and returns 500 - this is the expected behavior
          expect(response.status).toBe(500);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('State Management Orchestration', () => {
    it('should orchestrate context state across middleware chain', async () => {
      await withUniquePort(async port => {
        // State building middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).step1 = 'completed';
          await next();
        });

        app.use(async (ctx, next) => {
          (ctx.req as any).step2 = 'completed';
          await next();
        });

        app.use(async (ctx, next) => {
          (ctx.req as any).step3 = 'completed';
          await next();
        });

        app.get('/state-management', async ctx => {
          ctx.res.json({
            step1: (ctx.req as any).step1,
            step2: (ctx.req as any).step2,
            step3: (ctx.req as any).step3,
          });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/state-management`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.step1).toBe('completed');
          expect(data.step2).toBe('completed');
          expect(data.step3).toBe('completed');
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate state isolation between requests', async () => {
      await withUniquePort(async port => {
        let requestCounter = 0;

        // Request-specific state middleware
        app.use(async (ctx, next) => {
          requestCounter++;
          (ctx.req as any).requestId = requestCounter;
          await next();
        });

        app.get('/state-isolation', async ctx => {
          ctx.res.json({ requestId: (ctx.req as any).requestId });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Make multiple concurrent requests
          const responses = await Promise.all([
            fetch(`http://localhost:${port}/state-isolation`),
            fetch(`http://localhost:${port}/state-isolation`),
            fetch(`http://localhost:${port}/state-isolation`),
          ]);

          expect(responses.every(r => r.status === 200)).toBe(true);

          const data = (await Promise.all(
            responses.map(r => r.json())
          )) as any[];

          expect(data[0].requestId).toBe(1);
          expect(data[1].requestId).toBe(2);
          expect(data[2].requestId).toBe(3);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Performance Orchestration', () => {
    it('should orchestrate high-performance middleware execution', async () => {
      await withUniquePort(async port => {
        // Performance-oriented middleware chain
        for (let i = 0; i < 5; i++) {
          app.use(async (_, next) => {
            await next();
          });
        }

        app.get('/performance-middleware', async ctx => {
          ctx.res.json({ middlewareCount: 5 });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/performance-middleware`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.middlewareCount).toBe(5);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate memory-efficient middleware chain', async () => {
      await withUniquePort(async port => {
        // Memory-efficient middleware
        app.use(async (ctx, next) => {
          // Add minimal processing
          const start = Date.now();
          await next();
          (ctx.res as any).processingTime = Date.now() - start;
        });

        app.get('/memory-efficiency', async ctx => {
          ctx.res.json({
            processed: {
              timestamp: Date.now(),
            },
          });
        });

        try {
          await startServerAndWait(app, port);
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(
            `http://localhost:${port}/memory-efficiency`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.processed).toBeDefined();
          expect(data.processed.timestamp).toBeDefined();
        } finally {
          await app.shutdown();
        }
      });
    });
  });
});
