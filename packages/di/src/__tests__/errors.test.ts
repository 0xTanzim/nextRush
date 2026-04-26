/**
 * @nextrush/di - Errors Tests
 */

import { describe, expect, it } from 'vitest';
import {
    CircularDependencyError,
    ContainerDisposedError,
    DIError,
    DependencyResolutionError,
    InvalidProviderError,
    MissingDependencyError,
    TypeInferenceError,
} from '../errors.js';

describe('@nextrush/di - Errors', () => {
  describe('DIError', () => {
    it('should be an instance of Error', () => {
      const error = new DIError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DIError);
      expect(error.name).toBe('DIError');
    });
  });

  describe('DependencyResolutionError', () => {
    it('should include dependency chain in message', () => {
      const error = new DependencyResolutionError(
        ['UserController', 'UserService'],
        'UserRepository'
      );

      expect(error.message).toContain('UserController → UserService → UserRepository');
      expect(error.chain).toEqual(['UserController', 'UserService']);
      expect(error.missingDependency).toBe('UserRepository');
    });

    it('should handle empty chain', () => {
      const error = new DependencyResolutionError([], 'MissingService');

      expect(error.message).toContain('MissingService');
      expect(error.message).toContain('not registered');
    });

    it('should provide actionable fix suggestions', () => {
      const error = new DependencyResolutionError([], 'UserService');

      expect(error.message).toContain('@Service()');
      expect(error.message).toContain('@Repository()');
      expect(error.message).toContain('container.register');
    });
  });

  describe('CircularDependencyError', () => {
    it('should show the circular dependency cycle', () => {
      const error = new CircularDependencyError([
        'ServiceA',
        'ServiceB',
        'ServiceC',
      ]);

      expect(error.message).toContain('ServiceA → ServiceB → ServiceC → ServiceA');
      expect(error.cycle).toEqual(['ServiceA', 'ServiceB', 'ServiceC']);
    });

    it('should provide strategies to break the cycle', () => {
      const error = new CircularDependencyError(['A', 'B']);

      expect(error.message).toContain('delay');
      expect(error.message).toContain('event-driven');
      expect(error.message).toContain('third service');
    });
  });

  describe('TypeInferenceError', () => {
    it('should include class name and parameter index', () => {
      const error = new TypeInferenceError('UserService', 2);

      expect(error.message).toContain('UserService');
      expect(error.message).toContain('index 2');
      expect(error.className).toBe('UserService');
      expect(error.parameterIndex).toBe(2);
    });

    it('should provide fix suggestions', () => {
      const error = new TypeInferenceError('MyClass', 0);

      expect(error.message).toContain('type annotation');
      expect(error.message).toContain('emitDecoratorMetadata');
      expect(error.message).toContain('@inject()');
    });
  });

  describe('InvalidProviderError', () => {
    it('should include token in message', () => {
      const error = new InvalidProviderError('MyService');

      expect(error.message).toContain('MyService');
      expect(error.token).toBe('MyService');
    });

    it('should show valid provider formats', () => {
      const error = new InvalidProviderError('Test');

      expect(error.message).toContain('useClass');
      expect(error.message).toContain('useValue');
      expect(error.message).toContain('useFactory');
    });
  });

  describe('ContainerDisposedError', () => {
    it('should explain the container has been disposed', () => {
      const error = new ContainerDisposedError();

      expect(error.message).toContain('disposed');
      expect(error.message).toContain('test');
    });
  });

  describe('MissingDependencyError', () => {
    it('should include the missing token', () => {
      const error = new MissingDependencyError('ConfigService');

      expect(error.message).toContain('ConfigService');
      expect(error.token).toBe('ConfigService');
    });

    it('should provide registration guidance', () => {
      const error = new MissingDependencyError('Test');

      expect(error.message).toContain('Register');
      expect(error.message).toContain('@Service()');
    });
  });

  describe('error inheritance', () => {
    it('all errors should extend DIError', () => {
      expect(new DependencyResolutionError([], 'X')).toBeInstanceOf(DIError);
      expect(new CircularDependencyError(['A'])).toBeInstanceOf(DIError);
      expect(new TypeInferenceError('X', 0)).toBeInstanceOf(DIError);
      expect(new InvalidProviderError('X')).toBeInstanceOf(DIError);
      expect(new ContainerDisposedError()).toBeInstanceOf(DIError);
      expect(new MissingDependencyError('X')).toBeInstanceOf(DIError);
    });

    it('all errors should be catchable as Error', () => {
      const errors = [
        new DependencyResolutionError([], 'X'),
        new CircularDependencyError(['A']),
        new TypeInferenceError('X', 0),
        new InvalidProviderError('X'),
        new ContainerDisposedError(),
        new MissingDependencyError('X'),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
