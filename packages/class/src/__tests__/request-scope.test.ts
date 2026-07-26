/**
 * @nextrush/class - Request scope (RFC-NEXTRUSH-REQUEST-SCOPE)
 *
 * Proves the request lifecycle end-to-end through real controllers + route
 * handlers:
 *   1. A `@Service({ scope: 'request' })` is fresh per request, shared within one.
 *   2. A singleton service stays shared across requests.
 *   3. Scope bubbling: a singleton-declared controller depending on a
 *      request-scoped service gets a fresh controller AND service per request.
 *   4. A purely-singleton controller creates NO per-request child (memoize path).
 *   5. A transient service is fresh on every resolve.
 *
 * Fixtures use explicit `@inject(Class)` on constructors: vitest transforms with
 * esbuild, which emits no `design:paramtypes`, so the graph walk relies on
 * tsyringe's `@inject` descriptors (same as isolation.test.ts).
 */

import { Application } from '@nextrush/core';
import { Controller, Get } from '../index.js';
import { Service, container as globalContainer, inject } from '@nextrush/di';
import { Router } from '@nextrush/router';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerControllers } from '../registrar/registrar.js';

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

function makeApp(): { app: Application; router: Router } {
  const router = new Router();
  const app = new Application({ router, container: globalContainer });
  return { app, router };
}

// --- Test 1 + shared-within-request fixtures ---------------------------------

let reqCounter = 0;
@Service({ scope: 'request' })
class ReqCounter {
  readonly id = ++reqCounter;
}

@Service() // singleton, but bubbles to request via ReqCounter
class ReqHelper {
  constructor(@inject(ReqCounter) readonly req: ReqCounter) {}
}

@Controller('/req')
class ReqController {
  constructor(
    @inject(ReqCounter) readonly direct: ReqCounter,
    @inject(ReqHelper) readonly helper: ReqHelper
  ) {}

  @Get('/')
  read(): { direct: number; viaHelper: number } {
    return { direct: this.direct.id, viaHelper: this.helper.req.id };
  }
}

// --- Test 2: singleton shared across requests --------------------------------

let singletonCounter = 0;
@Service()
class SharedSingleton {
  readonly id = ++singletonCounter;
}

@Controller('/singleton')
class SingletonController {
  constructor(@inject(SharedSingleton) readonly shared: SharedSingleton) {}

  @Get('/')
  read(): { id: number } {
    return { id: this.shared.id };
  }
}

// --- Test 3: bubbling — fresh controller + service per request ---------------

let ctrlInstanceCounter = 0;
let svcInstanceCounter = 0;
@Service({ scope: 'request' })
class BubblingService {
  readonly id = ++svcInstanceCounter;
}

@Controller('/bubble')
class BubblingController {
  readonly ctrlId = ++ctrlInstanceCounter;
  constructor(@inject(BubblingService) readonly svc: BubblingService) {}

  @Get('/')
  read(): { ctrlId: number; svcId: number } {
    return { ctrlId: this.ctrlId, svcId: this.svc.id };
  }
}

// --- Test 4: purely-singleton controller, no child, memoize path -------------

let pureCtrlCounter = 0;
@Service()
class PureSingletonService {
  readonly id = 1;
}

@Controller('/pure')
class PureSingletonController {
  readonly ctrlId = ++pureCtrlCounter;
  constructor(@inject(PureSingletonService) readonly svc: PureSingletonService) {}

  @Get('/')
  read(): { ctrlId: number } {
    return { ctrlId: this.ctrlId };
  }
}

describe('@nextrush/class - request scope', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('test 1: a request-scoped service is fresh per request, shared within one request', async () => {
    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [ReqController] });

    const r1 = (await hit(router, 'GET', '/req')) as { direct: number; viaHelper: number };
    const r2 = (await hit(router, 'GET', '/req')) as { direct: number; viaHelper: number };

    // Shared within one request: the controller's direct ReqCounter and the one
    // reached through ReqHelper are the same instance.
    expect(r1.direct).toBe(r1.viaHelper);
    expect(r2.direct).toBe(r2.viaHelper);
    // Fresh across requests.
    expect(r1.direct).not.toBe(r2.direct);
  });

  it('test 2: a singleton service is shared across requests', async () => {
    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [SingletonController] });

    const r1 = (await hit(router, 'GET', '/singleton')) as { id: number };
    const r2 = (await hit(router, 'GET', '/singleton')) as { id: number };

    expect(r1.id).toBe(r2.id);
  });

  it('test 3: scope bubbling gives a fresh controller AND service per request', async () => {
    const { app, router } = makeApp();
    await registerControllers(app, { controllers: [BubblingController] });

    const r1 = (await hit(router, 'GET', '/bubble')) as { ctrlId: number; svcId: number };
    const r2 = (await hit(router, 'GET', '/bubble')) as { ctrlId: number; svcId: number };

    expect(r1.ctrlId).not.toBe(r2.ctrlId); // fresh controller
    expect(r1.svcId).not.toBe(r2.svcId); // fresh request-scoped service
  });

  it('test 4: a purely-singleton controller creates no per-request child (memoize path)', async () => {
    const { app, router } = makeApp();
    const childSpy = vi.spyOn(globalContainer, 'createChild');
    await registerControllers(app, { controllers: [PureSingletonController] });

    const r1 = (await hit(router, 'GET', '/pure')) as { ctrlId: number };
    const r2 = (await hit(router, 'GET', '/pure')) as { ctrlId: number };

    // No per-request child was created — zero new per-request overhead.
    expect(childSpy).not.toHaveBeenCalled();
    // Memoized singleton: same controller instance across requests.
    expect(r1.ctrlId).toBe(r2.ctrlId);
    childSpy.mockRestore();
  });

  it('test 5: a transient service is fresh on every resolve', () => {
    @Service({ scope: 'transient' })
    class TransientThing {}
    globalContainer.register(TransientThing, { useClass: TransientThing }, { scope: 'transient' });

    const a = globalContainer.resolve(TransientThing);
    const b = globalContainer.resolve(TransientThing);

    expect(a).not.toBe(b);
  });
});
