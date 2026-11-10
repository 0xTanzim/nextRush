import { describe, expect, expectTypeOf, it } from 'vitest';
import type { UniversalFetchHandler } from '../adapter';

describe('Adversarial UniversalFetchHandler Strict Type Assignability', () => {
  // Realistic runtime host interfaces
  interface CloudflareWorkersExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }

  interface CloudflareEnv {
    readonly KV: Record<string, unknown>;
    readonly D1_DB: { query(sql: string): Promise<unknown> };
    readonly API_KEY: string;
  }

  interface BunServer {
    readonly port: number;
    readonly hostname: string;
    requestIP(req: Request): { address: string; port: number; family: string } | null;
    upgrade(req: Request, options?: unknown): boolean;
  }

  interface DenoServeHandlerInfo {
    readonly remoteAddr: {
      readonly transport: 'tcp' | 'udp';
      readonly hostname: string;
      readonly port: number;
    };
    readonly completed: Promise<void>;
  }

  interface VercelEdgeExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
  }

  describe('Runtime Host Direct Export Assignability', () => {
    it('assigns cleanly to Cloudflare Workers module export interface', () => {
      interface CloudflareWorkerModule {
        fetch: (
          request: Request,
          env: CloudflareEnv,
          ctx: CloudflareWorkersExecutionContext
        ) => Response | Promise<Response>;
      }

      const universalHandler: UniversalFetchHandler = (
        _req: Request,
        _envOrServer?: unknown,
        _ctx?: unknown
      ) => new Response('cf-worker');

      const worker: CloudflareWorkerModule = {
        fetch: universalHandler,
      };

      expect(typeof worker.fetch).toBe('function');
      const res = worker.fetch(
        new Request('http://localhost/cf'),
        { KV: {}, D1_DB: { query: async () => [] }, API_KEY: 'secret' },
        { waitUntil() {}, passThroughOnException() {} }
      );
      expect(res).toBeInstanceOf(Response);
    });

    it('assigns cleanly to Bun.serve options interface', () => {
      interface BunServeOptions {
        port?: number;
        fetch: (request: Request, server: BunServer) => Response | Promise<Response>;
      }

      const universalHandler: UniversalFetchHandler = (
        _req: Request,
        _envOrServer?: unknown
      ) => new Response('bun-worker');

      const options: BunServeOptions = {
        port: 3000,
        fetch: universalHandler,
      };

      expect(options.port).toBe(3000);
      const mockServer: BunServer = {
        port: 3000,
        hostname: 'localhost',
        requestIP: () => ({ address: '127.0.0.1', port: 54321, family: 'IPv4' }),
        upgrade: () => false,
      };
      const res = options.fetch(new Request('http://localhost/bun'), mockServer);
      expect(res).toBeInstanceOf(Response);
    });

    it('assigns cleanly to Deno.serve handler interface', () => {
      type DenoServeHandler = (
        request: Request,
        info: DenoServeHandlerInfo
      ) => Response | Promise<Response>;

      const universalHandler: UniversalFetchHandler = (
        _req: Request,
        _envOrServer?: unknown
      ) => new Response('deno-worker');

      const handler: DenoServeHandler = universalHandler;

      const mockInfo: DenoServeHandlerInfo = {
        remoteAddr: { transport: 'tcp', hostname: '10.0.0.1', port: 8080 },
        completed: Promise.resolve(),
      };
      const res = handler(new Request('http://localhost/deno'), mockInfo);
      expect(res).toBeInstanceOf(Response);
    });

    it('assigns cleanly to Vercel Edge handler interface', () => {
      type VercelEdgeHandler = (
        request: Request,
        ctx: VercelEdgeExecutionContext
      ) => Response | Promise<Response>;

      const universalHandler: UniversalFetchHandler = (
        _req: Request,
        _ctx?: unknown
      ) => new Response('vercel-worker');

      const handler: VercelEdgeHandler = universalHandler;
      const res = handler(new Request('http://localhost/vercel'), { waitUntil() {} });
      expect(res).toBeInstanceOf(Response);
    });

    it('assigns cleanly to 1-argument standard fetch runner', () => {
      type Standard1ArgHandler = (request: Request) => Response | Promise<Response>;

      const universalHandler: UniversalFetchHandler = (
        _req: Request
      ) => new Response('standard-worker');

      const handler: Standard1ArgHandler = universalHandler;
      const res = handler(new Request('http://localhost/standard'));
      expect(res).toBeInstanceOf(Response);
    });
  });

  describe('Return Type Covariance & Synchronization', () => {
    it('accepts synchronous pure Response handlers without Promise allocation', () => {
      const syncOnly: UniversalFetchHandler = (_req: Request): Response => {
        return new Response('sync-only');
      };

      const res = syncOnly(new Request('http://localhost/'));
      expect(res).toBeInstanceOf(Response);
      expect(res instanceof Promise).toBe(false);
      expect(typeof (res as Promise<Response>).then).toBe('undefined');
    });

    it('accepts asynchronous handlers returning Promise<Response>', async () => {
      const asyncOnly: UniversalFetchHandler = async (_req: Request): Promise<Response> => {
        await Promise.resolve();
        return new Response('async-only');
      };

      const resPromise = asyncOnly(new Request('http://localhost/'));
      expect(resPromise instanceof Promise).toBe(true);
      expect(typeof (resPromise as Promise<Response>).then).toBe('function');
      const res = await resPromise;
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('async-only');
    });

    it('preserves exact type narrowing on expectTypeOf', () => {
      expectTypeOf<UniversalFetchHandler>().toBeFunction();
      expectTypeOf<UniversalFetchHandler>().parameters.toEqualTypeOf<
        [request: Request, envOrServerOrInfoOrCtx?: unknown, executionCtx?: unknown]
      >();
      expectTypeOf<UniversalFetchHandler>().returns.toEqualTypeOf<Response | Promise<Response>>();
    });
  });

  describe('Compile-time Negative Rejections (Contract Guardrails)', () => {
    it('rejects handlers returning non-Response primitive types', () => {
      // @ts-expect-error - number is not assignable to Response | Promise<Response>
      const badNumber: UniversalFetchHandler = (_req: Request) => 42;
      expect(typeof badNumber).toBe('function');

      // @ts-expect-error - string is not assignable to Response | Promise<Response>
      const badString: UniversalFetchHandler = (_req: Request) => 'ok';
      expect(typeof badString).toBe('function');

      // @ts-expect-error - null is not assignable to Response | Promise<Response>
      const badNull: UniversalFetchHandler = (_req: Request) => null;
      expect(typeof badNull).toBe('function');

      // @ts-expect-error - undefined is not assignable to Response | Promise<Response>
      const badUndefined: UniversalFetchHandler = (_req: Request) => undefined;
      expect(typeof badUndefined).toBe('function');

      // @ts-expect-error - void is not assignable to Response | Promise<Response>
      const badVoid: UniversalFetchHandler = (_req: Request): void => {};
      expect(typeof badVoid).toBe('function');

      // @ts-expect-error - Promise<void> is not assignable to Response | Promise<Response>
      const badPromiseVoid: UniversalFetchHandler = async (_req: Request): Promise<void> => {};
      expect(typeof badPromiseVoid).toBe('function');

      expectTypeOf<(_req: Request) => number>().not.toMatchTypeOf<UniversalFetchHandler>();
      expectTypeOf<(_req: Request) => string>().not.toMatchTypeOf<UniversalFetchHandler>();
      expectTypeOf<(_req: Request) => null>().not.toMatchTypeOf<UniversalFetchHandler>();
      expectTypeOf<(_req: Request) => undefined>().not.toMatchTypeOf<UniversalFetchHandler>();
      expectTypeOf<(_req: Request) => void>().not.toMatchTypeOf<UniversalFetchHandler>();
      expectTypeOf<(_req: Request) => Promise<void>>().not.toMatchTypeOf<UniversalFetchHandler>();
    });

    it('rejects handlers with incompatible first parameter', () => {
      // @ts-expect-error - First parameter must accept Request, but requires non-existent property
      const badParam: UniversalFetchHandler = (_req: { nonExistentPropertyOnRequest: number }) =>
        new Response('ok');
      expect(typeof badParam).toBe('function');
      expectTypeOf<
        (_req: { nonExistentPropertyOnRequest: number }) => Response
      >().not.toMatchTypeOf<UniversalFetchHandler>();
    });

    it('rejects handlers requiring more than 3 parameters', () => {
      // @ts-expect-error - 4 parameters exceeds maximum allowed arity
      const badArity: UniversalFetchHandler = (_req: Request, _b: unknown, _c: unknown, _d: unknown) =>
        new Response('ok');
      expect(typeof badArity).toBe('function');
      expect(badArity.length).toBe(4);
      expectTypeOf<
        (_req: Request, _b: unknown, _c: unknown, _d: unknown) => Response
      >().not.toMatchTypeOf<UniversalFetchHandler>();
    });
  });
});
