/**
 * NextRush v3 benchmark server — class/DI path.
 *
 * Mirrors nextrush-v3.js (the functional path) scenario-for-scenario, through
 * this path's own idiomatic mechanism, per design.md D1 — a `@Controller` +
 * route-decorator pair per functional route, registered via
 * `registerControllers()`, not a hand-rolled DI setup that wouldn't reflect
 * real class-path usage.
 *
 * WHY PLAIN FUNCTION CALLS INSTEAD OF `@Decorator` SYNTAX
 * ---------------------------------------------------------
 * Every other file in this directory is a zero-build-step `.js` file the
 * harness (`scripts/lib/server.js`, `validate-parity.js`, `smoke-test.js`)
 * spawns directly via `node <file>` — no compile step. `nextrush/class`'s
 * decorators require TS's *legacy* decorator transform (`experimentalDecorators`
 * + `emitDecoratorMetadata`), which plain Node cannot parse (`@Foo` on a class
 * member is a SyntaxError outside a TS/Babel pipeline). Introducing a build
 * step here would be a harness-wide convention change well beyond this
 * change's declared scope (a single new server file).
 *
 * The fix is not a workaround: TS's legacy decorator transform desugars
 * `@Controller('/') class Foo {}` into `Foo = Controller('/')(Foo)`, and a
 * `@Param('id') id` parameter into a call `paramDecorator(target, key, index)`
 * run immediately after the class body evaluates. Every decorator this file
 * uses (`Controller`, `Get`, `Post`, `Query`, `Param`, `Body`, `HttpCode`,
 * `UseInterceptor`, `Service`) is an exported *plain function* that returns
 * another plain function — calling them directly, in the same order and at
 * the same point TS's own transform would, produces byte-identical metadata
 * to the decorator-syntax form used in `apps/playground` (which IS compiled).
 * This file is applying that same transform by hand, not inventing new API.
 *
 * Fairness notes (must match nextrush-v3.js exactly):
 * - Response bodies come from the same shared payload module.
 * - Error handling uses `app.setErrorHandler` — identical to the functional
 *   server. The `/error` route has no filter, so the thrown error propagates
 *   past the (empty) interceptor/filter chain straight to the app-level
 *   handler, exactly like the functional server's uncaught throw.
 * - The body parser is attached only to the POST route via the route's own
 *   `middleware` option — scoped exactly like the functional server's
 *   `router.post('/users', json(), handler)`.
 * - `/empty` uses `HttpCode(204)` + a `void` return: `createRouteHandler`
 *   skips response serialization when the result is `undefined`, so no body
 *   is sent — byte-identical to the functional server's `ctx.status = 204;
 *   ctx.send()`.
 * - `/middleware` uses 5 stacked `UseInterceptor` classes, one per header —
 *   this scenario is `identicalWork: false` (per config/scenarios.js): each
 *   framework's own idiomatic per-layer dispatch mechanism is measured, not a
 *   shared mechanism. Interceptors are this path's "around advice" primitive,
 *   the direct counterpart to the functional server's middleware array.
 */

import { listen } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  registerControllers,
  Service,
  UseInterceptor,
} from '@nextrush/class';

import {
  ERROR_BODY,
  ERROR_MESSAGE,
  HELLO_WORLD,
  JSON_USER,
  LARGE_JSON,
  MIDDLEWARE_BODY,
  MIDDLEWARE_HEADERS,
  deepRoute,
  mwHeaderValue,
  postUserResponse,
  searchResponse,
  userById,
} from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

/** Apply a method decorator using the method's real PropertyDescriptor —
 * required because these decorators branch on `descriptor !== undefined` to
 * tell a method application from a class application (TS's transform always
 * supplies the real descriptor for a method decorator). */
function applyMethod(decoratorFactory, target, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
  decoratorFactory(target.prototype, methodName, descriptor);
}

/** Apply a parameter decorator to `methodName`'s parameter at `index`. */
function applyParam(decoratorFactory, target, methodName, index) {
  decoratorFactory(target.prototype, methodName, index);
}

// One interceptor class per middleware layer — mirrors the functional
// server's `MIDDLEWARE_HEADERS.map(...)` array, one function per header.
// `Service()` makes each resolvable by the DI container the interceptor
// runner calls `container.resolve(interceptorClass)` against.
function makeHeaderInterceptor(header) {
  class HeaderInterceptor {
    async intercept(ctx, next) {
      ctx.set(header.name, mwHeaderValue(header));
      return next();
    }
  }
  Service()(HeaderInterceptor);
  return HeaderInterceptor;
}

const headerInterceptors = MIDDLEWARE_HEADERS.map(makeHeaderInterceptor);

class BenchController {
  helloWorld() {
    return HELLO_WORLD;
  }

  jsonResponse() {
    return JSON_USER;
  }

  largeJson() {
    return LARGE_JSON;
  }

  getUserById(id) {
    return userById(id);
  }

  search(q, limit) {
    return searchResponse(q, limit);
  }

  getDeepRoute(orgId, teamId, memberId) {
    return deepRoute(orgId, teamId, memberId);
  }

  createUser(data) {
    return postUserResponse(data);
  }

  middlewareStack() {
    return MIDDLEWARE_BODY;
  }

  errorRoute() {
    throw new Error(ERROR_MESSAGE);
  }

  empty() {
    // No return value — createRouteHandler skips serialization when the
    // result is `undefined`, sending zero bytes (matches ctx.send()).
  }
}

// ── Route decorators (method-level) — applied in declaration order, exactly
// as TS's transform would apply them bottom-up per method. ──
applyMethod(Get('/'), BenchController, 'helloWorld');
applyMethod(Get('/json'), BenchController, 'jsonResponse');
applyMethod(Get('/large-json'), BenchController, 'largeJson');
applyMethod(Get('/users/:id'), BenchController, 'getUserById');
applyMethod(Get('/search'), BenchController, 'search');
applyMethod(
  Get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId'),
  BenchController,
  'getDeepRoute'
);
applyMethod(Post('/users', { middleware: [json()] }), BenchController, 'createUser');
applyMethod(Get('/middleware'), BenchController, 'middlewareStack');
applyMethod(Get('/error'), BenchController, 'errorRoute');
applyMethod(Get('/empty'), BenchController, 'empty');
applyMethod(HttpCode(204), BenchController, 'empty');

// ── Parameter decorators — applied per-parameter, matching TS's own
// per-parameter invocation of the decorator function. ──
applyParam(Param('id'), BenchController, 'getUserById', 0);
applyParam(Query('q'), BenchController, 'search', 0);
applyParam(Query('limit'), BenchController, 'search', 1);
applyParam(Param('orgId'), BenchController, 'getDeepRoute', 0);
applyParam(Param('teamId'), BenchController, 'getDeepRoute', 1);
applyParam(Param('memberId'), BenchController, 'getDeepRoute', 2);
applyParam(Body(), BenchController, 'createUser', 0);

// ── Class-level decorators, applied last (outermost), exactly as TS applies
// class decorators after every member decorator has run. ──
for (const interceptor of headerInterceptors) {
  applyMethod(UseInterceptor(interceptor), BenchController, 'middlewareStack');
}
Controller('/')(BenchController);

const app = createApp({ router: createRouter() });

await registerControllers(app, { controllers: [BenchController] });

// Idiomatic error handler — invoked only when a route throws (no per-request
// cost), identical mechanism to the functional server.
app.setErrorHandler((_err, ctx) => {
  ctx.status = 500;
  ctx.json(ERROR_BODY);
});

const serverInstance = await listen(app, PORT);
console.log(`NextRush v3 (class) listening on http://localhost:${PORT}`);

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
