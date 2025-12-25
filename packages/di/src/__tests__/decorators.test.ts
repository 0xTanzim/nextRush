/**
 * @nextrush/di - Decorators Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    container,
    getServiceScope,
    getServiceType,
    hasServiceMetadata,
    inject,
    Repository,
    Service
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
});
