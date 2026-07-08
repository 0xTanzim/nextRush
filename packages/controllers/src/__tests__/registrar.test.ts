/**
 * @nextrush/controllers - registerControllers() Integration Tests
 *
 * Covers the public registrar entry point itself (not the lower-level
 * ControllerRegistry/buildRoutes, which have their own unit tests) — the
 * no-router error, the container fallback chain, and manual registration.
 */

import { Application } from '@nextrush/core';
import { Controller, Get, UseGuard, type CanActivate } from '@nextrush/decorators';
import { Service, createContainer, inject, type Container } from '@nextrush/di';
import { Router } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { ControllerResolutionError } from '../errors.js';
import { registerControllers } from '../registrar.js';

@Service()
class GreetingService {
  greet(): string {
    return 'hello';
  }
}

@Controller('/greet')
class GreetController {
  constructor(private readonly greeting: GreetingService) {}

  @Get()
  say() {
    return { message: this.greeting.greet() };
  }
}

// Dependency-free controller: resolvable everywhere, including under esbuild
// (vitest's transformer), which does not emit `design:paramtypes` metadata and
// therefore cannot inject implicit constructor dependencies. Used to exercise
// the eager-validation happy path.
@Controller('/health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Controller('/broken')
class BrokenController {
  constructor(@inject('MISSING_SERVICE_TOKEN') private readonly missing: unknown) {}

  @Get()
  list() {
    void this.missing;
    return [];
  }
}

// Dependency-free class guard: resolvable everywhere, used to exercise the
// eager guard-validation happy path.
class PassGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

// Class guard with an unsatisfiable constructor dependency (@inject of an
// unregistered token). Resolving it must fail — the fix surfaces that failure
// at boot instead of on the first request to the guarded route.
class BrokenGuard implements CanActivate {
  constructor(@inject('MISSING_GUARD_TOKEN') private readonly missing: unknown) {}

  canActivate(): boolean {
    void this.missing;
    return true;
  }
}

@UseGuard(PassGuard)
@Controller('/guarded-ok')
class GuardedOkController {
  @Get()
  list() {
    return [];
  }
}

@UseGuard(BrokenGuard)
@Controller('/guarded-broken')
class GuardedBrokenController {
  @Get()
  list() {
    return [];
  }
}

describe('registerControllers()', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it('should throw a clear error when the app has no router configured', async () => {
    const app = new Application(); // @nextrush/core's bare Application — no router injected

    await expect(registerControllers(app, { controllers: [GreetController] })).rejects.toThrow(
      'registerControllers() requires an app with a router'
    );
  });

  it('should register manually-provided controllers on app.router', async () => {
    const app = new Application({ router });

    // Wiring test: GreetController's implicit constructor dep can't be DI-resolved
    // under esbuild (no emitDecoratorMetadata), so validation is scoped out here —
    // eager DI validation is covered by the "eager DI validation" describe block.
    await registerControllers(app, { controllers: [GreetController], validate: false });

    const match = router.match('GET', '/greet');
    expect(match).not.toBeNull();
  });

  it('should prefer options.container over app.container', async () => {
    const optionsContainer: Container = createContainer();
    optionsContainer.register(GreetingService, { useClass: GreetingService });
    const appContainer: Container = createContainer();
    const app = new Application({ router, container: appContainer });

    await registerControllers(app, {
      controllers: [GreetController],
      container: optionsContainer,
      validate: false,
    });

    // Resolvable via the container we explicitly passed, not app.container
    expect(optionsContainer.isRegistered(GreetController)).toBe(true);
  });

  it('should fall back to app.container when no options.container is given', async () => {
    const appContainer: Container = createContainer();
    const app = new Application({ router, container: appContainer });

    await registerControllers(app, { controllers: [GreetController], validate: false });

    expect(appContainer.isRegistered(GreetController)).toBe(true);
  });

  it('should warn (not throw) and register nothing when zero controllers are found', async () => {
    const app = new Application({ router });

    await expect(registerControllers(app, {})).resolves.toBeUndefined();
    expect(router.match('GET', '/greet')).toBeNull();
  });

  it('should silently discover zero controllers for a non-existent root (readdir failure is swallowed, not a DiscoveryError)', async () => {
    const app = new Application({ router });

    // Verified against discovery.ts: scanDirectory() catches readdir() failures
    // internally and returns no files — there's nothing for `strict` to throw on.
    await expect(
      registerControllers(app, { root: './__does_not_exist__', strict: true })
    ).resolves.toBeUndefined();
    expect(router.match('GET', '/greet')).toBeNull();
  });

  describe('eager DI validation', () => {
    it('rejects at boot when a registered controller has an unresolvable dependency', async () => {
      const app = new Application({ router, container: createContainer() });

      // BrokenController @inject('MISSING_SERVICE_TOKEN') — never registered, so
      // resolution must fail at registration instead of on the first request.
      await expect(
        registerControllers(app, { controllers: [BrokenController] })
      ).rejects.toThrow(ControllerResolutionError);
    });

    it('names the failing controller in the boot-time error', async () => {
      const app = new Application({ router, container: createContainer() });

      await expect(
        registerControllers(app, { controllers: [BrokenController] })
      ).rejects.toThrow(/BrokenController/);
    });

    it('still registers a resolvable controller with validation on (default)', async () => {
      const app = new Application({ router, container: createContainer() });

      await expect(
        registerControllers(app, { controllers: [HealthController] })
      ).resolves.toBeUndefined();
      expect(router.match('GET', '/health')).not.toBeNull();
    });

    it('lets callers opt out of validation with validate: false', async () => {
      const app = new Application({ router, container: createContainer() });

      // With validation disabled, an unresolvable dependency no longer fails at
      // boot — routes register and the failure is deferred to request time.
      await expect(
        registerControllers(app, { controllers: [BrokenController], validate: false })
      ).resolves.toBeUndefined();
      expect(router.match('GET', '/broken')).not.toBeNull();
    });
  });

  describe('eager class-guard validation', () => {
    it('rejects at boot when a route uses a class guard with an unresolvable dependency', async () => {
      const container = createContainer();
      // Guards are resolved from DI at request time in builder.ts; register the
      // class guard so resolution attempts injection and fails on its missing dep.
      container.register(BrokenGuard, { useClass: BrokenGuard });
      const app = new Application({ router, container });

      // Without eager guard validation this resolves the (dependency-free)
      // controller, never touches the guard, and only 500s on the first request.
      await expect(
        registerControllers(app, { controllers: [GuardedBrokenController], container })
      ).rejects.toThrow(/BrokenGuard/);
    });

    it('still registers a controller whose class guard resolves cleanly', async () => {
      const container = createContainer();
      container.register(PassGuard, { useClass: PassGuard });
      const app = new Application({ router, container });

      await expect(
        registerControllers(app, { controllers: [GuardedOkController], container })
      ).resolves.toBeUndefined();
      expect(router.match('GET', '/guarded-ok')).not.toBeNull();
    });

    it('skips guard validation when validate: false, deferring the failure to request time', async () => {
      const container = createContainer();
      container.register(BrokenGuard, { useClass: BrokenGuard });
      const app = new Application({ router, container });

      await expect(
        registerControllers(app, {
          controllers: [GuardedBrokenController],
          container,
          validate: false,
        })
      ).resolves.toBeUndefined();
      expect(router.match('GET', '/guarded-broken')).not.toBeNull();
    });
  });
});
