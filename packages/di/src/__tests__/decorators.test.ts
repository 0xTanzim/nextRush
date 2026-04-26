/**
 * @nextrush/di - Decorators Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Config,
  container,
  getConfigPrefix,
  getOptionalParams,
  getServiceScope,
  getServiceType,
  hasServiceMetadata,
  inject,
  Optional,
  Repository,
  Service,
} from '../index.js';

describe('@nextrush/di - Decorators', () => {
  beforeEach(() => {
    container.reset();
  });

  describe('@Service', () => {
    it('should set service metadata on decorated class', () => {
      @Service()
      class TestService {}

      expect(hasServiceMetadata(TestService)).toBe(true);
      expect(getServiceType(TestService)).toBe('service');
    });

    it('should default to singleton scope', () => {
      @Service()
      class SingletonService {}

      expect(getServiceScope(SingletonService)).toBe('singleton');
    });

    it('should support transient scope option', () => {
      @Service({ scope: 'transient' })
      class TransientService {}

      expect(getServiceScope(TransientService)).toBe('transient');
    });

    it('should make class injectable via tsyringe', () => {
      @Service()
      class InjectableService {
        getValue() {
          return 'injected';
        }
      }

      container.register(InjectableService, { useClass: InjectableService });
      const instance = container.resolve(InjectableService);

      expect(instance.getValue()).toBe('injected');
    });
  });

  describe('@Repository', () => {
    it('should set repository metadata on decorated class', () => {
      @Repository()
      class TestRepository {}

      expect(hasServiceMetadata(TestRepository)).toBe(true);
      expect(getServiceType(TestRepository)).toBe('repository');
    });

    it('should default to singleton scope', () => {
      @Repository()
      class SingletonRepo {}

      expect(getServiceScope(SingletonRepo)).toBe('singleton');
    });

    it('should support transient scope option', () => {
      @Repository({ scope: 'transient' })
      class TransientRepo {}

      expect(getServiceScope(TransientRepo)).toBe('transient');
    });
  });

  describe('@inject', () => {
    it('should inject by string token', () => {
      const dbUrl = 'postgres://localhost/db';

      @Service()
      class DatabaseService {
        constructor(@inject('DATABASE_URL') public url: string) {}
      }

      container.register('DATABASE_URL', { useValue: dbUrl });
      container.register(DatabaseService, { useClass: DatabaseService });

      const instance = container.resolve(DatabaseService);

      expect(instance.url).toBe(dbUrl);
    });

    it('should inject by class token', () => {
      @Service()
      class LoggerService {
        log(msg: string) {
          return msg;
        }
      }

      @Service()
      class AppService {
        constructor(@inject(LoggerService) public logger: LoggerService) {}
      }

      container.register(LoggerService, { useClass: LoggerService });
      container.register(AppService, { useClass: AppService });

      const instance = container.resolve(AppService);

      expect(instance.logger).toBeInstanceOf(LoggerService);
    });

    it('should inject by symbol token', () => {
      const CONFIG = Symbol('CONFIG');
      const config = { debug: true };

      @Service()
      class ConfigService {
        constructor(@inject(CONFIG) public config: typeof config) {}
      }

      container.register(CONFIG, { useValue: config });
      container.register(ConfigService, { useClass: ConfigService });

      const instance = container.resolve(ConfigService);

      expect(instance.config).toEqual(config);
    });
  });

  describe('hasServiceMetadata', () => {
    it('should return true for decorated classes', () => {
      @Service()
      class DecoratedService {}

      expect(hasServiceMetadata(DecoratedService)).toBe(true);
    });

    it('should return false for plain classes', () => {
      class PlainClass {}

      expect(hasServiceMetadata(PlainClass)).toBe(false);
    });
  });

  describe('getServiceType', () => {
    it('should return "service" for @Service decorated classes', () => {
      @Service()
      class MyService {}

      expect(getServiceType(MyService)).toBe('service');
    });

    it('should return "repository" for @Repository decorated classes', () => {
      @Repository()
      class MyRepository {}

      expect(getServiceType(MyRepository)).toBe('repository');
    });

    it('should return undefined for plain classes', () => {
      class PlainClass {}

      expect(getServiceType(PlainClass)).toBeUndefined();
    });
  });

  describe('integration - multiple decorators', () => {
    it('should work with complex dependency graph', () => {
      @Service()
      class ConfigService {
        get(key: string) {
          return `config:${key}`;
        }
      }

      @Repository()
      class UserRepository {
        constructor(@inject(ConfigService) public config: ConfigService) {}

        find() {
          return [{ id: 1 }];
        }
      }

      @Service()
      class UserService {
        constructor(@inject(UserRepository) public repo: UserRepository) {}

        getUsers() {
          return this.repo.find();
        }
      }

      container.register(ConfigService, { useClass: ConfigService });
      container.register(UserRepository, { useClass: UserRepository });
      container.register(UserService, { useClass: UserService });

      const userService = container.resolve(UserService);

      expect(userService.repo).toBeInstanceOf(UserRepository);
      expect(userService.repo.config).toBeInstanceOf(ConfigService);
      expect(userService.getUsers()).toEqual([{ id: 1 }]);
    });
  });

  describe('@Config', () => {
    it('should set config metadata on decorated class', () => {
      @Config()
      class AppConfig {}

      expect(hasServiceMetadata(AppConfig)).toBe(true);
      expect(getServiceType(AppConfig)).toBe('config');
    });

    it('should always be singleton scope', () => {
      @Config()
      class AppConfig {}

      expect(getServiceScope(AppConfig)).toBe('singleton');
    });

    it('should store prefix metadata when provided', () => {
      @Config({ prefix: 'DB' })
      class DatabaseConfig {}

      expect(getConfigPrefix(DatabaseConfig)).toBe('DB');
    });

    it('should have no prefix by default', () => {
      @Config()
      class AppConfig {}

      expect(getConfigPrefix(AppConfig)).toBeUndefined();
    });

    it('should be resolvable from container', () => {
      @Config()
      class AppConfig {
        readonly port = 3000;
        readonly host = 'localhost';
      }

      container.register(AppConfig, { useClass: AppConfig });
      const config = container.resolve(AppConfig);

      expect(config).toBeInstanceOf(AppConfig);
      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
    });

    it('should be injectable into services', () => {
      @Config({ prefix: 'APP' })
      class AppConfig {
        readonly port = 8080;
      }

      @Service()
      class AppService {
        constructor(@inject(AppConfig) public config: AppConfig) {}

        getPort() {
          return this.config.port;
        }
      }

      container.register(AppConfig, { useClass: AppConfig });
      container.register(AppService, { useClass: AppService });

      const service = container.resolve(AppService);
      expect(service.getPort()).toBe(8080);
    });

    it('should return same instance (singleton behavior)', () => {
      @Config()
      class SingletonConfig {
        readonly id = Math.random();
      }

      // @Config applies @singleton() — no manual registration needed
      const a = container.resolve(SingletonConfig);
      const b = container.resolve(SingletonConfig);

      expect(a).toBe(b);
    });
  });

  describe('@Optional', () => {
    it('should mark constructor parameter as optional', () => {
      @Service()
      class WithOptional {
        constructor(
          @inject('REQUIRED') public required: unknown,
          @Optional() @inject('OPT') public opt: unknown
        ) {}
      }

      const indices = getOptionalParams(WithOptional);
      expect(indices).toContain(1);
      expect(indices).not.toContain(0);
    });

    it('should support multiple optional parameters', () => {
      @Service()
      class MultiOptional {
        constructor(
          @Optional() @inject('A') public a: unknown,
          @inject('B') public b: unknown,
          @Optional() @inject('C') public c: unknown
        ) {}
      }

      const indices = getOptionalParams(MultiOptional);
      expect(indices.has(0)).toBe(true);
      expect(indices.has(2)).toBe(true);
      expect(indices.has(1)).toBe(false);
    });

    it('should return empty array when no params are optional', () => {
      @Service()
      class NoOptional {
        constructor(@inject('X') public x: unknown) {}
      }

      const indices = getOptionalParams(NoOptional);
      expect(indices.size).toBe(0);
    });

    it('should not mark method parameters (only constructor params supported)', () => {
      // @Optional() with a method propertyKey stores metadata on the method, not the class.
      // getOptionalParams checks the class — so method-level @Optional is invisible.
      class MethodParam {
        doWork(@Optional() _data: unknown) {
          return _data;
        }
      }

      const indices = getOptionalParams(MethodParam);
      expect(indices.size).toBe(0);
    });
  });
});
