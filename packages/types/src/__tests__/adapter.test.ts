/**
 * @nextrush/types - Adapter conformance contract tests (F-01)
 *
 * These tests pin the *shape* of the light adapter contract that every adapter
 * `satisfies` at export time. They are both runtime assertions (that concrete
 * implementations wire up) and compile-time assertions (that the contract is
 * satisfiable and generic over the concrete application type).
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
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
