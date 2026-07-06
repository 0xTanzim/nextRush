/**
 * @nextrush/controllers - Route metadata mapping (M8)
 *
 * Decorator docs (@Controller tags, @Get/@Post description/deprecated) must flow
 * into the router's RouteDefinition so class-based routes are documented by
 * @nextrush/openapi, exactly like functional routes using endpoint().
 */

import { Controller, Get, getControllerDefinition, Post } from '@nextrush/decorators';
import { createContainer, type ContainerInterface } from '@nextrush/di';
import { createRouter } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRoutes } from '../builder.js';
import { registerController } from '../plugin.js';

describe('controller route metadata → RouteDefinition', () => {
  let container: ContainerInterface;

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

  it('registers metadata onto the router so getRoutes() exposes it', () => {
    @Controller({ path: '/posts', tags: ['posts'] })
    class PostController {
      @Get('/:id', { description: 'Get a post' })
      findOne() {
        return {};
      }
    }

    container.register(PostController, { useClass: PostController });

    const router = createRouter();
    registerController(router, PostController, container);

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
});
