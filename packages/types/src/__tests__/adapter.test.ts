/**
 * @nextrush/types - Adapter conformance contract tests (F-01)
 *
 * These tests pin the *shape* of the light adapter contract that every adapter
 * `satisfies` at export time. They are both runtime assertions (that concrete
 * implementations wire up) and compile-time assertions (that the contract is
 * satisfiable and generic over the concrete application type).
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AdapterContext, AdapterContextFactory } from '../adapter-context';
import type {
  FetchAdapter,
  FetchHandler,
  FetchHandlerOptions,
  HandlerOptions,
  ServerAdapter,
  ServerAddress,
  ServerHandle,
} from '../adapter';

describe('ServerAddress', () => {
  it('is the single canonical { port, host } shape', () => {
    const address: ServerAddress = { port: 8080, host: '0.0.0.0' };
    expect(address.port).toBe(8080);
    expect(address.host).toBe('0.0.0.0');
    expectTypeOf<ServerAddress['port']>().toEqualTypeOf<number>();
    expectTypeOf<ServerAddress['host']>().toEqualTypeOf<string>();
  });
});

describe('ServerHandle', () => {
  it('exposes a canonical address() and an async close()', async () => {
    let closed = false;
    const handle: ServerHandle = {
      address: () => ({ port: 3000, host: '127.0.0.1' }),
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    };
    expect(handle.address().port).toBe(3000);
    await handle.close();
    expect(closed).toBe(true);
    expectTypeOf<ServerHandle['address']>().toEqualTypeOf<() => ServerAddress>();
  });
});

describe('HandlerOptions / FetchHandlerOptions', () => {
  it('allow the light shared options without requiring them', () => {
    const empty: HandlerOptions = {};
    const withTimeout: HandlerOptions = { timeout: 30_000 };
    expect(empty).toBeDefined();
    expect(withTimeout.timeout).toBe(30_000);

    const fetchOpts: FetchHandlerOptions = { timeout: 25_000 };
    expect(fetchOpts.timeout).toBe(25_000);
  });
});

describe('ServerAdapter', () => {
  it('is satisfiable by a server-style adapter generic over the app type', async () => {
    interface FakeApp {
      readonly name: string;
    }
    interface FakeOptions {
      port?: number;
    }

    const adapter = {
      async serve(_app: FakeApp, _options?: FakeOptions): Promise<ServerHandle> {
        return {
          address: () => ({ port: 8080, host: '0.0.0.0' }),
          close: () => Promise.resolve(),
        };
      },
      createHandler(_app: FakeApp, _options?: HandlerOptions): (req: unknown) => void {
        return () => undefined;
      },
    } satisfies ServerAdapter<FakeApp, FakeOptions>;

    const handle = await adapter.serve({ name: 'app' }, { port: 8080 });
    expect(handle.address().host).toBe('0.0.0.0');
  });
});

describe('FetchAdapter', () => {
  it('is satisfiable by a fetch-style adapter that returns a FetchHandler', async () => {
    interface FakeApp {
      readonly name: string;
    }

    const adapter = {
      createFetchHandler(_app: FakeApp, _options?: FetchHandlerOptions): FetchHandler {
        return (_request: Request) => new Response('ok');
      },
    } satisfies FetchAdapter<FakeApp>;

    const handler = adapter.createFetchHandler({ name: 'app' });
    const res = await handler(new Request('http://localhost/'));
    expect(res.status).toBe(200);
  });
});

describe('ServerAdapter — negative (contract is enforced)', () => {
  it('rejects an adapter missing createHandler', () => {
    // prettier-ignore
    // @ts-expect-error - a ServerAdapter missing createHandler must not satisfy the contract
    const bad: ServerAdapter = { serve: (_app: unknown) => Promise.resolve({ address: () => ({ port: 0, host: '' }), close: () => Promise.resolve() }) };
    void bad;
    expect(true).toBe(true);
  });

  it('rejects an adapter whose serve does not return a ServerHandle', () => {
    // prettier-ignore
    // @ts-expect-error - serve must resolve to a ServerHandle, not a bare object
    const bad: ServerAdapter = { serve: (_app: unknown) => Promise.resolve({ nope: true }), createHandler: (_app: unknown) => () => undefined };
    void bad;
    expect(true).toBe(true);
  });
});

describe('FetchAdapter — negative (contract is enforced)', () => {
  it('rejects a fetch adapter whose handler does not return a Response', () => {
    // prettier-ignore
    // @ts-expect-error - createFetchHandler must return a FetchHandler producing a Response
    const bad: FetchAdapter = { createFetchHandler: (_app: unknown) => (_req: Request): string => 'not a response' };
    void bad;
    expect(true).toBe(true);
  });
});

describe('AdapterContextFactory', () => {
  it('is satisfiable by a factory that returns an AdapterContext', () => {
    const factory = ((_req: Request): AdapterContext => {
      return { markResponded: () => undefined } as unknown as AdapterContext;
    }) satisfies AdapterContextFactory<[Request]>;

    const ctx = factory(new Request('http://localhost/'));
    expect(typeof ctx.markResponded).toBe('function');
  });

  it('carries the platform input tuple in its type', () => {
    expectTypeOf<
      Parameters<AdapterContextFactory<[Request, { trustProxy: boolean }?]>>
    >().toEqualTypeOf<[Request, { trustProxy: boolean }?]>();
  });
});
