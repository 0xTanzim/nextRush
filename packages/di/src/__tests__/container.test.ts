/**
 * @nextrush/di - Container Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    container,
    createContainer,
    inject,
    InvalidProviderError,
    Repository,
    Service
} from '../index.js';

describe('@nextrush/di - Container', () => {
  beforeEach(() => {
    container.reset();
  });

  describe('register', () => {
    it('should register a class provider', () => {
      @Service()
      class TestService {}

      container.register(TestService, { useClass: TestService });

      expect(container.isRegistered(TestService)).toBe(true);
    });

    it('should register a value provider', () => {
      const config = { port: 3000 };

      container.register('CONFIG', { useValue: config });

      expect(container.isRegistered('CONFIG')).toBe(true);
    });

    it('should register a factory provider', () => {
      container.register('RANDOM', {
        useFactory: () => Math.random(),
      });

      expect(container.isRegistered('RANDOM')).toBe(true);
    });

    it('should throw InvalidProviderError for invalid provider', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid provider
        container.register('TEST', {});
      }).toThrow(InvalidProviderError);
    });
  });

  describe('resolve', () => {
    it('should resolve a registered class', () => {
      @Service()
      class TestService {
        getValue() {
          return 'test';
        }
      }

      container.register(TestService, { useClass: TestService });
      const instance = container.resolve(TestService);

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test');
    });

    it('should resolve a registered value', () => {
      const config = { port: 3000, host: 'localhost' };

      container.register('CONFIG', { useValue: config });
      const resolved = container.resolve<typeof config>('CONFIG');

      expect(resolved).toEqual(config);
    });

    it('should return singleton instance by default', () => {
      @Service({ scope: 'singleton' })
      class SingletonService {}

      // @Service({ scope: 'singleton' }) already registers the class as singleton
      // No need to call container.register() again

      const instance1 = container.resolve(SingletonService);
      const instance2 = container.resolve(SingletonService);

      expect(instance1).toBe(instance2);
    });

    it('should auto-inject dependencies', () => {
      @Service()
      class DepService {
        getValue() {
          return 'dependency';
        }
      }

      @Service()
      class MainService {
        constructor(@inject(DepService) public dep: DepService) {}
      }

      container.register(DepService, { useClass: DepService });
      container.register(MainService, { useClass: MainService });

      const instance = container.resolve(MainService);

      expect(instance.dep).toBeInstanceOf(DepService);
      expect(instance.dep.getValue()).toBe('dependency');
    });

    it('should handle nested dependencies', () => {
      @Service()
      class DatabaseService {
        query() {
          return ['data'];
        }
      }

      @Repository()
      class UserRepository {
        constructor(@inject(DatabaseService) public db: DatabaseService) {}
      }

      @Service()
      class UserService {
        constructor(@inject(UserRepository) public repo: UserRepository) {}
      }

      container.register(DatabaseService, { useClass: DatabaseService });
      container.register(UserRepository, { useClass: UserRepository });
      container.register(UserService, { useClass: UserService });

      const instance = container.resolve(UserService);

      expect(instance.repo).toBeInstanceOf(UserRepository);
      expect(instance.repo.db).toBeInstanceOf(DatabaseService);
    });
  });

  describe('resolveAll', () => {
    it('should resolve all instances registered under a token', () => {
      class Plugin {
        constructor(public name: string) {}
      }

      container.register('Plugin', { useValue: new Plugin('A') });
      container.register('Plugin', { useValue: new Plugin('B') });

      const plugins = container.resolveAll<Plugin>('Plugin');

      expect(plugins).toHaveLength(2);
    });

    it('should return empty array for unregistered token', () => {
      const result = container.resolveAll('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered token', () => {
      container.register('TEST', { useValue: 'test' });

      expect(container.isRegistered('TEST')).toBe(true);
    });

    it('should return false for unregistered token', () => {
      expect(container.isRegistered('UNKNOWN')).toBe(false);
    });
  });

  describe('clearInstances', () => {
    it('should clear singleton instances', () => {
      @Service()
      class CounterService {
        public count = 0;
      }

      container.register(CounterService, { useClass: CounterService });

      const instance1 = container.resolve(CounterService);
      instance1.count = 5;

      container.clearInstances();

      const instance2 = container.resolve(CounterService);

      expect(instance2.count).toBe(0);
    });
  });

  describe('createChild', () => {
    it('should create an isolated child container', () => {
      container.register('PARENT', { useValue: 'parent' });

      const child = container.createChild();
      child.register('CHILD', { useValue: 'child' });

      expect(child.isRegistered('CHILD')).toBe(true);
      expect(container.isRegistered('CHILD')).toBe(false);
    });
  });

  describe('createContainer', () => {
    it('should create a new isolated container', () => {
      const isolated = createContainer();

      // Don't use @Service() decorator here as it registers globally
      // Just use a plain class and register it manually
      class IsolatedService {
        getValue() {
          return 'isolated';
        }
      }

      isolated.register(IsolatedService, { useClass: IsolatedService });

      expect(isolated.isRegistered(IsolatedService)).toBe(true);
      expect(container.isRegistered(IsolatedService)).toBe(false);
    });
  });
});
