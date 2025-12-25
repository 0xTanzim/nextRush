/**
 * @nextrush/controllers - Registry Tests
 */

import { Controller, Delete, Get, Post } from '@nextrush/decorators';
import { Service, createContainer, type ContainerInterface } from '@nextrush/di';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { NoRoutesError, NotAControllerError } from '../errors.js';
import { ControllerRegistry } from '../registry.js';

describe('ControllerRegistry', () => {
  let container: ContainerInterface;
  let registry: ControllerRegistry;

  beforeEach(() => {
    container = createContainer();
    registry = new ControllerRegistry(container, '', [], false);
  });

  describe('register', () => {
    it('should register a valid controller', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      const registered = registry.register(UserController);

      expect(registered.target).toBe(UserController);
      expect(registered.definition.controller.path).toBe('/users');
      expect(registered.routes).toHaveLength(1);
      expect(registered.routes[0].method).toBe('GET');
      expect(registered.routes[0].path).toBe('/users');
    });

    it('should throw NotAControllerError for non-controller class', () => {
      class NotAController {}

      expect(() => registry.register(NotAController)).toThrow(NotAControllerError);
    });

    it('should throw NoRoutesError for controller without routes', () => {
      @Controller('/empty')
      class EmptyController {}

      expect(() => registry.register(EmptyController)).toThrow(NoRoutesError);
    });

    it('should return existing registration if already registered', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      const first = registry.register(UserController);
      const second = registry.register(UserController);

      expect(first).toBe(second);
    });

    it('should register controller in DI container', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      registry.register(UserController);

      expect(container.isRegistered(UserController)).toBe(true);
    });

    it('should not re-register if already in container', () => {
      @Controller('/users')
      @Service()
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(UserController, { useClass: UserController });
      registry.register(UserController);

      expect(container.isRegistered(UserController)).toBe(true);
    });
  });

  describe('registerAll', () => {
    it('should register multiple controllers', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      @Controller('/posts')
      class PostController {
        @Get()
        findAll() {
          return [];
        }
      }

      const registered = registry.registerAll([UserController, PostController]);

      expect(registered).toHaveLength(2);
      expect(registry.routeCount).toBe(2);
    });
  });

  describe('getAll', () => {
    it('should return all registered controllers', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      @Controller('/posts')
      class PostController {
        @Get()
        findAll() {
          return [];
        }
      }

      registry.registerAll([UserController, PostController]);
      const all = registry.getAll();

      expect(all).toHaveLength(2);
    });
  });

  describe('getAllRoutes', () => {
    it('should return all routes from all controllers', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }

        @Get('/:id')
        findOne() {
          return {};
        }
      }

      @Controller('/posts')
      class PostController {
        @Get()
        findAll() {
          return [];
        }
      }

      registry.registerAll([UserController, PostController]);
      const routes = registry.getAllRoutes();

      expect(routes).toHaveLength(3);
    });
  });

  describe('routeCount', () => {
    it('should return total route count', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }

        @Post()
        create() {
          return {};
        }

        @Delete('/:id')
        remove() {
          return {};
        }
      }

      registry.register(UserController);

      expect(registry.routeCount).toBe(3);
    });
  });

  describe('has', () => {
    it('should return true for registered controller', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      registry.register(UserController);

      expect(registry.has(UserController)).toBe(true);
    });

    it('should return false for unregistered controller', () => {
      class SomeClass {}

      expect(registry.has(SomeClass)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all registrations', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      registry.register(UserController);
      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
      expect(registry.routeCount).toBe(0);
    });
  });

  describe('with prefix', () => {
    it('should prepend global prefix to routes', () => {
      const prefixedRegistry = new ControllerRegistry(container, '/api/v1', [], false);

      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }

        @Get('/:id')
        findOne() {
          return {};
        }
      }

      const registered = prefixedRegistry.register(UserController);

      expect(registered.routes[0].path).toBe('/api/v1/users');
      expect(registered.routes[1].path).toBe('/api/v1/users/:id');
    });
  });

  describe('with middleware', () => {
    it('should include global middleware in routes', () => {
      const middleware1 = async () => {};
      const middleware2 = async () => {};

      const middlewareRegistry = new ControllerRegistry(container, '', [middleware1, middleware2], false);

      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      const registered = middlewareRegistry.register(UserController);

      expect(registered.routes[0].middleware).toContain(middleware1);
      expect(registered.routes[0].middleware).toContain(middleware2);
    });
  });
});
