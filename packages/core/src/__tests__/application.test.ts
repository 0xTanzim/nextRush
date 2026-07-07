/**
 * @nextrush/core - Application Tests
 */

import type { Container, Context, Extension, ExtensionContext, Middleware, Router } from '@nextrush/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application, createApp } from '../application';

// Mock context for testing
function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    state: {},
    raw: {
      req: {} as never,
      res: {} as never,
    },
    ...overrides,
  } as Context;
}

/** Build a minimal valid extension for tests. */
function makeExtension(name: string, over: Partial<Extension> = {}): Extension {
  return { name, setup: vi.fn(), ...over };
}

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createApp()', () => {
    it('should create an Application instance', () => {
      expect(app).toBeInstanceOf(Application);
    });

    it('should create with default options', () => {
      expect(app.isProduction).toBe(false);
    });

    it('should accept environment option', () => {
      const prodApp = createApp({ env: 'production' });
      expect(prodApp.isProduction).toBe(true);
    });

    it('should accept proxy option', () => {
      const proxyApp = createApp({ proxy: true });
      expect(proxyApp.options.proxy).toBe(true);
    });
  });

  describe('use()', () => {
    it('should register a single middleware', () => {
      const middleware: Middleware = vi.fn();
      app.use(middleware);
      expect(app.middlewareCount).toBe(1);
    });

    it('should register multiple middleware', () => {
      app.use(vi.fn() as Middleware, vi.fn() as Middleware, vi.fn() as Middleware);
      expect(app.middlewareCount).toBe(3);
    });

    it('should return this for chaining', () => {
      const result = app.use(vi.fn() as Middleware);
      expect(result).toBe(app);
    });

    it('should throw TypeError if middleware is not a function', () => {
      expect(() => app.use('not a function' as unknown as Middleware)).toThrow(TypeError);
      expect(() => app.use('not a function' as unknown as Middleware)).toThrow(
        'Middleware must be a function'
      );
    });

    it('should throw for null / undefined middleware', () => {
      expect(() => app.use(null as unknown as Middleware)).toThrow(TypeError);
      expect(() => app.use(undefined as unknown as Middleware)).toThrow(TypeError);
    });
  });

  // ===========================================================================
  // Extension model
  // ===========================================================================

  describe('extend()', () => {
    it('should register an extension and return this for chaining', () => {
      const ext = makeExtension('a');
      const result = app.extend(ext);
      expect(result).toBe(app);
      expect(app.extensionCount).toBe(1);
    });

    it('should NOT run setup() at registration time (deferred to ready())', () => {
      const ext = makeExtension('deferred');
      app.extend(ext);
      expect(ext.setup).not.toHaveBeenCalled();
    });

    it('should throw if an extension with the same name is registered twice', () => {
      app.extend(makeExtension('dup'));
      expect(() => app.extend(makeExtension('dup'))).toThrow(
        'Extension "dup" is already registered'
      );
    });

    it('should throw TypeError if the extension has no setup()', () => {
      expect(() => app.extend({ name: 'bad' } as unknown as Extension)).toThrow(TypeError);
    });

    it('should infer the decorated property on app WITHOUT a cast, from a generic Extension<T>', async () => {
      // A typed extension declares what it decorates via Extension<T>'s type
      // parameter. extend()'s return type merges T into `this` — no
      // `declare module` augmentation, no manual cast, required.
      interface Bus {
        emit(event: string): void;
      }
      const bus: Bus = { emit: vi.fn() };
      const typedExt: Extension<{ bus: Bus }> = {
        name: 'bus-ext',
        setup: (ctx) => ctx.decorate('bus', bus),
      };

      const extended = app.extend(typedExt);
      await extended.ready();

      // No cast: `extended.bus` must be statically known as `Bus`.
      extended.bus.emit('probe');
      expect(bus.emit).toHaveBeenCalledWith('probe');
    });
  });

  describe('ready()', () => {
    it('should run each extension setup() once, in registration order', async () => {
      const order: string[] = [];
      app.extend(makeExtension('first', { setup: () => void order.push('first') }));
      app.extend(makeExtension('second', { setup: () => void order.push('second') }));

      await app.ready();

      expect(order).toEqual(['first', 'second']);
    });

    it('should await async setup()', async () => {
      let done = false;
      app.extend(
        makeExtension('slow', {
          setup: async () => {
            await new Promise((r) => setTimeout(r, 10));
            done = true;
          },
        })
      );

      await app.ready();
      expect(done).toBe(true);
    });

    it('should be idempotent (setup runs at most once)', async () => {
      const ext = makeExtension('once');
      app.extend(ext);

      await app.ready();
      await app.ready();

      expect(ext.setup).toHaveBeenCalledTimes(1);
    });

    it('should pass an ExtensionContext with app, logger, env and name', async () => {
      let received: ExtensionContext | undefined;
      const prodApp = createApp({ env: 'production' });
      prodApp.extend(
        makeExtension('ctx-probe', {
          setup: (ctx) => {
            received = ctx;
          },
        })
      );

      await prodApp.ready();

      expect(received?.app).toBe(prodApp);
      expect(received?.env).toBe('production');
      expect(received?.name).toBe('ctx-probe');
      expect(typeof received?.logger.info).toBe('function');
      expect(typeof received?.decorate).toBe('function');
    });

    it('should expose the app container on the ExtensionContext when configured', async () => {
      const fakeContainer = { resolve: vi.fn(), register: vi.fn() } as unknown as Container;
      const a = createApp({ container: fakeContainer });
      let received: ExtensionContext | undefined;
      a.extend(makeExtension('c', { setup: (ctx) => void (received = ctx) }));

      await a.ready();

      expect(received?.container).toBe(fakeContainer);
      expect(a.container).toBe(fakeContainer);
    });

    it('should assert declared needs are registered before the dependent', async () => {
      app.extend(makeExtension('db', { needs: ['events'] }));

      await expect(app.ready()).rejects.toThrow(
        'Extension "db" needs "events", but "events" was not registered before it.'
      );
    });

    it('should satisfy needs when the dependency is registered earlier', async () => {
      const order: string[] = [];
      app.extend(makeExtension('events', { setup: () => void order.push('events') }));
      app.extend(
        makeExtension('db', { needs: ['events'], setup: () => void order.push('db') })
      );

      await expect(app.ready()).resolves.toBe(app);
      expect(order).toEqual(['events', 'db']);
    });
  });

  describe('decorate() via ExtensionContext + hasDecorator()', () => {
    it('should attach a value to the app that setup() exposes', async () => {
      const bus = { emit: vi.fn() };
      app.extend(
        makeExtension('events', { setup: (ctx) => ctx.decorate('events', bus) })
      );

      await app.ready();

      expect(app.hasDecorator('events')).toBe(true);
      expect((app as unknown as { events: typeof bus }).events).toBe(bus);
    });

    it('should throw on a decoration name collision', async () => {
      app.extend(makeExtension('a', { setup: (ctx) => ctx.decorate('dupDeco', 1) }));
      app.extend(makeExtension('b', { setup: (ctx) => ctx.decorate('dupDeco', 2) }));

      await expect(app.ready()).rejects.toThrow('Decoration "dupDeco" already exists');
    });

    it('should throw when a decoration collides with a core member', async () => {
      app.extend(makeExtension('collide', { setup: (ctx) => ctx.decorate('use', 1) }));
      await expect(app.ready()).rejects.toThrow(
        'Decoration "use" collides with an existing Application member'
      );
    });

    it('hasDecorator() is false for unknown names', () => {
      expect(app.hasDecorator('nope')).toBe(false);
    });
  });

  describe('configuration freeze (after ready / start)', () => {
    it('should prevent use() after ready()', async () => {
      await app.ready();
      expect(() => app.use(vi.fn() as Middleware)).toThrow('configuration is frozen');
    });

    it('should prevent extend() after ready()', async () => {
      await app.ready();
      expect(() => app.extend(makeExtension('late'))).toThrow('configuration is frozen');
    });

    it('should prevent route() after start()', () => {
      app.start();
      expect(() => app.route('/', { routes: () => vi.fn() as Middleware })).toThrow(
        'configuration is frozen'
      );
    });

    it('should allow registration before ready()/start()', () => {
      expect(() => app.use(vi.fn() as Middleware)).not.toThrow();
      expect(() => app.extend(makeExtension('early'))).not.toThrow();
    });
  });

  describe('callback()', () => {
    it('should return a function', () => {
      expect(typeof app.callback()).toBe('function');
    });

    it('should warn when extensions are registered but ready() was never called', async () => {
      const warnSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: warnSpy, error: vi.fn(), debug: vi.fn() },
      });
      loggedApp.extend(makeExtension('forgotten'));

      // Deliberately skip ready() — this is the bug: setup() never runs.
      loggedApp.callback();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('extend()')
      );
    });

    it('should NOT warn when there are no registered extensions (nothing to have skipped)', () => {
      const warnSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: warnSpy, error: vi.fn(), debug: vi.fn() },
      });

      loggedApp.callback();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn when ready() was called first', async () => {
      const warnSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: warnSpy, error: vi.fn(), debug: vi.fn() },
      });
      loggedApp.extend(makeExtension('proper'));

      await loggedApp.ready();
      loggedApp.callback();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should execute middleware in order', async () => {
      const order: number[] = [];
      app.use(async (_ctx, next) => {
        order.push(1);
        await next();
        order.push(4);
      });
      app.use(async (_ctx, next) => {
        order.push(2);
        await next();
        order.push(3);
      });

      await app.callback()(createMockContext());
      expect(order).toEqual([1, 2, 3, 4]);
    });

    it('should handle errors gracefully', async () => {
      const errorSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: vi.fn(), error: errorSpy, debug: vi.fn() },
      });
      loggedApp.use(async () => {
        throw new Error('Test error');
      });

      const ctx = createMockContext();
      await loggedApp.callback()(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should hide error details in production', async () => {
      const prodApp = createApp({ env: 'production' });
      prodApp.use(async () => {
        throw new Error('Sensitive error');
      });

      const ctx = createMockContext();
      await prodApp.callback()(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });

    it('should expose error message when error has expose=true', async () => {
      app.use(async () => {
        throw Object.assign(new Error('Not Found'), { status: 404, expose: true });
      });

      const ctx = createMockContext();
      await app.callback()(ctx);

      expect(ctx.status).toBe(404);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should hide message for 5xx errors even with expose=false', async () => {
      app.use(async () => {
        throw Object.assign(new Error('DB connection failed'), { status: 500, expose: false });
      });

      const ctx = createMockContext();
      await app.callback()(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('lifecycle', () => {
    it('should track running state with start()', () => {
      expect(app.isRunning).toBe(false);
      app.start();
      expect(app.isRunning).toBe(true);
    });

    it('should track ready state', async () => {
      expect(app.isReady).toBe(false);
      await app.ready();
      expect(app.isReady).toBe(true);
    });

    it('should destroy extensions on close()', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      app.extend(makeExtension('cleanup', { destroy }));
      await app.ready();
      app.start();

      const errors = await app.close();

      expect(app.isRunning).toBe(false);
      expect(destroy).toHaveBeenCalled();
      expect(errors).toEqual([]);
    });
  });

  describe('close() resilience', () => {
    it('should not throw when an extension destroy fails, and returns the error', async () => {
      app.extend(
        makeExtension('failing', {
          destroy: () => {
            throw new Error('destroy boom');
          },
        })
      );

      const errors = await app.close();
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toBe('destroy boom');
    });

    it('should destroy all extensions even if one fails (reverse order)', async () => {
      const order: string[] = [];
      app.extend(makeExtension('a', { destroy: () => void order.push('a') }));
      app.extend(
        makeExtension('b', {
          destroy: () => {
            throw new Error('b fails');
          },
        })
      );
      app.extend(makeExtension('c', { destroy: () => void order.push('c') }));

      await app.close();

      // reverse registration order: c before a; b threw
      expect(order).toEqual(['c', 'a']);
    });

    it('should clear the extension registry after close', async () => {
      app.extend(makeExtension('clearable'));
      expect(app.extensionCount).toBe(1);

      await app.close();
      expect(app.extensionCount).toBe(0);
    });
  });

  describe('Logger', () => {
    it('should use a silent no-op logger by default', () => {
      expect(app.logger).toBeDefined();
      expect(() => {
        app.logger.info('x');
        app.logger.warn('x');
        app.logger.error('x');
        app.logger.debug('x');
      }).not.toThrow();
    });

    it('should accept a custom logger', () => {
      const custom = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      expect(createApp({ logger: custom }).logger).toBe(custom);
    });
  });

  describe('setErrorHandler()', () => {
    it('should register and return this for chaining', () => {
      expect(app.setErrorHandler(vi.fn())).toBe(app);
    });

    it('should replace previous handler (setter semantics)', async () => {
      const first = vi.fn();
      const second = vi.fn((_e, ctx) => {
        ctx.status = 418;
        ctx.json({ handler: 'second' });
      });

      app.setErrorHandler(first);
      app.setErrorHandler(second);
      app.use(async () => {
        throw new Error('test');
      });

      await app.callback()(createMockContext());

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalled();
    });

    it('should fall back to default handler if custom handler throws', async () => {
      const app2 = createApp({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } });
      app2.setErrorHandler(() => {
        throw new Error('handler boom');
      });
      app2.use(async () => {
        throw new Error('original');
      });

      const ctx = createMockContext();
      await app2.callback()(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('app-owned router', () => {
    function makeFakeRouter() {
      const routesMw: Middleware = vi.fn(async (_ctx, next) => next());
      return {
        get: vi.fn().mockReturnThis(),
        post: vi.fn().mockReturnThis(),
        put: vi.fn().mockReturnThis(),
        patch: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        head: vi.fn().mockReturnThis(),
        all: vi.fn().mockReturnThis(),
        routes: vi.fn(() => routesMw),
        getRoutes: vi.fn(() => []),
      };
    }

    it('should delegate app.get() to the router and return this', () => {
      const router = makeFakeRouter();
      const a = createApp({ router: router as unknown as Router });
      const handler = vi.fn() as Middleware;

      const result = a.get('/x', handler);

      expect(result).toBe(a);
      expect(router.get).toHaveBeenCalledWith('/x', handler);
    });

    it('should throw a clear error when no router is configured', () => {
      expect(() => app.get('/x', vi.fn() as Middleware)).toThrow('No router configured');
    });

    it('should mount router.routes() last, at ready()', async () => {
      const router = makeFakeRouter();
      const a = createApp({ router: router as unknown as Router });
      expect(a.middlewareCount).toBe(0);

      await a.ready();

      expect(router.routes).toHaveBeenCalled();
      expect(a.middlewareCount).toBe(1);
    });

    it('should delegate every verb', () => {
      const router = makeFakeRouter();
      const a = createApp({ router: router as unknown as Router });

      a.post('/p', vi.fn() as Middleware)
        .put('/u', vi.fn() as Middleware)
        .patch('/pa', vi.fn() as Middleware)
        .delete('/d', vi.fn() as Middleware)
        .head('/h', vi.fn() as Middleware)
        .all('/a', vi.fn() as Middleware);

      expect(router.post).toHaveBeenCalled();
      expect(router.put).toHaveBeenCalled();
      expect(router.patch).toHaveBeenCalled();
      expect(router.delete).toHaveBeenCalled();
      expect(router.head).toHaveBeenCalled();
      expect(router.all).toHaveBeenCalled();
    });
  });
});
