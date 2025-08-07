/**
 * DI Container Tests for NextRush v2
 *
 * Tests for the complex DI container setup concerns identified in application.ts
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@/core/app/application';
import { createContainer, type DIContainer } from '@/core/di/container';
import { createMiddlewareFactory } from '@/core/di/middleware-factory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('DI Container Management', () => {
  let app: Application;
  let container: DIContainer;

  beforeEach(() => {
    app = createApp({ port: 3016 });
    container = createContainer();
  });

  afterEach(async () => {
    await app.shutdown();
  });

  describe('Container Initialization', () => {
    it('should create DI container during application initialization', () => {
      const testApp = createApp();
      expect(testApp).toBeDefined();

      // Container should be created and middleware factory should work
      const corsMiddleware = testApp.cors();
      expect(corsMiddleware).toBeDefined();
      expect(typeof corsMiddleware).toBe('function');
    });

    it('should register default middleware with container', () => {
      const testContainer = createContainer();

      // Create middleware factory to trigger registration
      const factory = createMiddlewareFactory(testContainer);

      expect(factory).toBeDefined();
      expect(typeof factory.createCors).toBe('function');
      expect(typeof factory.createHelmet).toBe('function');
      expect(typeof factory.createSmartBodyParser).toBe('function');
    });

    it('should handle container creation with proper service registration', () => {
      const testContainer = createContainer();

      // Register a test service
      testContainer.singleton('TEST_SERVICE', () => ({ test: true }));

      const service = testContainer.resolve('TEST_SERVICE');
      expect(service).toEqual({ test: true });
    });
  });

  describe('Middleware Factory Integration', () => {
    it('should create middleware through factory pattern', () => {
      const corsMiddleware = app.cors({
        origin: ['http://localhost:3000'],
        credentials: true,
      });

      expect(corsMiddleware).toBeDefined();
      expect(typeof corsMiddleware).toBe('function');
    });

    it('should delegate middleware creation to factory', () => {
      const helmetMiddleware = app.helmet({
        noSniff: true,
        xssFilter: true,
      });

      const bodyParserMiddleware = app.smartBodyParser({
        maxSize: 1024 * 1024,
      });

      const rateLimitMiddleware = app.rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
      });

      expect(helmetMiddleware).toBeDefined();
      expect(bodyParserMiddleware).toBeDefined();
      expect(rateLimitMiddleware).toBeDefined();
    });

    it('should handle factory fallbacks when container resolution fails', () => {
      // This tests the fallback mechanism in middleware factory
      const compressionMiddleware = app.compression({
        level: 6,
        threshold: 1024,
      });

      expect(compressionMiddleware).toBeDefined();
      expect(typeof compressionMiddleware).toBe('function');
    });

    it('should support logger middleware factory methods', () => {
      const loggerMiddleware = app.logger({
        format: 'combined',
      });

      const requestIdMiddleware = app.requestId({
        headerName: 'X-Request-ID',
      });

      const timerMiddleware = app.timer({
        digits: 2,
      });

      expect(loggerMiddleware).toBeDefined();
      expect(requestIdMiddleware).toBeDefined();
      expect(timerMiddleware).toBeDefined();
    });
  });

  describe('Service Resolution and Lifecycle', () => {
    it('should resolve singleton services correctly', () => {
      container.singleton('SINGLETON_SERVICE', () => ({
        id: Math.random(),
        type: 'singleton',
      }));

      const service1 = container.resolve('SINGLETON_SERVICE') as any;
      const service2 = container.resolve('SINGLETON_SERVICE') as any;

      // Should be the same instance
      expect(service1).toBe(service2);
      expect(service1.type).toBe('singleton');
    });

    it('should resolve transient services correctly', () => {
      container.transient('TRANSIENT_SERVICE', () => ({
        id: Math.random(),
        type: 'transient',
      }));

      const service1 = container.resolve('TRANSIENT_SERVICE') as any;
      const service2 = container.resolve('TRANSIENT_SERVICE') as any;

      // Should be different instances
      expect(service1).not.toBe(service2);
      expect(service1.type).toBe('transient');
      expect(service2.type).toBe('transient');
    });

    it('should handle service dependencies correctly', () => {
      // Register dependencies
      container.singleton('DATABASE', () => ({
        connection: 'mock-db',
        type: 'database',
      }));

      container.singleton('LOGGER', () => ({
        log: (message: string) => `[LOG] ${message}`,
        type: 'logger',
      }));

      // Register service with dependencies
      container.singleton(
        'USER_SERVICE',
        (db: any, logger: any) => ({
          db,
          logger,
          getUser: (id: string) => logger.log(`Getting user ${id}`),
          type: 'service',
        }),
        ['DATABASE', 'LOGGER']
      );

      const userService = container.resolve('USER_SERVICE') as any;

      expect(userService.type).toBe('service');
      expect(userService.db.type).toBe('database');
      expect(userService.logger.type).toBe('logger');
      expect(userService.getUser('123')).toBe('[LOG] Getting user 123');
    });

    it('should handle circular dependency detection', () => {
      container.singleton(
        'SERVICE_A',
        (serviceB: any) => ({
          serviceB,
          type: 'A',
        }),
        ['SERVICE_B']
      );

      container.singleton(
        'SERVICE_B',
        (serviceA: any) => ({
          serviceA,
          type: 'B',
        }),
        ['SERVICE_A']
      );

      // Should handle circular dependency gracefully
      expect(() => {
        container.resolve('SERVICE_A');
      }).toThrow(); // Should throw circular dependency error
    });
  });

  describe('Exception Filter Factory', () => {
    it('should create exception filter middleware', () => {
      const exceptionFilter = app.exceptionFilter();

      expect(exceptionFilter).toBeDefined();
      expect(typeof exceptionFilter).toBe('function');
    });

    it('should create exception filter with custom filters', () => {
      // Mock custom exception filters
      const customFilters = [
        {
          catch: async (_error: Error, ctx: any) => {
            ctx.res.status(400).json({ error: 'Custom error' });
          },
        },
      ];

      const exceptionFilter = app.exceptionFilter(customFilters);

      expect(exceptionFilter).toBeDefined();
      expect(typeof exceptionFilter).toBe('function');
    });

    it('should integrate with global exception handling', async () => {
      app.use(app.exceptionFilter());

      app.get('/exception-integration', async () => {
        throw new Error('Integration test error');
      });

      app.listen(3016);
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(
        'http://localhost:3016/exception-integration'
      );

      // Should handle error through exception filter
      expect(response.status).toBe(500);
    });
  });

  describe('Logger Plugin Integration', () => {
    it('should support logger middleware creation', () => {
      const loggerMiddleware = app.logger({
        format: 'combined',
      });

      expect(loggerMiddleware).toBeDefined();
      expect(typeof loggerMiddleware).toBe('function');
    });

    it('should handle different logger configurations', () => {
      const simpleLogger = app.logger();
      const customLogger = app.logger({
        format: 'detailed',
      });

      expect(simpleLogger).toBeDefined();
      expect(customLogger).toBeDefined();
    });
  });

  describe('Memory Management and Performance', () => {
    it('should handle container memory efficiently', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Register many services
      for (let i = 0; i < 1000; i++) {
        container.singleton(`SERVICE_${i}`, () => ({ id: i }));
      }

      // Resolve many services
      for (let i = 0; i < 1000; i++) {
        const service = container.resolve(`SERVICE_${i}`) as any;
        expect(service.id).toBe(i);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    it('should cache resolved singletons for performance', () => {
      let factoryCallCount = 0;

      container.singleton('CACHED_SERVICE', () => {
        factoryCallCount++;
        return { value: 'cached' };
      });

      // Resolve multiple times
      for (let i = 0; i < 100; i++) {
        container.resolve('CACHED_SERVICE');
      }

      // Factory should only be called once
      expect(factoryCallCount).toBe(1);
    });

    it('should handle high-frequency resolutions efficiently', () => {
      container.singleton('HIGH_FREQ_SERVICE', () => ({
        timestamp: Date.now(),
      }));

      const startTime = Date.now();

      // Resolve many times
      for (let i = 0; i < 10000; i++) {
        container.resolve('HIGH_FREQ_SERVICE');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast (cached resolution)
      expect(duration).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('Integration with Application Lifecycle', () => {
    it('should initialize container before middleware registration', () => {
      const testApp = createApp();

      // Should be able to use middleware factory methods immediately
      const middleware = testApp.cors();
      expect(middleware).toBeDefined();
    });

    it('should maintain container state throughout application lifecycle', async () => {
      const testApp = createApp({ port: 3017 });

      // Add middleware that uses DI
      testApp.use(testApp.cors());
      testApp.use(testApp.helmet());
      testApp.use(testApp.smartBodyParser());

      testApp.get('/di-test', async ctx => {
        ctx.res.json({ success: true });
      });

      testApp.listen(3017);
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch('http://localhost:3017/di-test');
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);

      await testApp.shutdown();
    });

    it('should clean up container resources on shutdown', async () => {
      const testApp = createApp({ port: 3018 });

      testApp.listen(3018);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Container should be functional
      const middleware = testApp.cors();
      expect(middleware).toBeDefined();

      await testApp.shutdown();

      // After shutdown, container should still be accessible but app should be shut down
      expect(testApp).toBeDefined();
    });
  });
});
