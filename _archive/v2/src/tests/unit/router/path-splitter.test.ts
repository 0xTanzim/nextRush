/**
 * PathSplitter unit tests
 */

import { PathSplitter } from '@/core/router/path-splitter';
import { beforeEach, describe, expect, it } from 'vitest';

describe('PathSplitter', () => {
  beforeEach(() => {
    PathSplitter.clearCache();
  });

  describe('split', () => {
    it('should return empty array for root path', () => {
      expect(PathSplitter.split('/')).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(PathSplitter.split('')).toEqual([]);
    });

    it('should split simple path', () => {
      expect(PathSplitter.split('/users')).toEqual(['users']);
    });

    it('should split nested path', () => {
      expect(PathSplitter.split('/users/123/profile')).toEqual([
        'users',
        '123',
        'profile',
      ]);
    });

    it('should handle paths without leading slash', () => {
      expect(PathSplitter.split('users/123')).toEqual(['users', '123']);
    });

    it('should handle trailing slash', () => {
      expect(PathSplitter.split('/users/')).toEqual(['users']);
    });

    it('should handle parameter segments', () => {
      expect(PathSplitter.split('/users/:id')).toEqual(['users', ':id']);
    });

    it('should handle wildcard segments', () => {
      expect(PathSplitter.split('/static/*')).toEqual(['static', '*']);
    });

    it('should cache repeated paths', () => {
      const path = '/api/v1/users';

      PathSplitter.split(path);
      const sizeBefore = PathSplitter.getCacheSize();

      PathSplitter.split(path);
      const sizeAfter = PathSplitter.getCacheSize();

      expect(sizeAfter).toBe(sizeBefore);
    });
  });

  describe('isParameterized', () => {
    it('should return true for parameter segment', () => {
      expect(PathSplitter.isParameterized(':id')).toBe(true);
      expect(PathSplitter.isParameterized(':userId')).toBe(true);
    });

    it('should return false for static segment', () => {
      expect(PathSplitter.isParameterized('users')).toBe(false);
      expect(PathSplitter.isParameterized('api')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(PathSplitter.isParameterized('')).toBe(false);
    });

    it('should return false for wildcard', () => {
      expect(PathSplitter.isParameterized('*')).toBe(false);
    });
  });

  describe('extractParamName', () => {
    it('should extract parameter name', () => {
      expect(PathSplitter.extractParamName(':id')).toBe('id');
      expect(PathSplitter.extractParamName(':userId')).toBe('userId');
    });

    it('should return null for non-parameter segment', () => {
      expect(PathSplitter.extractParamName('users')).toBeNull();
      expect(PathSplitter.extractParamName('*')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(PathSplitter.extractParamName('')).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should report cache size', () => {
      PathSplitter.split('/path1');
      PathSplitter.split('/path2');

      expect(PathSplitter.getCacheSize()).toBe(2);
    });

    it('should clear cache', () => {
      PathSplitter.split('/path1');
      PathSplitter.split('/path2');
      PathSplitter.clearCache();

      expect(PathSplitter.getCacheSize()).toBe(0);
    });
  });
});
