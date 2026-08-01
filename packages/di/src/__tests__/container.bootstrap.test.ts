/**
 * @nextrush/di - Container Bootstrap & Async Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { container } from '../index.js';

describe('@nextrush/di - Container - Factory Inject', () => {
  beforeEach(() => {
    container.reset();
  });

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

describe('@nextrush/di - Container - ResolveAsync', () => {
  beforeEach(() => {
    container.reset();
  });

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

describe('@nextrush/di - Container - Bootstrap', () => {
  beforeEach(() => {
    container.reset();
  });

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

  it('bootstrap() twice keeps factory values resolvable and invokes the factory once', async () => {
    let callCount = 0;
    container.register('BOOT_TWICE', {
      useFactory: async () => {
        callCount++;
        return 'value';
      },
    });

    await container.bootstrap();
    await container.bootstrap();

    expect(container.resolve<string>('BOOT_TWICE')).toBe('value');
    expect(callCount).toBe(1);
  });

  it('processes a factory registered after a previous bootstrap()', async () => {
    let firstCalls = 0;
    container.register('FIRST_FACTORY', {
      useFactory: async () => {
        firstCalls++;
        return 'first';
      },
    });

    await container.bootstrap();
    expect(container.resolve<string>('FIRST_FACTORY')).toBe('first');

    // A NEW factory registered after the first bootstrap must be bootstrapped by a
    // second bootstrap() — the global container is shared across apps/registration
    // cycles in one process (createApp/registerControllers reuse).
    let secondCalls = 0;
    container.register('SECOND_FACTORY', {
      useFactory: async () => {
        secondCalls++;
        return 'second';
      },
    });

    await container.bootstrap();

    // Async value already awaited during bootstrap → resolve returns it synchronously.
    expect(container.resolve<string>('SECOND_FACTORY')).toBe('second');
    expect(secondCalls).toBe(1);
    // First factory not re-invoked — cached from the first bootstrap.
    expect(firstCalls).toBe(1);
  });

  it('stays re-runnable: re-bootstraps async factories after clearInstances()', async () => {
    let callCount = 0;
    container.register('RERUNNABLE', {
      useFactory: async () => {
        callCount++;
        return 'ready';
      },
    });

    await container.bootstrap();
    expect(container.resolve<string>('RERUNNABLE')).toBe('ready');
    expect(callCount).toBe(1);

    // clearInstances() drops the bootstrap cache but keeps registrations. bootstrap()
    // must remain re-runnable so a second call re-resolves the async factory and
    // resolve() again returns the awaited value synchronously (not a pending Promise).
    container.clearInstances();

    await container.bootstrap();

    expect(container.resolve<string>('RERUNNABLE')).toBe('ready');
    expect(callCount).toBe(2);
  });
});
