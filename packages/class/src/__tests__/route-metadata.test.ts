/**
 * @nextrush/controllers - Route metadata mapping (M8)
 *
 * Decorator docs (@Controller tags, @Get/@Post description/deprecated) must flow
 * into the router's RouteDefinition so class-based routes are documented by
 * @nextrush/openapi, exactly like functional routes using endpoint().
 */

import { Application } from '@nextrush/core';
import { All, Controller, Get, getControllerDefinition, Post } from '../index.js';
import { createContainer, type Container } from '@nextrush/di';
import { createRouter } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRoutes } from '../registrar/builder.js';
import { registerControllers } from '../registrar/registrar.js';

describe('controller route metadata → RouteDefinition', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('buildRoutes carries decorator description/deprecated + controller tags', () => {
    @Controller({ path: '/users', tags: ['users'] })
    class UserController {
      @Get('/:id', { description: 'Get a user by id' })
      findOne() {
        return {};
      }

      @Post('/', { deprecated: true })
      create() {
        return {};
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const findOne = routes.find((r) => r.methodName === 'findOne')!;
    const create = routes.find((r) => r.methodName === 'create')!;

    expect(findOne.metadata).toMatchObject({ description: 'Get a user by id', tags: ['users'] });
    expect(create.metadata).toMatchObject({ deprecated: true, tags: ['users'] });
  });

  it('registers metadata onto the router so getRoutes() exposes it', async () => {
    @Controller({ path: '/posts', tags: ['posts'] })
    class PostController {
      @Get('/:id', { description: 'Get a post' })
      findOne() {
        return {};
      }
    }

    container.register(PostController, { useClass: PostController });

    const router = createRouter();
    const app = new Application({ router, container });
    await registerControllers(app, { controllers: [PostController], container });

    const def = router.getRoutes().find((r) => r.path === '/posts/:id');
    expect(def).toBeDefined();
    expect(def!.metadata).toMatchObject({ description: 'Get a post', tags: ['posts'] });
  });

  it('omits metadata when the route has no decorator docs', () => {
    @Controller('/health')
    class HealthController {
      @Get()
      check() {
        return { ok: true };
      }
    }

    container.register(HealthController, { useClass: HealthController });
    const definition = getControllerDefinition(HealthController)!;
    const routes = buildRoutes(definition, container, '', []);

    expect(routes[0].metadata).toBeUndefined();
  });

  it('registers @All() as a single any-method route on the real router, end to end (T016)', async () => {
    // Exercises the full chain the unit-level tests above don't reach:
    // @All() decorator -> buildRoutes -> bootstrap's routerStage ->
    // Router.all(). Confirms routerStage's generic
    // `router[route.method.toLowerCase()]` dispatch correctly resolves the
    // 'ALL' decorator sentinel to Router.all() (not a per-method call), and
    // that the resulting getRoutes() row is the single isAnyMethod entry.
    @Controller('/proxy')
    class ProxyController {
      @All('/forward')
      handle() {
        return { ok: true };
      }
    }

    container.register(ProxyController, { useClass: ProxyController });

    const router = createRouter();
    const app = new Application({ router, container });
    await registerControllers(app, { controllers: [ProxyController], container });

    const anyRoutes = router.getRoutes().filter((r) => r.path === '/proxy/forward');
    expect(anyRoutes).toHaveLength(1);
    expect(anyRoutes[0]?.isAnyMethod).toBe(true);

    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const) {
      expect(router.match(method, '/proxy/forward')).not.toBeNull();
    }
  });
});
