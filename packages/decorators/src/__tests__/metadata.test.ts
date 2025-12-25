/**
 * @nextrush/decorators - Metadata Reader Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import {
    buildFullPath,
    getAllParamMetadata,
    getControllerDefinition,
    getControllerMetadata,
    getParamMetadata,
    getRouteMetadata,
    isController,
} from '../metadata.js';
import { Body, Param } from '../params.js';
import { Delete, Get, Post } from '../routes.js';

describe('Metadata Readers', () => {
  describe('isController', () => {
    it('should return true for controller class', () => {
      @Controller('/users')
      class UserController {}

      expect(isController(UserController)).toBe(true);
    });

    it('should return false for regular class', () => {
      class UserService {}

      expect(isController(UserService)).toBe(false);
    });
  });

  describe('getControllerMetadata', () => {
    it('should return metadata for controller', () => {
      @Controller({ path: '/users', version: 'v1', tags: ['users'] })
      class UserController {}

      const metadata = getControllerMetadata(UserController);

      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/users');
      expect(metadata?.version).toBe('v1');
      expect(metadata?.tags).toEqual(['users']);
    });

    it('should return undefined for non-controller', () => {
      class UserService {}

      expect(getControllerMetadata(UserService)).toBeUndefined();
    });
  });

  describe('getRouteMetadata', () => {
    it('should return all routes for controller', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}

        @Get('/:id')
        findOne() {}

        @Post()
        create() {}
      }

      const routes = getRouteMetadata(UserController);

      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.method)).toEqual(['GET', 'GET', 'POST']);
    });

    it('should return empty array for controller without routes', () => {
      @Controller('/users')
      class EmptyController {}

      expect(getRouteMetadata(EmptyController)).toEqual([]);
    });

    it('should return empty array for non-controller', () => {
      class UserService {}

      expect(getRouteMetadata(UserService)).toEqual([]);
    });
  });

  describe('getParamMetadata', () => {
    it('should return params for specific method', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id') id: string) {
          return id;
        }

        @Post()
        create(@Body() data: unknown) {
          return data;
        }
      }

      const findOneParams = getParamMetadata(UserController, 'findOne');
      const createParams = getParamMetadata(UserController, 'create');

      expect(findOneParams).toHaveLength(1);
      expect(findOneParams[0].source).toBe('param');

      expect(createParams).toHaveLength(1);
      expect(createParams[0].source).toBe('body');
    });

    it('should return empty array for method without params', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}
      }

      expect(getParamMetadata(UserController, 'findAll')).toEqual([]);
    });

    it('should return empty array for non-existent method', () => {
      @Controller('/users')
      class UserController {}

      expect(getParamMetadata(UserController, 'nonExistent')).toEqual([]);
    });
  });

  describe('getAllParamMetadata', () => {
    it('should return Map of all params keyed by method', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id') id: string) {
          return id;
        }

        @Post()
        create(@Body() data: unknown) {
          return data;
        }
      }

      const allParams = getAllParamMetadata(UserController);

      expect(allParams).toBeInstanceOf(Map);
      expect(allParams.has('findOne')).toBe(true);
      expect(allParams.has('create')).toBe(true);
    });

    it('should return empty Map for controller without param decorators', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {}
      }

      const allParams = getAllParamMetadata(UserController);

      expect(allParams).toBeInstanceOf(Map);
      expect(allParams.size).toBe(0);
    });
  });

  describe('getControllerDefinition', () => {
    it('should return full definition for controller', () => {
      @Controller({ path: '/users', version: 'v1' })
      class UserController {
        @Get()
        findAll() {}

        @Get('/:id')
        findOne(@Param('id') id: string) {
          return id;
        }

        @Post()
        create(@Body() data: unknown) {
          return data;
        }

        @Delete('/:id')
        remove(@Param('id') id: string) {
          return id;
        }
      }

      const definition = getControllerDefinition(UserController);

      expect(definition).toBeDefined();
      expect(definition?.target).toBe(UserController);
      expect(definition?.controller.path).toBe('/users');
      expect(definition?.controller.version).toBe('v1');
      expect(definition?.routes).toHaveLength(4);
      expect(definition?.params).toBeInstanceOf(Map);
    });

    it('should return undefined for non-controller', () => {
      class UserService {}

      expect(getControllerDefinition(UserService)).toBeUndefined();
    });
  });

  describe('buildFullPath', () => {
    it('should combine controller and route paths', () => {
      const controller = { path: '/users' };
      const route = { path: '/:id', method: 'GET' as const, methodName: 'findOne', propertyKey: 'findOne' };

      expect(buildFullPath(controller, route)).toBe('/users/:id');
    });

    it('should handle root paths', () => {
      const controller = { path: '/' };
      const route = { path: '/users', method: 'GET' as const, methodName: 'findAll', propertyKey: 'findAll' };

      expect(buildFullPath(controller, route)).toBe('/users');
    });

    it('should handle root route path', () => {
      const controller = { path: '/users' };
      const route = { path: '/', method: 'GET' as const, methodName: 'findAll', propertyKey: 'findAll' };

      expect(buildFullPath(controller, route)).toBe('/users');
    });

    it('should include version prefix', () => {
      const controller = { path: '/users', version: 'v1' };
      const route = { path: '/:id', method: 'GET' as const, methodName: 'findOne', propertyKey: 'findOne' };

      expect(buildFullPath(controller, route)).toBe('/v1/users/:id');
    });

    it('should handle double slashes', () => {
      const controller = { path: '/api/' };
      const route = { path: '/users', method: 'GET' as const, methodName: 'findAll', propertyKey: 'findAll' };

      expect(buildFullPath(controller, route)).toBe('/api/users');
    });

    it('should return root for empty paths', () => {
      const controller = { path: '/' };
      const route = { path: '/', method: 'GET' as const, methodName: 'index', propertyKey: 'index' };

      expect(buildFullPath(controller, route)).toBe('/');
    });
  });
});
