/**
 * BasePlugin Comprehensive Tests
 */

import { createApp } from '@/core/app/application';
import { PluginError } from '@/errors/custom-errors';
import { BasePlugin } from '@/plugins/core/base-plugin';
import type { Application, Context, Middleware } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Simple test plugin
class TestPlugin extends BasePlugin {
  public name = 'TestPlugin';
  public version = '1.0.0';
  public override description = 'A test plugin';
  public override author = 'Test Author';
  public override homepage = 'https://test.com';
  public override license = 'MIT';
  public override keywords = ['test', 'plugin'];

  override onInstall(app: Application): void {
    this.app = app;
  }

  public buildMiddleware(): Middleware {
    return this.createMiddleware(async (ctx, next) => {
      ctx.state['pluginHit'] = true;
      await next();
    });
  }

  // Public methods for testing protected functionality
  public testCreateMiddleware(handler: any): Middleware {
    return this.createMiddleware(handler);
  }

  public testCreateAsyncMiddleware(handler: any): Middleware {
    return this.createAsyncMiddleware(handler);
  }

  public testRegisterMiddleware(middleware: Middleware): void {
    this['registerMiddleware'](middleware);
  }

  public testLog(message: string): void {
    this['log'](message);
  }

  public testLogError(message: string, error?: Error): void {
    this['logError'](message, error);
  }

  public testLogWarning(message: string): void {
    this['logWarning'](message);
  }

  public testLogDebug(message: string): void {
    this['logDebug'](message);
  }

  public testEmit(event: string, ...args: unknown[]): void {
    this['emit'](event, ...args);
  }
}

// Plugin with validation
class ValidatedPlugin extends BasePlugin {
  public name = 'ValidatedPlugin';
  public version = '1.0.0';

  override onInstall(app: Application): void {
    this.app = app;
  }

  override validateConfig(): boolean {
    return this.getConfigValue('required') !== undefined;
  }
}

// Plugin with init method
class InitPlugin extends BasePlugin {
  public name = 'InitPlugin';
  public version = '1.0.0';
  private initCalled = false;

  override onInstall(app: Application): void {
    this.app = app;
  }

  async init(): Promise<void> {
    this.initCalled = true;
    this.isInitialized = true;
  }

  public wasInitCalled(): boolean {
    return this.initCalled;
  }
}

// App mock with event emitter
class MockApp {
  public middlewares: Middleware[] = [];
  public events: Record<string, unknown[]> = {};

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  emit(event: string, ...args: unknown[]): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(args);
  }
}

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    req: {
      method: 'GET',
      url: '/test',
      headers: {},
      ...overrides.req,
    } as any,
    res: {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
      end: () => {},
      ...overrides.res,
    } as any,
    body: undefined,
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    query: {},
    params: {},
    id: 'test-id',
    state: {},
    startTime: Date.now(),
    ip: '127.0.0.1',
    secure: false,
    protocol: 'http',
    hostname: 'localhost',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/test',
    search: '',
    searchParams: new URLSearchParams(),
    status: 200,
    responseHeaders: {},
    throw(status: number, message?: string): never {
      const err = new Error(message || 'Error');
      (err as any).status = status;
      throw err;
    },
    assert(
      condition: unknown,
      status: number,
      message?: string
    ): asserts condition {
      if (!condition) {
        this.throw(status, message);
      }
    },
    fresh: () => false,
    stale: () => true,
    idempotent: () => false,
    cacheable: () => false,
    set(name: string, value: string | number | string[]): void {
      this.responseHeaders[name] = value as any;
    },
    ...overrides,
  } as Context;
}

describe('BasePlugin', () => {
  let app: Application;
  let plugin: TestPlugin;
  let consoleSpy: any;

  beforeEach(() => {
    app = createApp();
    plugin = new TestPlugin();
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => (spy as any).mockRestore());
  });

  describe('Plugin Installation', () => {
    it('should install plugin successfully', () => {
      expect(plugin.isPluginInstalled()).toBe(false);
      plugin.install(app);
      expect(plugin.isPluginInstalled()).toBe(true);
    });

    it('should throw error if plugin is already installed', () => {
      plugin.install(app);
      expect(() => plugin.install(app)).toThrow(PluginError);
      expect(() => plugin.install(app)).toThrow(
        'Plugin TestPlugin is already installed'
      );
    });

    it('should validate configuration during installation', () => {
      const validatedPlugin1 = new ValidatedPlugin();
      expect(() => validatedPlugin1.install(app)).toThrow(PluginError);

      const validatedPlugin2 = new ValidatedPlugin();
      expect(() => validatedPlugin2.install(app)).toThrow(
        'Invalid configuration'
      );
    });

    it('should call init method if it exists', async () => {
      const initPlugin = new InitPlugin();
      initPlugin.install(app);
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(initPlugin.wasInitCalled()).toBe(true);
    });
  });

  describe('Plugin Metadata', () => {
    it('should return correct metadata', () => {
      const metadata = plugin.getMetadata();
      expect(metadata).toEqual({
        name: 'TestPlugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        homepage: 'https://test.com',
        license: 'MIT',
        keywords: ['test', 'plugin'],
        dependencies: [],
        conflicts: [],
      });
    });

    it('should handle missing optional metadata', () => {
      const simplePlugin = new (class extends BasePlugin {
        name = 'Simple';
        version = '1.0.0';
        onInstall() {}
      })();

      const metadata = simplePlugin.getMetadata();
      expect(metadata.description).toBe('');
      expect(metadata.author).toBe('');
      expect(metadata.homepage).toBe('');
      expect(metadata.license).toBe('');
      expect(metadata.keywords).toEqual([]);
    });
  });

  describe('Configuration Management', () => {
    it('should set and get configuration', () => {
      const config = { key1: 'value1', key2: 42 };
      plugin.setConfig(config);

      const retrievedConfig = plugin.getConfig();
      expect(retrievedConfig).toEqual(config);
    });

    it('should merge configurations', () => {
      plugin.setConfig({ key1: 'value1' });
      plugin.setConfig({ key2: 'value2' });

      const config = plugin.getConfig();
      expect(config).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should get specific configuration values', () => {
      plugin.setConfig({ key1: 'value1', key2: 42 });

      expect(plugin.getConfigValue('key1')).toBe('value1');
      expect(plugin.getConfigValue('key2')).toBe(42);
      expect(plugin.getConfigValue('missing')).toBeUndefined();
      expect(plugin.getConfigValue('missing', 'default')).toBe('default');
    });
  });

  describe('Status and Health', () => {
    it('should check installation status', () => {
      expect(plugin.isPluginInstalled()).toBe(false);
      plugin.install(app);
      expect(plugin.isPluginInstalled()).toBe(true);
    });

    it('should check initialization status', () => {
      expect(plugin.isPluginInitialized()).toBe(false);
      // BasePlugin doesn't set initialized by default
    });

    it('should perform health check', async () => {
      const result = await plugin.healthCheck();
      expect(result).toBe(false); // Not installed and not initialized

      plugin.install(app);
      const resultAfterInstall = await plugin.healthCheck();
      expect(resultAfterInstall).toBe(false); // Installed but not initialized
    });

    it('should return plugin status', () => {
      plugin.setConfig({ test: true });
      const status = plugin.getStatus();

      expect(status).toEqual({
        name: 'TestPlugin',
        version: '1.0.0',
        installed: false,
        initialized: false,
        config: { test: true },
      });
    });
  });

  describe('Middleware Creation', () => {
    beforeEach(() => {
      plugin.install(app);
    });

    it('should create middleware successfully', async () => {
      const middleware = plugin.testCreateMiddleware(
        async (ctx: any, next: any) => {
          ctx.state['test'] = 'middleware';
          await next();
        }
      );

      const ctx = createMockContext();
      let nextCalled = false;

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(ctx.state['test']).toBe('middleware');
    });

    it('should handle middleware errors', async () => {
      const middleware = plugin.testCreateMiddleware(async () => {
        throw new Error('Middleware error');
      });

      const ctx = createMockContext();

      await expect(middleware(ctx, async () => {})).rejects.toThrow(
        'Middleware error'
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[TestPlugin] Middleware error',
        expect.any(Error)
      );
    });

    it('should create async middleware', async () => {
      const middleware = plugin.testCreateAsyncMiddleware(
        async (ctx: any, next: any) => {
          ctx.state['async'] = true;
          await next();
        }
      );

      const ctx = createMockContext();
      let nextCalled = false;

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(ctx.state['async']).toBe(true);
    });

    it('should handle async middleware errors', async () => {
      const middleware = plugin.testCreateAsyncMiddleware(async () => {
        throw new Error('Async error');
      });

      const ctx = createMockContext();

      await expect(middleware(ctx, async () => {})).rejects.toThrow(
        'Async error'
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[TestPlugin] Async middleware error',
        expect.any(Error)
      );
    });

    it('should register middleware with application', () => {
      const middleware = plugin.testCreateMiddleware(
        async (_ctx: any, next: any) => {
          await next();
        }
      );

      expect(() => plugin.testRegisterMiddleware(middleware)).not.toThrow();
    });

    it('should throw error when registering middleware without installation', () => {
      const uninstalledPlugin = new TestPlugin();
      const middleware = uninstalledPlugin.testCreateMiddleware(
        async (_ctx: any, next: any) => {
          await next();
        }
      );

      expect(() =>
        uninstalledPlugin.testRegisterMiddleware(middleware)
      ).toThrow(PluginError);
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      plugin.install(app);
    });

    it('should log messages', () => {
      plugin.testLog('Test message');
      expect(consoleSpy.log).toHaveBeenCalledWith('[TestPlugin] Test message');
    });

    it('should log errors', () => {
      const error = new Error('Test error');
      plugin.testLogError('Error occurred', error);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[TestPlugin] Error occurred',
        error
      );
    });

    it('should log warnings', () => {
      plugin.testLogWarning('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[TestPlugin] Warning message'
      );
    });

    it('should log debug messages when debug is enabled', () => {
      plugin.setConfig({ debug: true });
      plugin.testLogDebug('Debug message');
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        '[TestPlugin] Debug message'
      );
    });

    it('should not log debug messages when debug is disabled', () => {
      plugin.setConfig({ debug: false });
      plugin.testLogDebug('Debug message');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    it('should emit events through the application', () => {
      const mockApp = new MockApp() as any;
      plugin.install(mockApp);

      plugin.testEmit('test-event', 'arg1', 'arg2');

      expect(mockApp.events['plugin:TestPlugin:test-event']).toEqual([
        ['arg1', 'arg2'],
      ]);
    });

    it('should handle apps without emit method', () => {
      const appWithoutEmit = { use: () => {} } as any;
      plugin.install(appWithoutEmit);

      expect(() => plugin.testEmit('test-event')).not.toThrow();
    });
  });

  describe('Middleware Compatibility', () => {
    it('returns a (ctx, next) function compatible with Application.use', async () => {
      plugin.install(app);

      const mw = plugin.buildMiddleware();

      // Shape check: function expects two params (ctx, next)
      expect(typeof mw).toBe('function');
      expect(mw.length).toBe(2);

      // Should be accepted by app.use without throwing
      expect(() => app.use(mw)).not.toThrow();

      // Runtime invocation with (ctx, next)
      const ctx = createMockContext();
      let nextCalled = false;
      await mw(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(ctx.state['pluginHit']).toBe(true);
    });
  });
});
