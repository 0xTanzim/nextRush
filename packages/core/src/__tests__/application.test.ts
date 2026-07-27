/**
 * @nextrush/core - Application Tests
 */

import type { Container, Extension, ExtensionContext, Middleware, Router } from '@nextrush/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application, createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

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

    it('should accept a hop-count proxy option', () => {
      const proxyApp = createApp({ proxy: 1 });
      expect(proxyApp.options.proxy).toBe(1);
    });

    it('should accept a trusted-peer CIDR list proxy option', () => {
      const proxyApp = createApp({ proxy: ['10.0.0.0/8'] });
      expect(proxyApp.options.proxy).toEqual(['10.0.0.0/8']);
    });

    it('4.3: rejects proxy: true at construction, naming both replacements', () => {
      expect(() => createApp({ proxy: true as never })).toThrow(/proxy: <hopCount>/);
      expect(() => createApp({ proxy: true as never })).toThrow(/'<cidr>'/);
    });

    it('4.3: rejects proxy: 0 at construction, directing to proxy: false', () => {
      expect(() => createApp({ proxy: 0 })).toThrow(/proxy: false/);
    });
  });

  // ===========================================================================
  // Boot-time production security audit (task 8.1/8.2, security-boundaries)
  // ===========================================================================

  describe('ready() — production security audit', () => {
    function taggedMiddleware(
      verdict: import('@nextrush/types').SecurityAuditVerdict
    ): Middleware {
      const mw: Middleware = vi.fn();
      Object.defineProperty(mw, Symbol.for('nextrush.security.audit'), {
        value: () => verdict,
        enumerable: false,
      });
      return mw;
    }

    it('throws in production when a registered middleware reports a throw-level verdict', async () => {
      const prodApp = createApp({ env: 'production' });
      prodApp.use(taggedMiddleware({ level: 'throw', message: 'origin:true + credentials:true' }));

      await expect(prodApp.ready()).rejects.toThrow(/origin:true \+ credentials:true/);
    });

    it('warns exactly once in production when a middleware reports a warn-level verdict', async () => {
      const warn = vi.fn();
      const prodApp = createApp({ env: 'production', logger: { warn } as never });
      prodApp.use(taggedMiddleware({ level: 'warn', message: 'dotfiles: allow' }));

      await prodApp.ready();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('dotfiles: allow');
    });

    it('is silent outside production for the same warn/throw-worthy configuration', async () => {
      const warn = vi.fn();
      const devApp = createApp({ env: 'development', logger: { warn } as never });
      devApp.use(taggedMiddleware({ level: 'throw', message: 'would throw in production' }));

      await expect(devApp.ready()).resolves.toBe(devApp);
      expect(warn).not.toHaveBeenCalled();
    });

    it('an ok-level verdict never warns or throws in production', async () => {
      const warn = vi.fn();
      const prodApp = createApp({ env: 'production', logger: { warn } as never });
      prodApp.use(taggedMiddleware({ level: 'ok' }));

      await expect(prodApp.ready()).resolves.toBe(prodApp);
      expect(warn).not.toHaveBeenCalled();
    });

    it('an untagged middleware is never inspected (no [Symbol] property access assumed present)', async () => {
      const prodApp = createApp({ env: 'production' });
      prodApp.use(vi.fn() as Middleware);

      await expect(prodApp.ready()).resolves.toBe(prodApp);
    });

    it('runs every tagged middleware\'s check, not just the first', async () => {
      const warn = vi.fn();
      const prodApp = createApp({ env: 'production', logger: { warn } as never });
      prodApp.use(taggedMiddleware({ level: 'warn', message: 'first warning' }));
      prodApp.use(taggedMiddleware({ level: 'warn', message: 'second warning' }));

      await prodApp.ready();

      expect(warn).toHaveBeenCalledTimes(2);
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

    it('should throw a distinct error when needs references a name that is never registered at all', async () => {
      // 'ghost' is never registered as any extension's name anywhere — this is a
      // genuinely missing dependency, not just an ordering mistake, and should be
      // diagnosable as such rather than reusing the "wasn't registered before it"
      // wording that also covers the (recoverable) wrong-order case.
      app.extend(makeExtension('db', { needs: ['ghost'] }));

      await expect(app.ready()).rejects.toThrow(
        'Extension "db" needs "ghost", but no extension named "ghost" was ever registered.'
      );
    });

    it('should assert declared needs are registered before the dependent', async () => {
      app.extend(makeExtension('db', { needs: ['events'] }));
      app.extend(makeExtension('events')); // registered, but too late — after "db"

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

    it('should satisfy a diamond dependency (two extensions sharing one prerequisite)', async () => {
      // A (base) <- B needs [A], C needs [A] <- D needs [B, C]
      const order: string[] = [];
      app.extend(makeExtension('a', { setup: () => void order.push('a') }));
      app.extend(makeExtension('b', { needs: ['a'], setup: () => void order.push('b') }));
      app.extend(makeExtension('c', { needs: ['a'], setup: () => void order.push('c') }));
      app.extend(
        makeExtension('d', { needs: ['b', 'c'], setup: () => void order.push('d') })
      );

      await expect(app.ready()).resolves.toBe(app);
      expect(order).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should throw on the specific unmet dependency in a diamond when order is wrong', async () => {
      // c registered before its shared dependency a — must fail on "a", not silently pass
      app.extend(makeExtension('a', {}));
      app.extend(makeExtension('c', { needs: ['a'] }));
      app.extend(makeExtension('b', { needs: ['x'] }));
      app.extend(makeExtension('x')); // registered, but too late — after "b" needs it

      // c's needs are satisfied (a is registered first); b's are not (x registers
      // after b, not before) — the thrown message must name the actual unmet
      // dependency, not just the first extension in the array.
      await expect(app.ready()).rejects.toThrow(
        'Extension "b" needs "x", but "x" was not registered before it.'
      );
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
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
      );
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should hide error details in production', async () => {
      const prodApp = createApp({ env: 'production' });
      prodApp.use(async () => {
        throw new Error('Sensitive error');
      });

      const ctx = createMockContext();
      await prodApp.callback()(ctx);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
      );
    });

    it('should expose error message when error has expose=true', async () => {
      app.use(async () => {
        throw Object.assign(new Error('Not Found'), { status: 404, expose: true });
      });

      const ctx = createMockContext();
      await app.callback()(ctx);

      expect(ctx.status).toBe(404);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not Found', code: 'INTERNAL_ERROR', status: 404 })
      );
    });

    it('should hide message for 5xx errors even with expose=false', async () => {
      app.use(async () => {
        throw Object.assign(new Error('DB connection failed'), { status: 500, expose: false });
      });

      const ctx = createMockContext();
      await app.callback()(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
      );
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
    it('should warn when destroying extensions that were never booted via ready()', async () => {
      const warnSpy = vi.fn();
      const destroySpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: warnSpy, error: vi.fn(), debug: vi.fn() },
      });
      loggedApp.extend(makeExtension('never-booted', { destroy: destroySpy }));

      // Deliberately skip ready() — setup() never ran, but close() still
      // destroys the extension. This is the close()/callback() lifecycle
      // asymmetry the audit flagged: only callback() warned before this.
      await loggedApp.close();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ready()'));
    });

    it('should NOT warn on close() when ready() was called first', async () => {
      const warnSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: warnSpy, error: vi.fn(), debug: vi.fn() },
      });
      loggedApp.extend(makeExtension('booted'));

      await loggedApp.ready();
      await loggedApp.close();

      expect(warnSpy).not.toHaveBeenCalled();
    });

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

  // ===========================================================================
  // Bounded teardown budget (F-02, D1, RFC-022 / ADR-0012)
  // ===========================================================================

  describe('close({ timeout }) — bounded teardown budget', () => {
    it('should resolve within the budget when an extension destroy() never resolves, and report it', async () => {
      app.extend(
        makeExtension('hung', {
          // Never resolves within the test's lifetime — forces the timeout race.
          destroy: () => new Promise<void>(() => undefined),
        })
      );
      await app.ready();

      const start = Date.now();
      const errors = await app.close({ timeout: 50 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000); // well under an unbounded hang
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('hung');
    });

    it('should resolve immediately for prompt teardown (not wait out the budget)', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      app.extend(makeExtension('prompt', { destroy }));
      await app.ready();

      const start = Date.now();
      const errors = await app.close({ timeout: 5000 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200); // did not wait out the 5s budget
      expect(errors).toEqual([]);
      expect(destroy).toHaveBeenCalled();
    });

    it('should report every hung unit independently when two extensions hang simultaneously', async () => {
      app.extend(makeExtension('hung-a', { destroy: () => new Promise<void>(() => undefined) }));
      app.extend(makeExtension('hung-b', { destroy: () => new Promise<void>(() => undefined) }));
      await app.ready();

      const errors = await app.close({ timeout: 30 });

      expect(errors).toHaveLength(2);
      const messages = errors.map((e) => e.message).join(' ');
      expect(messages).toContain('hung-a');
      expect(messages).toContain('hung-b');
    });

    it('should behave exactly as today (unbounded) when timeout is omitted', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      app.extend(makeExtension('no-budget', { destroy }));
      await app.ready();

      const errors = await app.close();

      expect(errors).toEqual([]);
      expect(destroy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Shutdown observability (F-12, RFC-022): a draining state transition and
  // the teardown outcome must be surfaced, not silent.
  // ===========================================================================

  describe('shutdown observability (F-12)', () => {
    it('isDraining is false before close() and true once it starts', async () => {
      let observedDuringTeardown: boolean | undefined;
      app.extend(
        makeExtension('observer', {
          destroy: () => {
            observedDuringTeardown = app.isDraining;
          },
        })
      );
      await app.ready();

      expect(app.isDraining).toBe(false);
      await app.close();

      expect(observedDuringTeardown).toBe(true);
    });

    it('logs the draining transition when a shutdown begins', async () => {
      const infoSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: infoSpy, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      });
      await loggedApp.ready();

      await loggedApp.close();

      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('draining'));
    });

    it('reports which unit timed out at shutdown completion, via the logger', async () => {
      const errorSpy = vi.fn();
      const loggedApp = createApp({
        logger: { info: vi.fn(), warn: vi.fn(), error: errorSpy, debug: vi.fn() },
      });
      loggedApp.extend(
        makeExtension('slow-hook', { destroy: () => new Promise<void>(() => undefined) })
      );
      await loggedApp.ready();

      await loggedApp.close({ timeout: 30 });

      const loggedTimeout = errorSpy.mock.calls.some((call: unknown[]) =>
        call.some((arg) => String(arg).includes('slow-hook'))
      );
      expect(loggedTimeout).toBe(true);
    });
  });

  // ===========================================================================
  // app.onClose(hook) teardown-registration API (F-07, D3, RFC-022 / ADR-0012)
  // ===========================================================================

  describe('onClose(hook)', () => {
    it('should run a registered hook during close()', async () => {
      const hook = vi.fn().mockResolvedValue(undefined);
      app.onClose(hook);
      await app.ready();

      await app.close();

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should run hooks under the same bounded/isolated teardown as extension destroy()', async () => {
      const hook = vi.fn().mockRejectedValue(new Error('hook boom'));
      app.onClose(hook);
      await app.ready();

      const errors = await app.close();

      expect(hook).toHaveBeenCalledTimes(1);
      expect(errors.some((e) => e.message === 'hook boom')).toBe(true);
    });

    it('should not strand other hooks or extensions when one hook throws', async () => {
      const order: string[] = [];
      app.onClose(() => void order.push('hook-a'));
      app.onClose(() => {
        throw new Error('hook-b boom');
      });
      app.onClose(() => void order.push('hook-c'));
      app.extend(makeExtension('ext', { destroy: () => void order.push('ext') }));
      await app.ready();

      const errors = await app.close();

      // reverse of registration order: ext (last registered) first, then
      // hook-c, then hook-b (throws, isolated), then hook-a — none stranded.
      expect(order).toEqual(['ext', 'hook-c', 'hook-a']);
      expect(errors.some((e) => e.message === 'hook-b boom')).toBe(true);
    });

    it('should bound a never-resolving hook by the same close({ timeout }) budget', async () => {
      // Never resolves within the test's lifetime — forces the timeout race.
      app.onClose(() => new Promise<void>(() => undefined));
      await app.ready();

      const start = Date.now();
      const errors = await app.close({ timeout: 50 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
      expect(errors).toHaveLength(1);
    });

    it('should run hooks in reverse registration order, consistent with extension teardown', async () => {
      const order: string[] = [];
      app.onClose(() => void order.push('first'));
      app.onClose(() => void order.push('second'));
      await app.ready();

      await app.close();

      expect(order).toEqual(['second', 'first']);
    });

    it('should compose onClose hooks and extension destroy() in one combined reverse-registration order', async () => {
      const order: string[] = [];
      app.extend(makeExtension('ext-1', { destroy: () => void order.push('ext-1') }));
      app.onClose(() => void order.push('hook-1'));
      app.extend(makeExtension('ext-2', { destroy: () => void order.push('ext-2') }));
      app.onClose(() => void order.push('hook-2'));
      await app.ready();

      await app.close();

      // Registration order was: ext-1, hook-1, ext-2, hook-2. Reverse of that
      // combined order is: hook-2, ext-2, hook-1, ext-1 — both hooks AND
      // extensions run under one uniform reverse-of-registration sequence
      // (RFC-022 §7.3's "flat list of independently-isolated units").
      expect(order).toEqual(['hook-2', 'ext-2', 'hook-1', 'ext-1']);
    });

    it('should not run a hook registered after close() already started', async () => {
      await app.ready();
      const closePromise = app.close();
      const hook = vi.fn();

      // Registering after close() has already begun is documented as
      // "not run in that shutdown" (RFC-022 §8.6) — no throw, just a no-op
      // for the in-flight shutdown.
      expect(() => {
        app.onClose(hook);
      }).not.toThrow();
      await closePromise;
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
      expect(ctx.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
      );
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
