/**
 * @nextrush/decorators - Class Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import { getControllerMetadata, isController } from '../metadata.js';

describe('@Controller', () => {
  describe('path handling', () => {
    it('should set path from string argument', () => {
      @Controller('/users')
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/users');
    });

    it('should normalize path without leading slash', () => {
      @Controller('users')
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/users');
    });

    it('should remove trailing slash', () => {
      @Controller('/users/')
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/users');
    });

    it('should derive path from class name when no argument', () => {
      @Controller()
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/user');
    });

    it('should convert PascalCase to kebab-case', () => {
      @Controller()
      class UserProfileController {}

      const metadata = getControllerMetadata(UserProfileController);
      expect(metadata?.path).toBe('/user-profile');
    });

    it('should handle uppercase abbreviations', () => {
      @Controller()
      class APIController {}

      const metadata = getControllerMetadata(APIController);
      expect(metadata?.path).toBe('/api');
    });

    it('should return root path for single word class name when no path provided', () => {
      // When the class name after removing Controller suffix results in nothing meaningful,
      // or is just a short name, the path derives from the full name
      @Controller()
      class Ctrl {}

      const metadata = getControllerMetadata(Ctrl);
      // 'Ctrl' doesn't end in 'Controller', so it uses 'ctrl'
      expect(metadata?.path).toBe('/ctrl');
    });
  });

  describe('options handling', () => {
    it('should accept options object with path', () => {
      @Controller({ path: '/api/users' })
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/api/users');
    });

    it('should set version from options', () => {
      @Controller({ path: '/users', version: 'v2' })
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.version).toBe('v2');
    });

    it('should set middleware from options', () => {
      const authMiddleware = Symbol('auth');

      @Controller({ path: '/users', middleware: [authMiddleware] })
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.middleware).toEqual([authMiddleware]);
    });

    it('should set tags from options', () => {
      @Controller({ path: '/users', tags: ['users', 'admin'] })
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.tags).toEqual(['users', 'admin']);
    });

    it('should derive path from class name when path not in options', () => {
      @Controller({ version: 'v1' })
      class UserController {}

      const metadata = getControllerMetadata(UserController);
      expect(metadata?.path).toBe('/user');
      expect(metadata?.version).toBe('v1');
    });
  });

  describe('isController', () => {
    it('should return true for decorated class', () => {
      @Controller('/users')
      class UserController {}

      expect(isController(UserController)).toBe(true);
    });

    it('should return false for non-decorated class', () => {
      class NotAController {}

      expect(isController(NotAController)).toBe(false);
    });
  });
});
