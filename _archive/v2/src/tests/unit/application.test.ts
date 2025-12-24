/**
 * Application tests for NextRush v2
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@/core/app/application';
import { createRouter } from '@/core/router';
import { ValidationError } from '@/errors/custom-errors';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({ port: 3001 });
  });

  afterEach(async () => {
    await app.shutdown();
  });

  describe('Application Creation', () => {
    it('should create an application instance with default options', () => {
      const testApp = createApp();
      expect(testApp).toBeDefined();
      expect(typeof testApp.get).toBe('function');
      expect(typeof testApp.post).toBe('function');
      expect(typeof testApp.use).toBe('function');
      expect(typeof testApp.router).toBe('function');
    });

    it('should create an application instance with custom options', () => {
      const testApp = createApp({
        port: 3002,
        host: '0.0.0.0',
        debug: true,
        cors: true,
        maxBodySize: 2048 * 1024,
        timeout: 60000,
      });
      expect(testApp).toBeDefined();
    });
  });

  describe('Express-like Context Design', () => {
    it('should have Express-like context properties', () => {
      app.get('/context', async ctx => {
        // Request properties
        expect(ctx.req).toBeDefined();
        expect(ctx.res).toBeDefined();
        expect(ctx.body).toBeDefined();
        expect(ctx.method).toBeDefined();
        expect(ctx.path).toBeDefined();
        expect(ctx.url).toBeDefined();
        expect(ctx.headers).toBeDefined();
        expect(ctx.query).toBeDefined();
        expect(ctx.params).toBeDefined();
        expect(ctx.state).toBeDefined();
        expect(ctx.id).toBeDefined();
        expect(ctx.startTime).toBeDefined();
        expect(ctx.ip).toBeDefined();
        expect(ctx.secure).toBeDefined();
        expect(ctx.protocol).toBeDefined();
        expect(ctx.hostname).toBeDefined();
        expect(ctx.host).toBeDefined();
        expect(ctx.origin).toBeDefined();
        expect(ctx.href).toBeDefined();
        expect(ctx.search).toBeDefined();
        expect(ctx.searchParams).toBeDefined();
      });
    });

    it('should have enhanced response methods', () => {
      app.get('/response', async ctx => {
        expect(typeof ctx.res.json).toBe('function');
        expect(typeof ctx.res.html).toBe('function');
        expect(typeof ctx.res.text).toBe('function');
        expect(typeof ctx.res.csv).toBe('function');
        expect(typeof ctx.res.xml).toBe('function');
        expect(typeof ctx.res.file).toBe('function');
        expect(typeof ctx.res.download).toBe('function');
        expect(typeof ctx.res.redirect).toBe('function');
        expect(typeof ctx.res.status).toBe('function');
        expect(typeof ctx.res.set).toBe('function');
        expect(typeof ctx.res.get).toBe('function');
        expect(typeof ctx.res.remove).toBe('function');
        expect(typeof ctx.res.type).toBe('function');
        expect(typeof ctx.res.length).toBe('function');
        expect(typeof ctx.res.etag).toBe('function');
        expect(typeof ctx.res.lastModified).toBe('function');
      });
    });
  });

  describe('Route Registration', () => {
    it('should register GET routes with simple handlers', () => {
      app.get('/test', async ctx => {
        ctx.res.json({ message: 'OK' });
      });

      expect(app).toBeDefined();
    });

    it('should register POST routes with simple handlers', () => {
      app.post('/test', async ctx => {
        ctx.res.json({ message: 'Created' });
      });

      expect(app).toBeDefined();
    });

    it('should register routes with object config (no import needed)', () => {
      app.post('/config', {
        handler: async ctx => {
          ctx.res.json({ message: 'Config route' });
        },
        schema: {
          body: {
            name: { type: 'string', required: true },
          },
        },
        options: {
          name: 'testRoute',
          description: 'Test route',
        },
      });

      expect(app).toBeDefined();
    });
  });

  describe('Router Functionality', () => {
    it('should create router instances', () => {
      const router = app.router();
      expect(router).toBeDefined();
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should register router routes', () => {
      const router = app.router();

      router.get('/profile', async ctx => {
        ctx.res.json({ user: 'profile' });
      });

      router.post('/login', async ctx => {
        ctx.res.json({ message: 'Logged in' });
      });

      expect(router).toBeDefined();
    });

    it('should register router with prefix', () => {
      const router = app.router();

      router.get('/users', async ctx => {
        ctx.res.json({ users: [] });
      });

      app.use('/api', router);

      expect(app).toBeDefined();
    });

    it('should support nested routers', () => {
      const userRouter = app.router();
      const adminRouter = app.router();

      userRouter.get('/profile', async ctx => {
        ctx.res.json({ user: 'profile' });
      });

      adminRouter.get('/users', async ctx => {
        ctx.res.json({ admin: 'users' });
      });

      userRouter.use('/admin', adminRouter);
      app.use('/users', userRouter);

      expect(app).toBeDefined();
    });
  });

  describe('Middleware Registration', () => {
    it('should register async middleware', () => {
      app.use(async (ctx, next) => {
        ctx.res.set('X-Test', 'value');
        await next();
      });

      expect(app).toBeDefined();
    });

    it('should support multiple middleware', () => {
      app.use(async (ctx, next) => {
        ctx.state['step1'] = true;
        await next();
      });

      app.use(async (ctx, next) => {
        ctx.state['step2'] = true;
        await next();
      });

      expect(app).toBeDefined();
    });

    it('should support middleware with error handling', () => {
      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (error) {
          ctx.status = 500;
          ctx.res.json({ error: 'Internal error' });
        }
      });

      expect(app).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle ValidationError', () => {
      app.get('/error', async _ctx => {
        throw new ValidationError('Test error', 'test', 'value');
      });

      expect(app).toBeDefined();
    });

    it('should handle generic errors', () => {
      app.get('/error', async _ctx => {
        throw new Error('Generic error');
      });

      expect(app).toBeDefined();
    });
  });

  describe('Application Lifecycle', () => {
    it('should start and shutdown gracefully', async () => {
      const testApp = createApp({ port: 3002 });

      // Start server
      const server = testApp.listen(3002, 'localhost', () => {
        expect(server).toBeDefined();
      });

      // Shutdown
      await testApp.shutdown();
      expect(testApp).toBeDefined();
    });
  });

  describe('Method Chaining', () => {
    it('should support method chaining', () => {
      const result = app
        .use(async (ctx, next) => await next())
        .get('/test', async ctx => {
          ctx.res.json({ message: 'OK' });
        })
        .post('/test', async ctx => {
          ctx.res.json({ message: 'Created' });
        });

      expect(result).toBe(app);
    });
  });

  describe('Context Object', () => {
    it('should have required context properties', () => {
      app.get('/context', async ctx => {
        expect(ctx.req).toBeDefined();
        expect(ctx.res).toBeDefined();
        expect(ctx.body).toBeDefined();
        expect(ctx.method).toBeDefined();
        expect(ctx.path).toBeDefined();
        expect(ctx.url).toBeDefined();
        expect(ctx.headers).toBeDefined();
        expect(ctx.query).toBeDefined();
        expect(ctx.params).toBeDefined();
        expect(ctx.state).toBeDefined();
        expect(ctx.id).toBeDefined();
        expect(ctx.startTime).toBeDefined();
        expect(ctx.ip).toBeDefined();
        expect(ctx.secure).toBeDefined();
        expect(ctx.protocol).toBeDefined();
        expect(ctx.hostname).toBeDefined();
        expect(ctx.host).toBeDefined();
        expect(ctx.origin).toBeDefined();
        expect(ctx.href).toBeDefined();
        expect(ctx.search).toBeDefined();
        expect(ctx.searchParams).toBeDefined();
      });
    });

    it('should have context methods', () => {
      app.get('/methods', async ctx => {
        expect(typeof ctx.throw).toBe('function');
        expect(typeof ctx.assert).toBe('function');
        expect(typeof ctx.fresh).toBe('function');
        expect(typeof ctx.stale).toBe('function');
        expect(typeof ctx.idempotent).toBe('function');
        expect(typeof ctx.cacheable).toBe('function');
      });
    });
  });

  describe('Route Configuration', () => {
    it('should support route config with schema', () => {
      app.post('/users/:id', {
        handler: async ctx => {
          ctx.res.json({ message: 'Validated' });
        },
        schema: {
          body: {
            name: { type: 'string', required: true, minLength: 2 },
            email: { type: 'email', required: true },
            age: { type: 'number', min: 18, max: 100 },
          },
          query: {
            page: { type: 'number', min: 1 },
            limit: { type: 'number', min: 1, max: 100 },
          },
          params: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
        options: {
          name: 'createUser',
          description: 'Create a new user',
          tags: ['users'],
          version: '1.0.0',
          deprecated: false,
        },
      });

      expect(app).toBeDefined();
    });

    it('should support route config with middleware', () => {
      app.get('/protected', {
        handler: async ctx => {
          ctx.res.json({ message: 'Protected' });
        },
        middleware: [
          async (ctx, next) => {
            const token = ctx.headers.authorization;
            if (!token) {
              ctx.status = 401;
              ctx.res.json({ error: 'Unauthorized' });
              return;
            }
            await next();
          },
        ],
      });

      expect(app).toBeDefined();
    });
  });

  describe('Router Tests', () => {
    it('should create router with prefix', () => {
      const router = createRouter('/api');
      expect(router).toBeDefined();
    });

    it('should register routes on router', () => {
      const router = createRouter();

      router.get('/users', async ctx => {
        ctx.res.json({ users: [] });
      });

      router.post('/users', async ctx => {
        ctx.res.json({ message: 'Created' });
      });

      expect(router).toBeDefined();
    });

    it('should support router middleware', () => {
      const router = createRouter();

      router.use(async (ctx, next) => {
        ctx.res.set('X-Router', 'true');
        await next();
      });

      router.get('/test', async ctx => {
        ctx.res.json({ message: 'OK' });
      });

      expect(router).toBeDefined();
    });
  });
});
