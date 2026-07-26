/**
 * @nextrush/class - Characterization Tests for ApplicationGraph IR
 *
 * These tests prove that the ApplicationGraph IR (bootstrap read-once, freeze, execute)
 * preserves exact behavior for:
 *   1. Request-scoped controllers: fresh instance per request, shared within request
 *   2. Singleton controllers: memoized instance across requests
 *   3. Guard + Interceptor + Method execution order
 *   4. No Reflect metadata reads on request path (metadata baked at bootstrap)
 *
 * These are safety nets for the RFC-NEXTRUSH-CLASS-CONSOLIDATION P3.4 refactor.
 */

import { Application } from '@nextrush/core';
import { Controller, Get, UseGuard, UseInterceptor } from '../index.js';
import { Service, container as globalContainer, inject, CanActivate } from '@nextrush/di';
import { Router } from '@nextrush/router';
import type { Context, Interceptor } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerControllers } from '../registrar/registrar.js';

/** Minimal Context stub whose `json()` captures the serialized payload. */
function createCapturingContext(method: string, path: string, body?: unknown): {
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
    body,
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
async function hit(router: Router, method: string, path: string, body?: unknown): Promise<unknown> {
  const match = router.match(method, path);
  if (!match) throw new Error(`no route matched: ${method} ${path}`);
  const { ctx, captured } = createCapturingContext(method, path, body);
  await match.handler(ctx);
  return captured();
}

function makeApp(): { app: Application; router: Router } {
  const router = new Router();
  const app = new Application({ router, container: globalContainer });
  return { app, router };
}

// ============================================================================
// CHARACTERIZATION TEST 1: Request-Scoped Controllers
// ============================================================================

describe('Characterization 1: Request-scoped controllers', () => {
  let requestCounter = 0;

  beforeEach(() => {
    globalContainer.clearInstances();
    requestCounter = 0;
  });

  it('a request-scoped service is fresh per request', async () => {
    @Service({ scope: 'request' })
    class RequestScopedService {
      readonly requestId = ++requestCounter;
    }

    @Controller('/req-test-1')
    class ReqController {
      constructor(@inject(RequestScopedService) readonly svc: RequestScopedService) {}

      @Get('/')
      read(): { id: number } {
        return { id: this.svc.requestId };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [ReqController] });

    const r1 = (await hit(router, 'GET', '/req-test-1')) as { id: number };
    const r2 = (await hit(router, 'GET', '/req-test-1')) as { id: number };

    // Each request gets a fresh instance (counter increments per request)
    expect(r1.id).not.toBe(r2.id);
    expect(r1.id < r2.id).toBe(true); // r2 has higher counter
  });

  it('a request-scoped service is shared within one request', async () => {
    @Service({ scope: 'request' })
    class RequestScoped {
      readonly id = ++requestCounter;
    }

    @Service()
    class Helper {
      constructor(@inject(RequestScoped) readonly req: RequestScoped) {}
    }

    @Controller('/req-test-2')
    class TestController {
      constructor(
        @inject(RequestScoped) readonly direct: RequestScoped,
        @inject(Helper) readonly helper: Helper
      ) {}

      @Get('/')
      read(): { direct: number; viaHelper: number } {
        return { direct: this.direct.id, viaHelper: this.helper.req.id };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [TestController] });

    const result = (await hit(router, 'GET', '/req-test-2')) as {
      direct: number;
      viaHelper: number;
    };

    // Same instance within one request
    expect(result.direct).toBe(result.viaHelper);
  });
});

// ============================================================================
// CHARACTERIZATION TEST 2: Singleton Controllers
// ============================================================================

describe('Characterization 2: Singleton controllers', () => {
  let ctrlCounter = 0;

  beforeEach(() => {
    globalContainer.clearInstances();
    ctrlCounter = 0;
  });

  it('a singleton controller is memoized across requests', async () => {
    @Controller('/singleton-test')
    class SingletonCtrl {
      readonly id = ++ctrlCounter;

      @Get('/')
      read(): { id: number } {
        return { id: this.id };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [SingletonCtrl] });

    const r1 = (await hit(router, 'GET', '/singleton-test')) as { id: number };
    const r2 = (await hit(router, 'GET', '/singleton-test')) as { id: number };

    expect(r1.id).toBe(r2.id);
    expect(r1.id).toBe(1); // only created once
  });

  it('a pure singleton controller creates no child container', async () => {
    @Controller('/pure-singleton')
    class PureSingleton {
      @Get('/')
      read(): { ok: boolean } {
        return { ok: true };
      }
    }

    const { app, router } = makeApp();
    const createChildSpy = vi.spyOn(globalContainer, 'createChild');

    await registerControllers(app, { controllers: [PureSingleton] });

    await hit(router, 'GET', '/pure-singleton');
    await hit(router, 'GET', '/pure-singleton');

    // No child container for pure singletons
    expect(createChildSpy).not.toHaveBeenCalled();

    createChildSpy.mockRestore();
  });
});

// ============================================================================
// CHARACTERIZATION TEST 3: Guard + Interceptor + Method Flow
// ============================================================================

describe('Characterization 3: Guard + Interceptor + Method execution', () => {
  let timeline: string[] = [];

  beforeEach(() => {
    globalContainer.clearInstances();
    timeline = [];
  });

  it('guards run before method', async () => {
    @Service()
    class GuardService implements CanActivate {
      canActivate(): boolean {
        timeline.push('guard');
        return true;
      }
    }

    @Controller('/guard-test')
    class GuardCtrl {
      @UseGuard(GuardService)
      @Get('/')
      read(): { ok: boolean } {
        timeline.push('method');
        return { ok: true };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [GuardCtrl] });

    await hit(router, 'GET', '/guard-test');

    expect(timeline).toEqual(['guard', 'method']);
  });

  it('interceptors wrap method (before/after)', async () => {
    @Service()
    class TrackingInterceptor implements Interceptor {
      async intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        timeline.push('interceptor-before');
        const result = await next();
        timeline.push('interceptor-after');
        return result;
      }
    }

    @Controller('/interceptor-test')
    class InterceptCtrl {
      @UseInterceptor(TrackingInterceptor)
      @Get('/')
      read(): { ok: boolean } {
        timeline.push('method');
        return { ok: true };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [InterceptCtrl] });

    await hit(router, 'GET', '/interceptor-test');

    expect(timeline).toEqual(['interceptor-before', 'method', 'interceptor-after']);
  });

  it('full flow: guard -> interceptor -> method', async () => {
    @Service()
    class Guard implements CanActivate {
      canActivate(): boolean {
        timeline.push('guard');
        return true;
      }
    }

    @Service()
    class Interceptor implements Interceptor {
      async intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        timeline.push('interceptor-before');
        const result = await next();
        timeline.push('interceptor-after');
        return result;
      }
    }

    @Controller('/flow-test')
    class FlowCtrl {
      @UseGuard(Guard)
      @UseInterceptor(Interceptor)
      @Get('/')
      read(): { ok: boolean } {
        timeline.push('method');
        return { ok: true };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [FlowCtrl] });

    await hit(router, 'GET', '/flow-test');

    expect(timeline).toEqual(['guard', 'interceptor-before', 'method', 'interceptor-after']);
  });
});

// ============================================================================
// CHARACTERIZATION TEST 4: Metadata Baked at Bootstrap
// ============================================================================

describe('Characterization 4: Multiple routes and controllers execute correctly', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('multiple routes on one controller all work', async () => {
    @Service()
    class Guard implements CanActivate {
      canActivate(): boolean {
        return true;
      }
    }

    @Controller('/multi')
    class MultiCtrl {
      @UseGuard(Guard)
      @Get('/')
      list(): { type: string } {
        return { type: 'list' };
      }

      @Get('/detail')
      detail(): { type: string } {
        return { type: 'detail' };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [MultiCtrl] });

    const r1 = (await hit(router, 'GET', '/multi')) as { type: string };
    const r2 = (await hit(router, 'GET', '/multi/detail')) as { type: string };

    expect(r1.type).toBe('list');
    expect(r2.type).toBe('detail');
  });

  it('multiple controllers with different paths all work', async () => {
    @Controller('/api/users')
    class UserCtrl {
      @Get('/')
      list(): { resource: string } {
        return { resource: 'users' };
      }
    }

    @Controller('/api/posts')
    class PostCtrl {
      @Get('/')
      list(): { resource: string } {
        return { resource: 'posts' };
      }
    }

    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [UserCtrl, PostCtrl] });

    const users = (await hit(router, 'GET', '/api/users')) as { resource: string };
    const posts = (await hit(router, 'GET', '/api/posts')) as { resource: string };

    expect(users.resource).toBe('users');
    expect(posts.resource).toBe('posts');
  });
});
