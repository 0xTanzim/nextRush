/**
 * RED Tests for @nextrush/class Diagnostics
 *
 * These tests drive the diagnostics feature:
 * (a) with diagnostics:true, getClassDiagnostics(app) returns routes matching registered controllers
 * (b) providers list reflects the DI graph
 * (c) duplicate-route detection flags two controllers/routes registering the same method+path
 * (d) circular-dependency detection flags provider cycles
 * (e) with diagnostics OFF (default), getClassDiagnostics returns undefined and no timing work
 */

import { Application } from '@nextrush/core';
import { Router } from '@nextrush/router';
import { Controller, Get, Post, Service, registerControllers, getClassDiagnostics } from '../index.js';
import { container as globalContainer, inject } from '@nextrush/di';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';

function makeApp(): { app: Application; router: Router } {
  const router = new Router();
  const app = new Application({ router, container: globalContainer });
  return { app, router };
}

// ============================================================================
// Test (a): Routes match registered controllers with diagnostics:true
// ============================================================================

describe('Diagnostics (a): routes match registered controllers', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('should collect routes from registered controllers', async () => {
    @Controller('/users')
    class UserController {
      @Get('/')
      list() {
        return [];
      }

      @Get('/:id')
      getOne() {
        return {};
      }

      @Post('/')
      create() {
        return { id: 1 };
      }
    }

    const { app } = makeApp();
    await registerControllers(app, {
      controllers: [UserController],
      diagnostics: true,
    });

    const report = getClassDiagnostics(app);
    expect(report).toBeDefined();
    expect(report?.routes).toHaveLength(3);
    expect(report?.routes).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/users',
        controller: UserController,
      })
    );
    expect(report?.routes).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/users/:id',
        controller: UserController,
      })
    );
    expect(report?.routes).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/users',
        controller: UserController,
      })
    );
  });
});

// ============================================================================
// Test (b): Providers list reflects the DI graph
// ============================================================================

describe('Diagnostics (b): providers list reflects DI graph', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('should collect providers and their dependencies', async () => {
    // Unit test collectDiagnostics directly with hand-built provider graph
    const { collectDiagnostics } = await import('../diagnostics/collector.js');

    const ServiceA = class ServiceA {};
    const ServiceB = class ServiceB {};
    const ControllerA = class ControllerA {};

    // Manually create provider graph
    const providers = new Map([
      [ServiceA, []],
      [ServiceB, [ServiceA]],
      [ControllerA, [ServiceB]],
    ]);

    const testGraph = {
      routes: [],
      providers,
      requestScopedTokens: new Set(),
    };

    const report = collectDiagnostics(testGraph as any, []);
    expect(report).toBeDefined();
    expect(report.providers).toBeDefined();
    expect(report.providers.length).toBe(3);

    // Check that all three are in the providers list
    const providerTokens = report.providers.map((p) => p.token);
    expect(providerTokens).toContain(ServiceA);
    expect(providerTokens).toContain(ServiceB);
    expect(providerTokens).toContain(ControllerA);

    // Check dependencies
    const serviceBProvider = report.providers.find((p) => p.token === ServiceB);
    expect(serviceBProvider?.dependencies).toContain(ServiceA);

    const controllerAProvider = report.providers.find((p) => p.token === ControllerA);
    expect(controllerAProvider?.dependencies).toContain(ServiceB);
  });
});

// ============================================================================
// Test (c): Duplicate-route detection flags same method+path twice
// ============================================================================

describe('Diagnostics (c): duplicate-route detection', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('should detect duplicate routes (same method+path)', async () => {
    // Unit test collectDiagnostics directly with hand-built routes
    // to bypass router registration which rejects duplicates
    const { collectDiagnostics } = await import('../diagnostics/collector.js');

    @Controller('/products')
    class ProductController1 {}

    @Controller('/products')
    class ProductController2 {}

    // Manually create BuiltRoute objects with duplicate method+path
    const routes = [
      {
        method: 'GET',
        path: '/products',
        handler: () => {},
        middleware: [],
        controller: ProductController1,
        methodName: 'list1',
      },
      {
        method: 'GET',
        path: '/products',
        handler: () => {},
        middleware: [],
        controller: ProductController2,
        methodName: 'list2',
      },
    ];

    const testGraph = {
      routes,
      providers: new Map(),
      requestScopedTokens: new Set(),
    };

    const report = collectDiagnostics(testGraph as any, []);
    expect(report.duplicateRoutes).toBeDefined();
    expect(report.duplicateRoutes.length).toBeGreaterThan(0);
    expect(report.duplicateRoutes).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/products',
        count: 2,
      })
    );
  });
});

// ============================================================================
// Test (d): Circular-dependency detection flags provider cycles
// ============================================================================

describe('Diagnostics (d): circular-dependency detection', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('should detect circular dependencies in provider graph', async () => {
    // Unit test collectDiagnostics directly with a cyclic providers Map
    // to avoid needing a real circular DI setup (which would fail at registration)
    const { collectDiagnostics } = await import('../diagnostics/collector.js');

    // Create a cyclic graph: A → B → A
    const A = class A {};
    const B = class B {};
    const cycleProviders = new Map([
      [A, [B]],
      [B, [A]],
    ]);

    const cyclicGraph = {
      routes: [],
      providers: cycleProviders,
      requestScopedTokens: new Set(),
    };

    const report = collectDiagnostics(cyclicGraph as any, []);
    expect(report.circularDependencies).toBeDefined();
    expect(report.circularDependencies.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test (e): Diagnostics OFF (default) returns undefined, zero timing work
// ============================================================================

describe('Diagnostics (e): disabled path is zero-cost', () => {
  beforeEach(() => {
    globalContainer.clearInstances();
  });

  it('should return undefined when diagnostics is false (default)', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      test() {
        return 'ok';
      }
    }

    const { app } = makeApp();
    await registerControllers(app, {
      controllers: [TestController],
      diagnostics: false,
    });

    const report = getClassDiagnostics(app);
    expect(report).toBeUndefined();
  });

  it('should return undefined when diagnostics is not specified (default)', async () => {
    @Controller('/test')
    class TestController {
      @Get('/')
      test() {
        return 'ok';
      }
    }

    const { app } = makeApp();
    await registerControllers(app, {
      controllers: [TestController],
    });

    const report = getClassDiagnostics(app);
    expect(report).toBeUndefined();
  });
});
