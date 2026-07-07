/**
 * @nextrush/controllers - registerControllers() Integration Tests
 *
 * Covers the public registrar entry point itself (not the lower-level
 * ControllerRegistry/buildRoutes, which have their own unit tests) — the
 * no-router error, the container fallback chain, and manual registration.
 */

import { Application } from '@nextrush/core';
import { Controller, Get } from '@nextrush/decorators';
import { Service, createContainer, type Container } from '@nextrush/di';
import { Router } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
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

    await registerControllers(app, { controllers: [GreetController] });

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
    });

    // Resolvable via the container we explicitly passed, not app.container
    expect(optionsContainer.isRegistered(GreetController)).toBe(true);
  });

  it('should fall back to app.container when no options.container is given', async () => {
    const appContainer: Container = createContainer();
    const app = new Application({ router, container: appContainer });

    await registerControllers(app, { controllers: [GreetController] });

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
});
