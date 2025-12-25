/**
 * @nextrush/controllers - Error Tests
 */

import { describe, expect, it } from 'vitest';
import {
    ControllerError,
    ControllerResolutionError,
    DiscoveryError,
    MissingParameterError,
    NoRoutesError,
    NotAControllerError,
    ParameterInjectionError,
    RouteRegistrationError,
} from '../errors.js';

describe('Controller Errors', () => {
  describe('ControllerError', () => {
    it('should create base error with code', () => {
      const error = new ControllerError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ControllerError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });
  });

  describe('NotAControllerError', () => {
    it('should provide helpful message with decorator example', () => {
      const error = new NotAControllerError('UserService');

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('NotAControllerError');
      expect(error.code).toBe('NOT_A_CONTROLLER');
      expect(error.message).toContain('UserService');
      expect(error.message).toContain('@Controller');
      expect(error.message).toContain("import { Controller } from '@nextrush/decorators'");
    });
  });

  describe('NoRoutesError', () => {
    it('should provide helpful message with route decorator examples', () => {
      const error = new NoRoutesError('UserController');

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('NoRoutesError');
      expect(error.code).toBe('NO_ROUTES');
      expect(error.message).toContain('UserController');
      expect(error.message).toContain('@Get()');
      expect(error.message).toContain('@Post()');
    });
  });

  describe('DiscoveryError', () => {
    it('should include file path and reason', () => {
      const error = new DiscoveryError(
        '/path/to/controller.ts',
        'File not found'
      );

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('DiscoveryError');
      expect(error.code).toBe('DISCOVERY_ERROR');
      expect(error.filePath).toBe('/path/to/controller.ts');
      expect(error.message).toContain('/path/to/controller.ts');
      expect(error.message).toContain('File not found');
    });

    it('should include original error when provided', () => {
      const cause = new Error('ENOENT');
      const error = new DiscoveryError(
        '/path/to/controller.ts',
        'File not found',
        cause
      );

      expect(error.cause).toBe(cause);
      expect(error.message).toContain('ENOENT');
    });
  });

  describe('ControllerResolutionError', () => {
    it('should provide DI troubleshooting guidance', () => {
      const error = new ControllerResolutionError('UserController');

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('ControllerResolutionError');
      expect(error.code).toBe('CONTROLLER_RESOLUTION_ERROR');
      expect(error.controllerName).toBe('UserController');
      expect(error.message).toContain('DI container');
      expect(error.message).toContain('@Service');
    });

    it('should include original error when provided', () => {
      const cause = new Error('Token not found');
      const error = new ControllerResolutionError('UserController', cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toContain('Token not found');
    });
  });

  describe('ParameterInjectionError', () => {
    it('should include controller, method, and param info', () => {
      const error = new ParameterInjectionError(
        'UserController',
        'findOne',
        0,
        'Invalid transform'
      );

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('ParameterInjectionError');
      expect(error.code).toBe('PARAMETER_INJECTION_ERROR');
      expect(error.controllerName).toBe('UserController');
      expect(error.methodName).toBe('findOne');
      expect(error.paramIndex).toBe(0);
      expect(error.message).toContain('UserController');
      expect(error.message).toContain('findOne');
      expect(error.message).toContain('index 0');
    });
  });

  describe('MissingParameterError', () => {
    it('should identify missing required parameter', () => {
      const error = new MissingParameterError(
        'UserController',
        'findOne',
        'id',
        'param'
      );

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('MissingParameterError');
      expect(error.code).toBe('MISSING_PARAMETER');
      expect(error.controllerName).toBe('UserController');
      expect(error.methodName).toBe('findOne');
      expect(error.paramName).toBe('id');
      expect(error.source).toBe('param');
      expect(error.message).toContain('"id"');
      expect(error.message).toContain('param');
    });
  });

  describe('RouteRegistrationError', () => {
    it('should include route details', () => {
      const error = new RouteRegistrationError(
        'UserController',
        'GET',
        '/users/:id',
        'Duplicate route'
      );

      expect(error).toBeInstanceOf(ControllerError);
      expect(error.name).toBe('RouteRegistrationError');
      expect(error.code).toBe('ROUTE_REGISTRATION_ERROR');
      expect(error.controllerName).toBe('UserController');
      expect(error.method).toBe('GET');
      expect(error.path).toBe('/users/:id');
      expect(error.message).toContain('GET');
      expect(error.message).toContain('/users/:id');
    });

    it('should include original error when provided', () => {
      const cause = new Error('Path conflict');
      const error = new RouteRegistrationError(
        'UserController',
        'GET',
        '/users/:id',
        'Route conflict',
        cause
      );

      expect(error.cause).toBe(cause);
      expect(error.message).toContain('Path conflict');
    });
  });
});
