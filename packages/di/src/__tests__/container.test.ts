/**
 * @nextrush/di - Container Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CircularDependencyError,
  container,
  createContainer,
  inject,
  InvalidProviderError,
  Optional,
  Repository,
  Service,
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

  describe('factory inject', () => {
    it('should resolve dependencies via inject array', () => {
      container.register('DB_URL', { useValue: 'postgres://localhost/test' });

      container.register('DATABASE', {
        useFactory: (url: string) => ({ url, connected: true }),
        inject: ['DB_URL'],
      });

      const db = container.resolve<{ url: string; connected: boolean }>('DATABASE');

      expect(db.url).toBe('postgres://localhost/test');
      expect(db.connected).toBe(true);
    });

    it('should resolve multiple dependencies via inject', () => {
      container.register('HOST', { useValue: 'localhost' });
      container.register('PORT', { useValue: 5432 });

      container.register('CONNECTION_STRING', {
        useFactory: (host: string, port: number) => `${host}:${port}`,
        inject: ['HOST', 'PORT'],
      });

      const connStr = container.resolve<string>('CONNECTION_STRING');

      expect(connStr).toBe('localhost:5432');
    });

    it('should work without inject (backward compatible)', () => {
      container.register('FACTORY_VALUE', {
        useFactory: (c) => {
          return 'created-by-factory';
        },
      });

      const value = container.resolve<string>('FACTORY_VALUE');

      expect(value).toBe('created-by-factory');
    });
  });

  describe('resolveAsync', () => {
    it('should resolve sync factory via resolveAsync', async () => {
      container.register('SYNC_VALUE', {
        useFactory: () => 42,
      });

      const value = await container.resolveAsync<number>('SYNC_VALUE');

      expect(value).toBe(42);
    });

    it('should resolve async factory via resolveAsync', async () => {
      container.register('ASYNC_VALUE', {
        useFactory: async () => {
          return 'async-result';
        },
      });

      const value = await container.resolveAsync<string>('ASYNC_VALUE');

      expect(value).toBe('async-result');
    });

    it('should resolve async factory with inject', async () => {
      container.register('CONFIG', { useValue: { dbUrl: 'postgres://localhost' } });

      container.register('DB', {
        useFactory: async (config: { dbUrl: string }) => {
          // Simulate async init
          return { url: config.dbUrl, connected: true };
        },
        inject: ['CONFIG'],
      });

      const db = await container.resolveAsync<{ url: string; connected: boolean }>('DB');

      expect(db.url).toBe('postgres://localhost');
      expect(db.connected).toBe(true);
    });

    it('should resolve value provider via resolveAsync', async () => {
      container.register('PLAIN', { useValue: 'hello' });

      const value = await container.resolveAsync<string>('PLAIN');

      expect(value).toBe('hello');
    });
  });

  describe('bootstrap', () => {
    it('should resolve sync factories and cache results', async () => {
      let callCount = 0;
      container.register('COUNTER', {
        useFactory: () => {
          callCount++;
          return 42;
        },
      });

      await container.bootstrap();

      // Should return cached value after bootstrap
      expect(container.resolve<number>('COUNTER')).toBe(42);
      expect(container.resolve<number>('COUNTER')).toBe(42);
      // Factory called once during bootstrap
      expect(callCount).toBe(1);
    });

    it('should resolve async factories and make them synchronous', async () => {
      container.register('ASYNC_VAL', {
        useFactory: async () => {
          return 'bootstrapped';
        },
      });

      await container.bootstrap();

      // After bootstrap, resolve returns sync value (not a Promise)
      const result = container.resolve<string>('ASYNC_VAL');
      expect(result).toBe('bootstrapped');
    });

    it('should handle async factory with inject array', async () => {
      container.register('HOST', { useValue: 'localhost' });
      container.register('PORT', { useValue: 5432 });
      container.register('DB_URL', {
        useFactory: async (host: string, port: number) => {
          return `postgres://${host}:${port}/mydb`;
        },
        inject: ['HOST', 'PORT'],
      });

      await container.bootstrap();

      expect(container.resolve<string>('DB_URL')).toBe('postgres://localhost:5432/mydb');
    });

    it('should handle dependency chain between async factories', async () => {
      container.register('CONFIG', {
        useFactory: async () => ({ dbUrl: 'postgres://localhost/test' }),
      });
      container.register('DATABASE', {
        useFactory: async (config: { dbUrl: string }) => {
          return { url: config.dbUrl, connected: true };
        },
        inject: ['CONFIG'],
      });

      await container.bootstrap();

      const db = container.resolve<{ url: string; connected: boolean }>('DATABASE');
      expect(db.url).toBe('postgres://localhost/test');
      expect(db.connected).toBe(true);
    });

    it('should not affect value providers', async () => {
      container.register('STATIC', { useValue: 'unchanged' });
      container.register('FACTORY', { useFactory: () => 'from-factory' });

      await container.bootstrap();

      expect(container.resolve<string>('STATIC')).toBe('unchanged');
      expect(container.resolve<string>('FACTORY')).toBe('from-factory');
    });

    it('should clear bootstrap cache on reset', async () => {
      container.register('CACHED', {
        useFactory: async () => 'cached-value',
      });

      await container.bootstrap();
      expect(container.resolve<string>('CACHED')).toBe('cached-value');

      container.reset();
      expect(container.isRegistered('CACHED')).toBe(false);
    });

    it('should clear bootstrap cache on clearInstances', async () => {
      container.register('CACHED2', {
        useFactory: async () => 'will-be-cleared',
      });

      await container.bootstrap();
      expect(container.resolve<string>('CACHED2')).toBe('will-be-cleared');

      container.clearInstances();

      // After clearInstances, token is still registered but cache is gone
      // Re-resolving goes through tsyringe factory again
      expect(container.isRegistered('CACHED2')).toBe(true);
    });

    it('should invalidate bootstrap cache on re-registration', async () => {
      container.register('MUTABLE', {
        useFactory: async () => 'first',
      });

      await container.bootstrap();
      expect(container.resolve<string>('MUTABLE')).toBe('first');

      // Re-register with new value
      container.register('MUTABLE', { useValue: 'second' });
      expect(container.resolve<string>('MUTABLE')).toBe('second');
    });

    it('should be idempotent (calling twice is safe)', async () => {
      let callCount = 0;
      container.register('ONCE', {
        useFactory: async () => {
          callCount++;
          return 'done';
        },
      });

      await container.bootstrap();
      await container.bootstrap();

      expect(container.resolve<string>('ONCE')).toBe('done');
      // Factory only called once (second bootstrap skips cached tokens)
      expect(callCount).toBe(1);
    });

    it('resolveAsync should return bootstrapped value without re-resolving', async () => {
      let callCount = 0;
      container.register('ASYNC_CACHED', {
        useFactory: async () => {
          callCount++;
          return 'resolved';
        },
      });

      await container.bootstrap();

      const result = await container.resolveAsync<string>('ASYNC_CACHED');
      expect(result).toBe('resolved');
      expect(callCount).toBe(1);
    });
  });

  describe('circular dependency detection (Set-based)', () => {
    it('should detect direct circular dependency with clear error', () => {
      @Service()
      class ServiceA {
        constructor(@inject('ServiceB') public b: unknown) {}
      }

      @Service()
      class ServiceB {
        constructor(@inject(ServiceA) public a: ServiceA) {}
      }

      container.register(ServiceA, { useClass: ServiceA });
      container.register('ServiceB', { useClass: ServiceB });

      expect(() => container.resolve(ServiceA)).toThrow(CircularDependencyError);
    });

    it('should not false-positive on sequential resolutions of the same token', () => {
      @Service()
      class SafeService {
        getValue() {
          return 'safe';
        }
      }

      container.register(SafeService, { useClass: SafeService });

      // Should not throw — resolving the same token twice sequentially is fine
      const a = container.resolve(SafeService);
      const b = container.resolve(SafeService);
      expect(a.getValue()).toBe('safe');
      expect(b.getValue()).toBe('safe');
    });
  });

  describe('error messages (P2-4)', () => {
    it('should provide actionable fix in DependencyResolutionError', () => {
      expect(() => container.resolve('NonExistentService')).toThrow(
        /@Service\(\).*@Repository\(\).*@Config\(\)/s
      );
    });

    it('should suggest checking imports in resolution error', () => {
      expect(() => container.resolve('MissingDep')).toThrow(/imported before container\.resolve/);
    });
  });

  describe('@Optional resolution behavior', () => {
    it('should resolve class with missing optional dep as undefined', () => {
      @Service()
      class OptService {
        constructor(@Optional() @inject('MISSING_MAILER') public mailer?: unknown) {}
      }

      container.register(OptService, { useClass: OptService });

      const instance = container.resolve(OptService);
      expect(instance).toBeDefined();
      expect(instance.mailer).toBeUndefined();
    });

    it('should resolve optional dep when it IS registered', () => {
      @Service()
      class OptServiceWithValue {
        constructor(@Optional() @inject('PRESENT_TOKEN') public dep?: string) {}
      }

      container.register('PRESENT_TOKEN', { useValue: 'hello' });
      container.register(OptServiceWithValue, { useClass: OptServiceWithValue });

      const instance = container.resolve(OptServiceWithValue);
      expect(instance.dep).toBe('hello');
    });

    it('should resolve mixed required + optional deps', () => {
      @Service()
      class MixedDeps {
        constructor(
          @inject('REQ') public required: string,
          @Optional() @inject('OPT_A') public optA?: unknown,
          @Optional() @inject('OPT_B') public optB?: unknown
        ) {}
      }

      container.register('REQ', { useValue: 'required-value' });
      // OPT_A and OPT_B intentionally NOT registered
      container.register(MixedDeps, { useClass: MixedDeps });

      const instance = container.resolve(MixedDeps);
      expect(instance.required).toBe('required-value');
      expect(instance.optA).toBeUndefined();
      expect(instance.optB).toBeUndefined();
    });

    it('should still throw for missing required (non-optional) deps', () => {
      @Service()
      class RequiredOnly {
        constructor(@inject('NOT_REGISTERED') public dep: unknown) {}
      }

      container.register(RequiredOnly, { useClass: RequiredOnly });

      expect(() => container.resolve(RequiredOnly)).toThrow();
    });
  });
});
