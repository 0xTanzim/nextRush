/**
 * @nextrush/core - Application Tests
 */

import type { Context, Middleware, Plugin, PluginWithHooks } from '@nextrush/types';
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
      const mw1: Middleware = vi.fn();
      const mw2: Middleware = vi.fn();
      const mw3: Middleware = vi.fn();

      app.use(mw1, mw2, mw3);
      expect(app.middlewareCount).toBe(3);
    });

    it('should return this for chaining', () => {
      const middleware: Middleware = vi.fn();
      const result = app.use(middleware);
      expect(result).toBe(app);
    });

    it('should throw TypeError if middleware is not a function', () => {
      expect(() => app.use('not a function' as unknown as Middleware)).toThrow(TypeError);
      expect(() => app.use('not a function' as unknown as Middleware)).toThrow(
        'Middleware must be a function'
      );
    });

    it('should throw for null middleware', () => {
      expect(() => app.use(null as unknown as Middleware)).toThrow(TypeError);
    });

    it('should throw for undefined middleware', () => {
      expect(() => app.use(undefined as unknown as Middleware)).toThrow(TypeError);
    });
  });

  describe('plugin()', () => {
    it('should install a plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        install: vi.fn(),
      };

      app.plugin(plugin);
      expect(plugin.install).toHaveBeenCalledWith(app);
    });

    it('should return this for chaining', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        install: vi.fn(),
      };

      const result = app.plugin(plugin);
      expect(result).toBe(app);
    });

    it('should throw if plugin is already installed', () => {
      const plugin: Plugin = {
        name: 'duplicate-plugin',
        install: vi.fn(),
      };

      app.plugin(plugin);
      expect(() => app.plugin(plugin)).toThrow('Plugin "duplicate-plugin" is already installed');
    });
  });

  describe('getPlugin()', () => {
    it('should return installed plugin', () => {
      const plugin: Plugin = {
        name: 'my-plugin',
        install: vi.fn(),
      };

      app.plugin(plugin);
      expect(app.getPlugin('my-plugin')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(app.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('hasPlugin()', () => {
    it('should return true for installed plugin', () => {
      const plugin: Plugin = {
        name: 'exists',
        install: vi.fn(),
      };

      app.plugin(plugin);
      expect(app.hasPlugin('exists')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(app.hasPlugin('does-not-exist')).toBe(false);
    });
  });

  describe('callback()', () => {
    it('should return a function', () => {
      const handler = app.callback();
      expect(typeof handler).toBe('function');
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

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

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

      const handler = loggedApp.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(ctx.status).toBe(500);
      // Plain Error objects never expose messages (security: prevents leaking internals)
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should hide error details in production', async () => {
      const prodApp = createApp({ env: 'production' });

      prodApp.use(async () => {
        throw new Error('Sensitive error');
      });

      const handler = prodApp.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });

    it('should expose error message when error has expose=true', async () => {
      app.use(async () => {
        const err = Object.assign(new Error('Not Found'), {
          status: 404,
          expose: true,
        });
        throw err;
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(ctx.status).toBe(404);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should hide message for 5xx errors even with expose=false', async () => {
      app.use(async () => {
        const err = Object.assign(new Error('DB connection failed'), {
          status: 500,
          expose: false,
        });
        throw err;
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

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

    it('should cleanup on close()', async () => {
      const plugin: Plugin = {
        name: 'cleanup-test',
        install: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      app.plugin(plugin);
      app.start();

      await app.close();

      expect(app.isRunning).toBe(false);
      expect(plugin.destroy).toHaveBeenCalled();
      expect(app.hasPlugin('cleanup-test')).toBe(false);
    });
  });

  describe('setErrorHandler()', () => {
    it('should register custom error handler', () => {
      const errorHandler = vi.fn();
      const result = app.setErrorHandler(errorHandler);
      expect(result).toBe(app);
    });

    it('should replace previous handler (setter semantics)', async () => {
      const first = vi.fn();
      const second = vi.fn((_error, ctx) => {
        ctx.status = 418;
        ctx.json({ handler: 'second' });
      });

      app.setErrorHandler(first);
      app.setErrorHandler(second);

      app.use(async () => {
        throw new Error('test');
      });

      const handler = app.callback();
      const ctx = createMockContext();
      await handler(ctx);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalled();
    });
  });

  describe('onError() (deprecated)', () => {
    it('should register custom error handler', () => {
      const errorHandler = vi.fn();
      const result = app.onError(errorHandler);

      expect(result).toBe(app);
    });

    it('should use custom error handler when error occurs', async () => {
      const errorHandler = vi.fn((_error, ctx) => {
        ctx.status = 400;
        ctx.json({ custom: 'error' });
      });

      app.onError(errorHandler);

      app.use(async () => {
        throw new Error('Test error');
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(errorHandler).toHaveBeenCalled();
      expect(ctx.json).toHaveBeenCalledWith({ custom: 'error' });
    });

    it('should pass error and context to handler', async () => {
      const errorHandler = vi.fn();

      app.onError(errorHandler);

      const testError = new Error('Specific error');
      app.use(async () => {
        throw testError;
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(errorHandler).toHaveBeenCalledWith(testError, ctx);
    });

    it('should fall back to default handler if custom handler throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      app.onError(errorHandler);

      app.use(async () => {
        throw new Error('Original error');
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(ctx.status).toBe(500);
      // Plain Error objects never expose messages (security: prevents leaking internals)
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });

      consoleSpy.mockRestore();
    });

    it('should support async error handlers', async () => {
      const errorHandler = vi.fn(async (_error, ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        ctx.status = 503;
        ctx.json({ async: 'handler' });
      });

      app.onError(errorHandler);

      app.use(async () => {
        throw new Error('Test');
      });

      const handler = app.callback();
      const ctx = createMockContext();

      await handler(ctx);

      expect(errorHandler).toHaveBeenCalled();
      expect(ctx.json).toHaveBeenCalledWith({ async: 'handler' });
    });
  });

  describe('pluginAsync()', () => {
    it('should install async plugin', async () => {
      const plugin: Plugin = {
        name: 'async-plugin',
        install: vi.fn().mockResolvedValue(undefined),
      };

      const result = await app.pluginAsync(plugin);

      expect(result).toBe(app);
      expect(plugin.install).toHaveBeenCalledWith(app);
      expect(app.hasPlugin('async-plugin')).toBe(true);
    });

    it('should wait for async installation', async () => {
      let installed = false;

      const plugin: Plugin = {
        name: 'slow-plugin',
        install: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          installed = true;
        }),
      };

      await app.pluginAsync(plugin);

      expect(installed).toBe(true);
    });

    it('should throw if async plugin already installed', async () => {
      const plugin: Plugin = {
        name: 'dup-async',
        install: vi.fn().mockResolvedValue(undefined),
      };

      await app.pluginAsync(plugin);

      await expect(app.pluginAsync(plugin)).rejects.toThrow(
        'Plugin "dup-async" is already installed'
      );
    });

    it('should work with synchronous install in pluginAsync', async () => {
      const plugin: Plugin = {
        name: 'sync-via-async',
        install: vi.fn(),
      };

      await app.pluginAsync(plugin);

      expect(app.hasPlugin('sync-via-async')).toBe(true);
    });
  });

  describe('plugin() with async install', () => {
    it('should handle async plugins and return a Promise', async () => {
      const plugin: Plugin = {
        name: 'async-in-sync',
        install: vi.fn().mockResolvedValue(undefined),
      };

      const result = app.plugin(plugin);
      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(app.hasPlugin('async-in-sync')).toBe(true);
    });
  });

  // ===========================================================================
  // Phase 6: DX & Quality of Life
  // ===========================================================================

  describe('Logger', () => {
    it('should use NOOP_LOGGER by default (no console output)', () => {
      const defaultApp = createApp();
      expect(defaultApp.logger).toBeDefined();
      // NOOP_LOGGER methods should not throw
      defaultApp.logger.info('test');
      defaultApp.logger.warn('test');
      defaultApp.logger.error('test');
      defaultApp.logger.debug('test');
    });

    it('should accept a custom logger', () => {
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const loggedApp = createApp({ logger: customLogger });
      expect(loggedApp.logger).toBe(customLogger);
    });

    it('should use custom logger in error handling', async () => {
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const loggedApp = createApp({ logger: customLogger });
      loggedApp.use(() => {
        throw new Error('test error');
      });

      const handler = loggedApp.callback();
      const ctx = createMockContext();
      await handler(ctx);

      expect(customLogger.error).toHaveBeenCalled();
    });
  });

  describe('assertNotRunning()', () => {
    it('should prevent use() after start()', () => {
      app.start();
      expect(() => app.use(vi.fn())).toThrow('Cannot call use() after the application has started');
    });

    it('should prevent route() after start()', () => {
      app.start();
      expect(() => app.route('/', { routes: () => [] })).toThrow(
        'Cannot call route() after the application has started'
      );
    });

    it('should prevent plugin() after start()', () => {
      app.start();
      const plugin: Plugin = { name: 'late', install: vi.fn() };
      expect(() => app.plugin(plugin)).toThrow(
        'Cannot call plugin() after the application has started'
      );
    });

    it('should prevent pluginAsync() after start()', async () => {
      app.start();
      const plugin: Plugin = { name: 'late-async', install: vi.fn() };
      await expect(app.pluginAsync(plugin)).rejects.toThrow(
        'Cannot call plugin() after the application has started'
      );
    });

    it('should allow registration before start()', () => {
      expect(() => app.use(vi.fn())).not.toThrow();
      expect(() => app.plugin({ name: 'early', install: vi.fn() })).not.toThrow();
    });
  });

  describe('close() resilience', () => {
    it('should not throw when a plugin destroy fails', async () => {
      app.plugin({
        name: 'failing-plugin',
        install: vi.fn(),
        destroy: () => {
          throw new Error('destroy boom');
        },
      });

      // Should not throw — returns errors array
      const errors = await app.close();
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toBe('destroy boom');
    });

    it('should destroy all plugins even if one fails', async () => {
      const destroyA = vi.fn();
      const destroyC = vi.fn();

      app.plugin({ name: 'a', install: vi.fn(), destroy: destroyA });
      app.plugin({
        name: 'b',
        install: vi.fn(),
        destroy: () => {
          throw new Error('b fails');
        },
      });
      app.plugin({ name: 'c', install: vi.fn(), destroy: destroyC });

      await app.close();

      expect(destroyA).toHaveBeenCalled();
      expect(destroyC).toHaveBeenCalled();
    });

    it('should clear all plugins after close', async () => {
      app.plugin({ name: 'clearable', install: vi.fn() });
      expect(app.hasPlugin('clearable')).toBe(true);

      await app.close();
      expect(app.hasPlugin('clearable')).toBe(false);
    });
  });

  describe('PluginWithHooks lifecycle', () => {
    it('should call onRequest before middleware', async () => {
      const order: string[] = [];

      const hookedPlugin: PluginWithHooks = {
        name: 'request-hook',
        install: vi.fn(),
        onRequest: () => {
          order.push('onRequest');
        },
      };

      app.plugin(hookedPlugin);
      app.use(() => {
        order.push('middleware');
      });

      const handler = app.callback();
      await handler(createMockContext());

      expect(order).toEqual(['onRequest', 'middleware']);
    });

    it('should call onResponse after middleware', async () => {
      const order: string[] = [];

      const hookedPlugin: PluginWithHooks = {
        name: 'response-hook',
        install: vi.fn(),
        onResponse: () => {
          order.push('onResponse');
        },
      };

      app.plugin(hookedPlugin);
      app.use(async (ctx) => {
        order.push('middleware');
        await ctx.next();
      });

      const handler = app.callback();
      await handler(createMockContext());

      expect(order).toEqual(['middleware', 'onResponse']);
    });

    it('should call onError when middleware throws', async () => {
      const onError = vi.fn();

      const hookedPlugin: PluginWithHooks = {
        name: 'error-hook',
        install: vi.fn(),
        onError,
      };

      app.plugin(hookedPlugin);
      app.use(() => {
        throw new Error('boom');
      });

      const handler = app.callback();
      await handler(createMockContext());

      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    });

    it('should call extendContext before onRequest', async () => {
      const hookedPlugin: PluginWithHooks = {
        name: 'extend-ctx',
        install: vi.fn(),
        extendContext: (ctx: Context) => {
          (ctx.state as Record<string, unknown>)['extended'] = true;
        },
        onRequest: (ctx: Context) => {
          expect((ctx.state as Record<string, unknown>)['extended']).toBe(true);
        },
      };

      app.plugin(hookedPlugin);
      const handler = app.callback();
      await handler(createMockContext());
    });
  });
});
