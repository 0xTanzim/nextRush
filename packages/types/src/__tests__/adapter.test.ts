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
  UniversalFetchHandler,
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
    expect(typeof bad.serve).toBe('function');
    expectTypeOf<{ serve: (_app: unknown) => Promise<unknown> }>().not.toMatchTypeOf<ServerAdapter>();
  });

  it('rejects an adapter whose serve does not return a ServerHandle', () => {
    // prettier-ignore
    // @ts-expect-error - serve must resolve to a ServerHandle, not a bare object
    const bad: ServerAdapter = { serve: (_app: unknown) => Promise.resolve({ nope: true }), createHandler: (_app: unknown) => () => undefined };
    expect(typeof bad.serve).toBe('function');
    expect(typeof bad.createHandler).toBe('function');
  });
});

describe('FetchAdapter — negative (contract is enforced)', () => {
  it('rejects a fetch adapter whose handler does not return a Response', () => {
    // prettier-ignore
    // @ts-expect-error - createFetchHandler must return a FetchHandler producing a Response
    const bad: FetchAdapter = { createFetchHandler: (_app: unknown) => (_req: Request): string => 'not a response' };
    expect(typeof bad.createFetchHandler).toBe('function');
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

describe('UniversalFetchHandler', () => {
  it('is satisfiable by a 1-argument fetch handler', async () => {
    const handler: UniversalFetchHandler = (_request: Request) => new Response('one-arg');
    const res = await handler(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('one-arg');
  });

  it('is satisfiable by a 2-argument fetch handler (Vercel Edge execution context)', async () => {
    interface VercelCtx {
      waitUntil(promise: Promise<unknown>): void;
    }
    const handler: UniversalFetchHandler = (
      _request: Request,
      _ctx?: unknown
    ) => new Response('vercel-edge');

    const mockCtx: VercelCtx = { waitUntil: () => undefined };
    const res = await handler(new Request('http://localhost/'), mockCtx);
    expect(await res.text()).toBe('vercel-edge');
  });

  it('is satisfiable by a 2-argument fetch handler (Bun server)', async () => {
    interface BunServer {
      requestIP(req: Request): { address: string } | null;
    }
    const handler: UniversalFetchHandler = (
      _request: Request,
      _server?: unknown
    ) => new Response('bun');

    const mockServer: BunServer = { requestIP: () => ({ address: '127.0.0.1' }) };
    const res = await handler(new Request('http://localhost/'), mockServer);
    expect(await res.text()).toBe('bun');
  });

  it('is satisfiable by a 2-argument fetch handler (Deno serve info)', async () => {
    interface DenoInfo {
      remoteAddr: { hostname: string };
    }
    const handler: UniversalFetchHandler = (
      _request: Request,
      _info?: unknown
    ) => new Response('deno');

    const mockInfo: DenoInfo = { remoteAddr: { hostname: '127.0.0.1' } };
    const res = await handler(new Request('http://localhost/'), mockInfo);
    expect(await res.text()).toBe('deno');
  });

  it('is satisfiable by a 3-argument fetch handler (Cloudflare Workers env + ctx)', async () => {
    interface CloudflareEnv {
      KV: unknown;
    }
    interface CloudflareCtx {
      waitUntil(promise: Promise<unknown>): void;
    }
    const handler: UniversalFetchHandler = (
      _request: Request,
      _env?: unknown,
      _ctx?: unknown
    ) => new Response('cloudflare');

    const mockEnv: CloudflareEnv = { KV: {} };
    const mockCtx: CloudflareCtx = { waitUntil: () => undefined };
    const res = await handler(new Request('http://localhost/'), mockEnv, mockCtx);
    expect(await res.text()).toBe('cloudflare');
  });

  it('supports synchronous bare Response returns without Promise wrap', () => {
    const handler: UniversalFetchHandler = (_request: Request) => new Response('sync-ok');
    const res = handler(new Request('http://localhost/'));
    expect(res).toBeInstanceOf(Response);
    expectTypeOf(res).toEqualTypeOf<Response | Promise<Response>>();
  });

  it('is assignable to runtime calling contracts across major platforms', () => {
    const universal: UniversalFetchHandler = (_req, _envOrServer, _ctx) => new Response('ok');

    // 1-arg calling convention (Node 22+, Deno, unit tests)
    const call1Arg: (req: Request) => Response | Promise<Response> = universal;
    expectTypeOf(call1Arg).toMatchTypeOf<UniversalFetchHandler>();

    // 2-arg Vercel Edge convention
    const callVercel: (req: Request, ctx: { waitUntil(p: Promise<unknown>): void }) => Response | Promise<Response> = universal;
    expectTypeOf(callVercel).toMatchTypeOf<(req: Request, ctx: { waitUntil(p: Promise<unknown>): void }) => Response | Promise<Response>>();

    // 2-arg Bun convention
    const callBun: (req: Request, server: { requestIP(r: Request): unknown }) => Response | Promise<Response> = universal;
    expectTypeOf(callBun).toMatchTypeOf<(req: Request, server: { requestIP(r: Request): unknown }) => Response | Promise<Response>>();

    // 2-arg Deno convention
    const callDeno: (req: Request, info: { remoteAddr: unknown }) => Response | Promise<Response> = universal;
    expectTypeOf(callDeno).toMatchTypeOf<(req: Request, info: { remoteAddr: unknown }) => Response | Promise<Response>>();

    // 3-arg Cloudflare Workers convention
    const callCF: (req: Request, env: { KV: unknown }, ctx: { waitUntil(p: Promise<unknown>): void }) => Response | Promise<Response> = universal;
    expectTypeOf(callCF).toMatchTypeOf<(req: Request, env: { KV: unknown }, ctx: { waitUntil(p: Promise<unknown>): void }) => Response | Promise<Response>>();
  });
});

describe('UniversalFetchHandler — negative (contract is enforced)', () => {
  it('rejects a handler returning a non-Response value', () => {
    // prettier-ignore
    // @ts-expect-error - UniversalFetchHandler must return Response | Promise<Response>
    const bad: UniversalFetchHandler = (_req: Request): string => 'invalid';
    expect(typeof bad).toBe('function');
    expect(bad(new Request('http://localhost/'))).toBe('invalid');
    expectTypeOf<(_req: Request) => string>().not.toMatchTypeOf<UniversalFetchHandler>();
    expectTypeOf<(_req: Request) => number>().not.toMatchTypeOf<UniversalFetchHandler>();
    expectTypeOf<(_req: Request) => Promise<string>>().not.toMatchTypeOf<UniversalFetchHandler>();
    expectTypeOf<(_req: Request) => void>().not.toMatchTypeOf<UniversalFetchHandler>();
  });

  it('rejects a handler requiring more than 3 parameters', () => {
    // prettier-ignore
    // @ts-expect-error - UniversalFetchHandler accepts at most 3 parameters
    const bad: UniversalFetchHandler = (_req: Request, _b: unknown, _c: unknown, _d: unknown) => new Response('bad');
    expect(typeof bad).toBe('function');
    expect(bad.length).toBe(4);
    expectTypeOf<(_req: Request, _b: unknown, _c: unknown, _d: unknown) => Response>().not.toMatchTypeOf<UniversalFetchHandler>();
    expectTypeOf<(_req: Request, _b: unknown, _c: unknown, _d: unknown) => Promise<Response>>().not.toMatchTypeOf<UniversalFetchHandler>();
  });
});

