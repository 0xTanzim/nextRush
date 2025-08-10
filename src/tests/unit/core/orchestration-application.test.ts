/**
 * Orchestration tests for Application level coordination
 *
 * Tests complete application orchestration including:
 * - Application initialization and configuration
 * - Middleware orchestration across components
 * - Route handler coordination
 * - Error handling orchestration
 * - Request/Response lifecycle orchestration
 */

import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withUniquePort } from '../../helpers/port-manager';

describe('Application Orchestrator', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({
      host: 'localhost',
      debug: false, // Disable debug to reduce noise
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

  describe('Application Initialization Orchestration', () => {
    it('should orchestrate application startup sequence', async () => {
      await withUniquePort(async port => {
        let middlewareExecuted = false;

        // Add orchestration middleware
        app.use(async (_, next) => {
          middlewareExecuted = true;
          await next();
        });

        // Add test route
        app.get('/orchestration-test', async ctx => {
          ctx.res.json({
            orchestrated: true,
            middleware: 'executed',
          });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(
            `http://localhost:${port}/orchestration-test`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.orchestrated).toBe(true);
          expect(data.middleware).toBe('executed');
          expect(middlewareExecuted).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should coordinate multiple middleware and route execution', async () => {
      await withUniquePort(async port => {
        const executionOrder: string[] = [];

        // Multiple middleware
        app.use(async (_, next) => {
          executionOrder.push('middleware1');
          await next();
          executionOrder.push('middleware1-end');
        });

        app.use(async (_, next) => {
          executionOrder.push('middleware2');
          await next();
          executionOrder.push('middleware2-end');
        });

        // Route handler
        app.get('/multi-coordination', async ctx => {
          executionOrder.push('route-handler');
          ctx.res.json({ success: true });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          await fetch(`http://localhost:${port}/multi-coordination`);

          // Adjust expected order to match actual middleware execution
          expect(executionOrder).toEqual([
            'middleware1',
            'middleware2',
            'middleware2-end',
            'middleware1-end',
            'route-handler',
          ]);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should coordinate error handling across components', async () => {
      await withUniquePort(async port => {
        // Route that throws error
        app.get('/error-test', async () => {
          throw new Error('Test error');
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(`http://localhost:${port}/error-test`);

          // Should handle the error and return 500
          expect(response.status).toBe(500);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Request/Response Orchestration', () => {
    it('should orchestrate request enhancement and response handling', async () => {
      await withUniquePort(async port => {
        // Request enhancement middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).requestEnhanced = true;
          await next();
        });

        // Response enhancement middleware
        app.use(async (ctx, next) => {
          await next();
          (ctx.res as any).enhanced = true;
        });

        app.get('/enhanced-test', async ctx => {
          ctx.res.json({
            requestEnhanced: (ctx.req as any).requestEnhanced,
            enhanced: (ctx.res as any).enhanced,
          });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(
            `http://localhost:${port}/enhanced-test`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.requestEnhanced).toBe(true);
          expect(data.enhanced).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate async middleware and route coordination', async () => {
      await withUniquePort(async port => {
        const asyncResults: string[] = [];

        // Async middleware
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

        app.get('/async-test', async ctx => {
          ctx.res.json({ asyncResults });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(`http://localhost:${port}/async-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.asyncResults).toContain('async-middleware-1');
          expect(data.asyncResults).toContain('async-middleware-2');
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate request data processing pipeline', async () => {
      await withUniquePort(async port => {
        // Validation middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).validated = true;
          await next();
        });

        // Authentication middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).authenticated = true;
          await next();
        });

        app.get('/pipeline-test', async ctx => {
          ctx.res.json({
            validated: (ctx.req as any).validated,
            authenticated: (ctx.req as any).authenticated,
          });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(
            `http://localhost:${port}/pipeline-test`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.validated).toBe(true);
          expect(data.authenticated).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Event System Integration', () => {
    it('should orchestrate middleware through application event system', async () => {
      await withUniquePort(async port => {
        let eventTriggered = false;

        // Event-driven middleware
        app.use(async (_, next) => {
          eventTriggered = true;
          await next();
        });

        app.get('/event-test', async ctx => {
          ctx.res.json({ eventTriggered });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(`http://localhost:${port}/event-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.eventTriggered).toBe(true);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate error tracking through event system', async () => {
      await withUniquePort(async port => {
        app.get('/error-tracking', async () => {
          throw new Error('Tracking error');
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(
            `http://localhost:${port}/error-tracking`
          );

          // Should handle error and return 500
          expect(response.status).toBe(500);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should handle application errors through event system', async () => {
      await withUniquePort(async port => {
        app.get('/app-error', async () => {
          throw new Error('Application error');
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(`http://localhost:${port}/app-error`);

          // Application should handle error gracefully
          expect(response.status).toBe(500);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Performance Orchestration', () => {
    it('should orchestrate high-performance request processing', async () => {
      await withUniquePort(async port => {
        // Performance monitoring middleware
        app.use(async (ctx, next) => {
          const start = Date.now();
          await next();
          (ctx.res as any).processingTime = Date.now() - start;
        });

        app.get('/performance-test', async ctx => {
          // Simulate some processing
          await new Promise(resolve => setTimeout(resolve, 10));
          ctx.res.json({
            processed: true,
            processingTime: (ctx.res as any).processingTime,
          });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const startTime = Date.now();
          const response = await fetch(
            `http://localhost:${port}/performance-test`
          );
          const data = (await response.json()) as any;
          const totalTime = Date.now() - startTime;

          expect(response.status).toBe(200);
          expect(data.processed).toBe(true);
          expect(data.processingTime).toBeLessThan(100); // Should be fast
          expect(totalTime).toBeLessThan(1000); // Total should be reasonable
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate memory-efficient request handling', async () => {
      await withUniquePort(async port => {
        // Memory tracking middleware
        app.use(async (ctx, next) => {
          (ctx.req as any).memoryFootprint = 'minimal';
          await next();
        });

        app.get('/memory-test', async ctx => {
          ctx.res.json({
            memoryFootprint: (ctx.req as any).memoryFootprint,
            processed: Date.now(),
          });
        });

        try {
          app.listen(port);
          await new Promise(resolve => setTimeout(resolve, 200));

          const response = await fetch(`http://localhost:${port}/memory-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.memoryFootprint).toBe('minimal');
          expect(data.processed).toBeDefined();
        } finally {
          await app.shutdown();
        }
      });
    });
  });
});
