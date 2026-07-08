/**
 * @nextrush/di - Errors Tests
 */

import { describe, expect, it } from 'vitest';
import {
    CircularDependencyError,
    DIError,
    DependencyResolutionError,
    InvalidProviderError,
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

  describe('error inheritance', () => {
    it('all errors should extend DIError', () => {
      expect(new DependencyResolutionError([], 'X')).toBeInstanceOf(DIError);
      expect(new CircularDependencyError(['A'])).toBeInstanceOf(DIError);
      expect(new InvalidProviderError('X')).toBeInstanceOf(DIError);
    });

    it('all errors should be catchable as Error', () => {
      const errors = [
        new DependencyResolutionError([], 'X'),
        new CircularDependencyError(['A']),
        new InvalidProviderError('X'),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
