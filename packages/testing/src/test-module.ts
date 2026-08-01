import 'reflect-metadata';
import { Application } from '@nextrush/core';
import { Router } from '@nextrush/router';
import { createContainer } from '@nextrush/di';
import type { Container, Constructor, Token } from '@nextrush/di';
import { registerControllers, MemorySource } from '@nextrush/class';
import type { ModuleProvider } from '@nextrush/class';
import type { Context } from '@nextrush/types';
import { vi } from 'vitest';

/** A factory function compatible with the DI container's FactoryProvider. */
type FactoryFn = (...args: unknown[]) => unknown;

/**
 * A provider override recorded via `.override(token)`.
 */
interface OverrideConfig {
  token: Token;
  useValue?: unknown;
  useClass?: Constructor;
  useFactory?: FactoryFn;
  useFactoryInjects?: Token[];
}

/**
 * Builder returned by `.override(token)` to set the override strategy.
 */
interface OverrideBuilder {
  useValue(value: unknown): TestModuleBuilder;
  useClass(cls: Constructor): TestModuleBuilder;
  useFactory(fn: FactoryFn, inject?: Token[]): TestModuleBuilder;
}

/**
 * Configuration for creating a test module.
 */
export interface TestModuleConfig {
  controllers?: Function[];
  providers?: ModuleProvider[];
}

/**
 * Test module reference — the compiled, isolated test environment.
 */
export class TestModuleRef {
  constructor(
    private app: Application,
    private router: Router,
    private container: Container
  ) {}

  /**
   * Resolve a token from the isolated container with full type safety.
   */
  get<T>(token: Token<T>): T {
    return this.container.resolve<T>(token);
  }

  /**
   * Drive a request through the matched route handler and capture the response.
   */
  async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; body: unknown }> {
    const httpMethod = method.toUpperCase() as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'HEAD'
      | 'OPTIONS';
    const match = this.router.match(httpMethod, path);
    if (!match) {
      throw new Error(`No route matched: ${method} ${path}`);
    }

    const ctx = this.createCapturingContext(method, path, body);
    const noOpNext = async (): Promise<void> => {};
    // The router stores handlers as loosely-typed middleware; narrow at the call boundary.
    const handler = match.handler as unknown as (
      ctx: Context,
      next: () => Promise<void>
    ) => Promise<void>;
    await handler(ctx, noOpNext);

    return {
      status: ctx.status,
      body: ctx.responseBody,
    };
  }

  /**
   * Close the application and trigger OnShutdown hooks.
   */
  async close(): Promise<void> {
    await this.app.close();
  }

  /**
   * Create a minimal in-memory Context that captures responses.
   */
  private createCapturingContext(
    method: string,
    path: string,
    body?: unknown
  ): Context & { status: number; responseBody: unknown } {
    let responseBody: unknown;

    const ctx = {
      method: method.toUpperCase() as Context['method'],
      url: path,
      path,
      query: {},
      headers: {},
      ip: '127.0.0.1',
      body,
      params: {},
      status: 200,
      state: {},
      responded: false,
      json: (data: unknown) => {
        responseBody = data;
      },
      send: (data: unknown) => {
        responseBody = data;
      },
      html: (data: string) => {
        responseBody = data;
      },
      redirect: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      next: async () => {},
      raw: { req: {}, res: { writableEnded: false } },
      responseBody: undefined,
    } as unknown as Context & { status: number; responseBody: unknown };

    // Expose the captured payload after json/send calls.
    Object.defineProperty(ctx, 'responseBody', {
      get: () => responseBody,
      configurable: true,
    });

    return ctx;
  }
}

/**
 * Builder for creating and configuring a test module.
 */
export class TestModuleBuilder {
  private overrides: Map<Token, OverrideConfig> = new Map();
  private config: TestModuleConfig;

  constructor(config: TestModuleConfig = {}) {
    this.config = config;
  }

  /**
   * Override a token with a custom value, class, or factory.
   */
  override(token: Token): OverrideBuilder {
    const self = this;

    return {
      useValue(value: unknown): TestModuleBuilder {
        self.overrides.set(token, { token, useValue: value });
        return self;
      },

      useClass(cls: Constructor): TestModuleBuilder {
        self.overrides.set(token, { token, useClass: cls });
        return self;
      },

      useFactory(fn: FactoryFn, inject?: Token[]): TestModuleBuilder {
        self.overrides.set(token, { token, useFactory: fn, useFactoryInjects: inject });
        return self;
      },
    };
  }

  /**
   * Compile the test module into an isolated, ready-to-test TestModuleRef.
   */
  async compile(): Promise<TestModuleRef> {
    // Fresh, isolated container per compiled module.
    const container = createContainer();

    for (const provider of this.config.providers ?? []) {
      registerProvider(provider, container);
    }

    // Overrides win over any real provider registration above.
    for (const override of this.overrides.values()) {
      registerOverride(override, container);
    }

    const router = new Router();
    const app = new Application({ router, container });

    const source = new MemorySource(this.config.controllers ?? []);
    await registerControllers(app, { source, container });

    return new TestModuleRef(app, router, container);
  }
}

/** Register a module provider (bare class or provider config) into the container. */
function registerProvider(provider: ModuleProvider, container: Container): void {
  if (typeof provider === 'function') {
    const cls = provider as Constructor;
    container.register(cls, { useClass: cls });
    return;
  }

  const scope = provider.scope;
  const options = scope ? { scope } : undefined;

  if ('useValue' in provider) {
    container.register(provider.provide, { useValue: provider.useValue });
    return;
  }
  if (provider.useFactory) {
    container.register(
      provider.provide,
      { useFactory: provider.useFactory, inject: provider.inject },
      options
    );
    return;
  }
  if (provider.useClass) {
    container.register(provider.provide, { useClass: provider.useClass }, options);
  }
}

/** Register a recorded override into the container. */
function registerOverride(override: OverrideConfig, container: Container): void {
  if (override.useValue !== undefined) {
    container.register(override.token, { useValue: override.useValue });
    return;
  }
  if (override.useClass) {
    container.register(override.token, { useClass: override.useClass });
    return;
  }
  if (override.useFactory) {
    container.register(override.token, {
      useFactory: override.useFactory,
      inject: override.useFactoryInjects,
    });
  }
}

/**
 * Create a test module builder with the given configuration.
 */
export function createTestModule(config: TestModuleConfig = {}): TestModuleBuilder {
  return new TestModuleBuilder(config);
}
