/**
 * @nextrush/controllers - Per-app DI isolation (CRITICAL-2, opt-in)
 *
 * Proves that `registerControllers(app, { isolate: true })` gives each app its
 * own service singletons, while the default (`isolate: false`) preserves the
 * shared-global-container behavior.
 *
 * Fixtures use explicit `@inject(ServiceClass)` on the controller constructor:
 * vitest transforms these files with esbuild, which does NOT emit
 * `design:paramtypes`, so implicit constructor injection is invisible here. The
 * graph walk therefore has to also read tsyringe's `@inject` token descriptors —
 * these tests exercise that path.
 */

import { Application } from '@nextrush/core';
import { Controller, Get, Post } from '@nextrush/decorators';
import {
  Optional,
  Service,
  container as globalContainer,
  createContainer,
  inject,
  type Container,
} from '@nextrush/di';
import { Router } from '@nextrush/router';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerControllers } from '../registrar.js';

/** Minimal Context stub whose `json()` captures the serialized payload. */
function createCapturingContext(method: string, path: string): {
  ctx: Context;
  captured: () => unknown;
} {
  let payload: unknown;
  const ctx = {
    method: method as Context['method'],
    url: path,
    path,
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state: {},
    responded: false,
    json: (data: unknown) => {
      payload = data;
    },
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: async () => {},
    raw: { req: {}, res: { writableEnded: false } },
  } as unknown as Context;
  return { ctx, captured: () => payload };
}

/** Drive a matched route handler and return whatever it sent via `ctx.json`. */
async function hit(router: Router, method: string, path: string): Promise<unknown> {
  const match = router.match(method, path);
  if (!match) throw new Error(`no route matched: ${method} ${path}`);
  const { ctx, captured } = createCapturingContext(method, path);
  await match.handler(ctx);
  return captured();
}

// --- Fixtures for the isolation proof (test 1) --------------------------------

@Service()
class IsolatedCounter {
  count = 0;
  inc(): void {
    this.count += 1;
  }
}

@Controller('/counter')
class IsolatedCounterController {
  constructor(@inject(IsolatedCounter) private readonly counter: IsolatedCounter) {}

  @Get('/value')
  value() {
    return { count: this.counter.count };
  }

  @Post('/inc')
  bump() {
    this.counter.inc();
    return { count: this.counter.count };
  }
}

// --- Fixtures for back-compat (test 2) ----------------------------------------

@Service()
class SharedCounter {
  count = 0;
  inc(): void {
    this.count += 1;
  }
}

@Controller('/shared')
class SharedCounterController {
  constructor(@inject(SharedCounter) private readonly counter: SharedCounter) {}

  @Get('/value')
  value() {
    return { count: this.counter.count };
  }

  @Post('/inc')
  bump() {
    this.counter.inc();
    return { count: this.counter.count };
  }
}

// --- Fixtures for isolate sub-cases (test 3) ----------------------------------

@Service()
class NeedsStringToken {
  constructor(@inject('CONFIG_TOKEN') readonly config: { name: string }) {}
}

@Controller('/token')
class TokenController {
  constructor(@inject(NeedsStringToken) private readonly svc: NeedsStringToken) {}

  @Get()
  get() {
    return { name: this.svc.config.name };
  }
}

@Service()
class WithOptionalDep {
  constructor(@Optional() @inject('MAYBE_MISSING') readonly maybe?: unknown) {}
}

@Controller('/optional')
class OptionalController {
  constructor(@inject(WithOptionalDep) private readonly svc: WithOptionalDep) {}

  @Get()
  get() {
    return {};
  }
}

@Service({ scope: 'transient' })
class Ephemeral {
  readonly id = Symbol('ephemeral');
}

@Controller('/ephemeral')
class EphemeralController {
  constructor(@inject(Ephemeral) private readonly e: Ephemeral) {}

  @Get()
  get() {
    return {};
  }
}

describe('per-app DI isolation (isolate option)', () => {
  beforeEach(() => {
    // @Service registers singletons on the global container at import time; reset
    // instances between tests so shared-singleton fixtures don't leak state across
    // `it` blocks (registrations are preserved, only cached instances are cleared).
    globalContainer.clearInstances();
  });

  describe('isolate: true — multi-app isolation', () => {
    it('gives each app its own service instance (mutating one does not affect the other)', async () => {
      const app1 = new Application({ router: new Router() });
      const app2 = new Application({ router: new Router() });

      await registerControllers(app1, {
        controllers: [IsolatedCounterController],
        isolate: true,
      });
      await registerControllers(app2, {
        controllers: [IsolatedCounterController],
        isolate: true,
      });

      // Mutate app1's counter via its route handler.
      await hit(app1.router!, 'POST', '/counter/inc');

      // app1 observes the mutation; app2 must be untouched (separate instance).
      expect(await hit(app1.router!, 'GET', '/counter/value')).toEqual({ count: 1 });
      expect(await hit(app2.router!, 'GET', '/counter/value')).toEqual({ count: 0 });
    });
  });

  describe('isolate: false (default) — back-compat sharing', () => {
    it('two apps share the same service singleton', async () => {
      const app1 = new Application({ router: new Router() });
      const app2 = new Application({ router: new Router() });

      // No isolate flag → both fall back to the global container → shared singleton.
      await registerControllers(app1, { controllers: [SharedCounterController] });
      await registerControllers(app2, { controllers: [SharedCounterController] });

      await hit(app1.router!, 'POST', '/shared/inc');

      // Shared instance: app2 sees app1's mutation.
      expect(await hit(app2.router!, 'GET', '/shared/value')).toEqual({ count: 1 });
    });
  });

  describe('isolate: true — dependency-graph edge cases', () => {
    it('resolves a string @inject token pre-registered on the provided container', async () => {
      const c: Container = createContainer();
      c.register('CONFIG_TOKEN', { useValue: { name: 'isolated' } });
      const app = new Application({ router: new Router(), container: c });

      await registerControllers(app, {
        controllers: [TokenController],
        container: c,
        isolate: true,
      });

      // NeedsStringToken was auto-registered by the graph walk; the string token
      // it needs was registered by the caller beforehand → resolves cleanly.
      expect(c.isRegistered(NeedsStringToken)).toBe(true);
      const resolved = c.resolve(NeedsStringToken);
      expect(resolved.config).toEqual({ name: 'isolated' });
    });

    it('injects undefined for an unresolved @Optional() dependency', async () => {
      const c: Container = createContainer();
      const app = new Application({ router: new Router(), container: c });

      await registerControllers(app, {
        controllers: [OptionalController],
        container: c,
        isolate: true,
      });

      const resolved = c.resolve(WithOptionalDep);
      expect(resolved.maybe).toBeUndefined();
    });

    it('gives fresh instances for a transient @Service', async () => {
      const c: Container = createContainer();
      const app = new Application({ router: new Router(), container: c });

      await registerControllers(app, {
        controllers: [EphemeralController],
        container: c,
        isolate: true,
      });

      expect(c.isRegistered(Ephemeral)).toBe(true);
      expect(c.resolve(Ephemeral)).not.toBe(c.resolve(Ephemeral));
    });
  });
});
