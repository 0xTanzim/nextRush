/**
 * @nextrush/decorators - Route Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import { getRedirectMetadata, getResponseHeaders, getRouteMetadata } from '../metadata.js';
import {
  All,
  Delete,
  Get,
  Head,
  Options,
  Patch,
  Post,
  Put,
  Redirect,
  SetHeader,
} from '../routes.js';

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

  describe('Path in options object', () => {
    it('should accept path inside options object', () => {
      @Controller('/users')
      class UserController {
        @Get({ path: '/:id', statusCode: 200 })
        findOne() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/:id');
      expect(routes[0].statusCode).toBe(200);
    });

    it('should normalize path inside options object', () => {
      @Controller('/users')
      class UserController {
        @Post({ path: 'bulk', statusCode: 201 })
        createMany() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/bulk');
      expect(routes[0].statusCode).toBe(201);
    });

    it('should default to / when options object has no path', () => {
      @Controller('/users')
      class UserController {
        @Get({ description: 'List users' })
        findAll() {}
      }

      const routes = getRouteMetadata(UserController);
      expect(routes[0].path).toBe('/');
      expect(routes[0].description).toBe('List users');
    });
  });

  describe('@SetHeader', () => {
    it('should store response header metadata on a method', () => {
      @Controller('/test')
      class TestController {
        @SetHeader('X-Custom', 'value')
        @Get()
        handler() {}
      }

      const headers = getResponseHeaders(TestController, 'handler');
      expect(headers).toHaveLength(1);
      expect(headers[0]).toEqual({ name: 'X-Custom', value: 'value' });
    });

    it('should accumulate multiple headers', () => {
      @Controller('/test')
      class TestController {
        @SetHeader('X-A', 'a')
        @SetHeader('X-B', 'b')
        @Get()
        handler() {}
      }

      const headers = getResponseHeaders(TestController, 'handler');
      expect(headers).toHaveLength(2);
      expect(headers).toContainEqual({ name: 'X-A', value: 'a' });
      expect(headers).toContainEqual({ name: 'X-B', value: 'b' });
    });

    it('should return empty array when no headers set', () => {
      @Controller('/test')
      class TestController {
        @Get()
        handler() {}
      }

      const headers = getResponseHeaders(TestController, 'handler');
      expect(headers).toEqual([]);
    });
  });

  describe('@Redirect', () => {
    it('should store redirect metadata with default 302', () => {
      @Controller('/test')
      class TestController {
        @Redirect('/target')
        @Get()
        handler() {}
      }

      const meta = getRedirectMetadata(TestController, 'handler');
      expect(meta).toBeDefined();
      expect(meta!.url).toBe('/target');
      expect(meta!.statusCode).toBe(302);
    });

    it('should accept custom status code', () => {
      @Controller('/test')
      class TestController {
        @Redirect('/moved', 301)
        @Get()
        handler() {}
      }

      const meta = getRedirectMetadata(TestController, 'handler');
      expect(meta!.statusCode).toBe(301);
    });

    it('should return undefined when no redirect set', () => {
      @Controller('/test')
      class TestController {
        @Get()
        handler() {}
      }

      const meta = getRedirectMetadata(TestController, 'handler');
      expect(meta).toBeUndefined();
    });
  });
});
