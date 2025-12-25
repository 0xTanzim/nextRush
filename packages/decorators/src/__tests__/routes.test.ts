/**
 * @nextrush/decorators - Route Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import { getRouteMetadata } from '../metadata.js';
import { All, Delete, Get, Head, Options, Patch, Post, Put } from '../routes.js';

describe('Route Decorators', () => {
  describe('@Get', () => {
    it('should register GET route with default path', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('GET');
      expect(routes[0].path).toBe('/');
      expect(routes[0].methodName).toBe('findAll');
    });

    it('should register GET route with path', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/:id');
    });

    it('should normalize path without leading slash', () => {
      @Controller('/users')
      class UserController {
        @Get('active')
        findActive() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/active');
    });

    it('should accept options object', () => {
      @Controller('/users')
      class UserController {
        @Get({ description: 'List all users', deprecated: true })
        findAll() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/');
      expect(routes[0].description).toBe('List all users');
      expect(routes[0].deprecated).toBe(true);
    });

    it('should accept path and options', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id', { statusCode: 200 })
        findOne() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/:id');
      expect(routes[0].statusCode).toBe(200);
    });
  });

  describe('@Post', () => {
    it('should register POST route', () => {
      @Controller('/users')
      class UserController {
        @Post()
        create() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].method).toBe('POST');
    });

    it('should set custom status code', () => {
      @Controller('/users')
      class UserController {
        @Post({ statusCode: 201 })
        create() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].statusCode).toBe(201);
    });
  });

  describe('@Put', () => {
    it('should register PUT route', () => {
      @Controller('/users')
      class UserController {
        @Put('/:id')
        update() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].method).toBe('PUT');
      expect(routes[0].path).toBe('/:id');
    });
  });

  describe('@Delete', () => {
    it('should register DELETE route', () => {
      @Controller('/users')
      class UserController {
        @Delete('/:id')
        remove() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].method).toBe('DELETE');
    });
  });

  describe('@Patch', () => {
    it('should register PATCH route', () => {
      @Controller('/users')
      class UserController {
        @Patch('/:id')
        partialUpdate() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].method).toBe('PATCH');
    });
  });

  describe('@Head', () => {
    it('should register HEAD route', () => {
      @Controller('/files')
      class FileController {
        @Head('/:id')
        checkExists() {}
      }

      const routes = getRouteMetadata(FileController);
      expect(routes[0].method).toBe('HEAD');
    });
  });

  describe('@Options', () => {
    it('should register OPTIONS route', () => {
      @Controller('/api')
      class ApiController {
        @Options()
        cors() {}
      }

      const routes = getRouteMetadata(ApiController);
      expect(routes[0].method).toBe('OPTIONS');
    });
  });

  describe('@All', () => {
    it('should register routes for all methods', () => {
      @Controller('/proxy')
      class ProxyController {
        @All('/forward')
        handle() {}
      }

      const routes = getRouteMetadata(ProxyController);
      const methods = routes.map((r) => r.method);

      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('PATCH');
    });
  });

  describe('Multiple routes', () => {
    it('should collect multiple routes on same controller', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}

        @Get('/:id')
        findOne() {}

        @Post()
        create() {}

        @Delete('/:id')
        remove() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes).toHaveLength(4);
    });

    it('should preserve method names correctly', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}

        @Post()
        create() {}
      }

      const routes = getRouteMetadata(UserController);
      const methodNames = routes.map((r) => r.methodName);

      expect(methodNames).toContain('findAll');
      expect(methodNames).toContain('create');
    });
  });

  describe('Middleware on routes', () => {
    it('should attach middleware to route', () => {
      const authGuard = Symbol('auth');

      @Controller('/users')
      class UserController {
        @Get({ middleware: [authGuard] })
        findAll() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].middleware).toEqual([authGuard]);
    });
  });
});
