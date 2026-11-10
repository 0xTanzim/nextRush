/**
 * @nextrush/adapter-serverless - Vercel Serverless (Tier 1 handler).
 *
 * Provides universal execution for Vercel:
 * - Vercel Node.js Serverless runtime (Fluid Compute) via (req, res)
 * - Vercel Web Standard Fetch API via (request: Request)
 * - Vercel Route Handlers via method exports (GET, POST, etc.)
 * - Standalone local dev runner (listenIfStandalone)
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createFetchHandler as createEdgeFetchHandler, type EdgeExecutionContext } from '@nextrush/adapter-edge';
import type { VercelIncomingMessageLike, VercelServerResponseLike } from './platform-shapes';
import type {
  AppSource,
  VercelHandler,
  VercelHandlerOptions,
  VercelListenOptions,
  VercelRouteHandlers,
  VercelWebHandler,
} from './types';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Bridge a Node.js / Vercel Serverless HTTP request into a standard Web Request.
 */
export function toVercelWebRequest(req: VercelIncomingMessageLike): Request {
  const method = (req.method ?? 'GET').toUpperCase();
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const proto = firstHeaderValue(req.headers['x-forwarded-proto']) ?? 'https';
  const host =
    firstHeaderValue(req.headers['x-forwarded-host']) ??
    firstHeaderValue(req.headers.host) ??
    'localhost';
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, `${proto}://${host}`);

  const isBodiless = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;

  if (!isBodiless) {
    if (typeof req.rawBody === 'string' || req.rawBody instanceof Uint8Array) {
      body = req.rawBody as BodyInit;
    } else if (typeof req.body === 'string' || req.body instanceof Uint8Array) {
      body = req.body as BodyInit;
    } else if (typeof (req as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
      const fromFn = (ReadableStream as unknown as { from?: (it: unknown) => ReadableStream }).from;
      if (typeof fromFn === 'function') {
        body = fromFn(req) as unknown as BodyInit;
      }
    }
  }

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body, duplex: 'half' } as RequestInit : {}),
    ...(req.signal !== undefined ? { signal: req.signal } : {}),
  };

  return new Request(url.href, init);
}

/**
 * Stream a standard Web Response into a Node.js / Vercel ServerResponse.
 * Handles chunked streaming, backpressure via 'drain', and client disconnection via 'close'.
 */
export async function writeVercelWebResponse(
  res: VercelServerResponseLike,
  response: Response
): Promise<void> {
  try {
    res.statusCode = response.status;
    if (response.statusText) {
      res.statusMessage = response.statusText;
    }

    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') continue;
      res.setHeader(key, value);
    }

    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }

    if (response.body) {
      const reader = response.body.getReader();

      const onClose = (): void => {
        reader.cancel().catch(() => undefined);
      };

      res.once?.('close', onClose);

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const canContinue = res.write(value) !== false;
          if (!canContinue && typeof res.once === 'function') {
            await new Promise<void>((resolve) => {
              res.once?.('drain', () => {
                resolve();
              });
            });
          }
        }
      } finally {
        reader.releaseLock();
        if (!res.writableEnded) {
          res.end();
        }
      }
    } else {
      res.end();
    }
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
}

/**
 * Determine whether the current process is running inside a serverless / managed cloud environment.
 */
export function isServerlessEnvironment(): boolean {
  if (typeof process === 'undefined') return false;
  const env = process.env;
  return Boolean(
    env.VERCEL ??
      env.VERCEL_ENV ??
      env.NOW_REGION ??
      env.AWS_LAMBDA_FUNCTION_NAME ??
      env.LAMBDA_TASK_ROOT ??
      env.K_SERVICE ??
      env.FUNCTION_TARGET ??
      env.FUNCTIONS_WORKER_RUNTIME
  );
}

/**
 * Determine whether the current process is running in standalone mode (local dev, CLI, Docker).
 */
export function isStandaloneEnvironment(): boolean {
  return !isServerlessEnvironment();
}

/**
 * Start a local HTTP server when running standalone (local dev / Docker),
 * and automatically no-op when running inside a serverless platform.
 */
export async function listenIfStandalone(
  appOrHandler: AppSource<Application> | VercelHandler,
  options: VercelListenOptions = {}
): Promise<unknown> {
  if (isServerlessEnvironment()) {
    return undefined;
  }

  const handler =
    typeof appOrHandler === 'function' && 'fetch' in appOrHandler
      ? (appOrHandler as VercelHandler)
      : createVercelHandler(appOrHandler as AppSource<Application>);

  const envPort = typeof process !== 'undefined' ? process.env.PORT : undefined;
  const port =
    options.port ?? (envPort ? parseInt(envPort, 10) : 3000);
  const host = options.host ?? '0.0.0.0';

  // Bun runtime
  if (typeof (globalThis as unknown as { Bun?: { serve: (opts: unknown) => unknown } }).Bun !== 'undefined') {
    const bun = (globalThis as unknown as { Bun: { serve: (opts: unknown) => unknown } }).Bun;
    const server = bun.serve({
      port,
      hostname: host,
      fetch: handler.fetch,
    });
    options.onListen?.({ port, host });
    return server;
  }

  // Deno runtime
  if (typeof (globalThis as unknown as { Deno?: { serve: (opts: unknown, h: unknown) => unknown } }).Deno?.serve === 'function') {
    const deno = (globalThis as unknown as { Deno: { serve: (opts: unknown, h: unknown) => unknown } }).Deno;
    return deno.serve(
      {
        port,
        hostname: host,
        onListen: () => options.onListen?.({ port, host }),
      },
      handler.fetch
    );
  }

  // Node runtime (default fallback)
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      options.onListen?.({ port, host });
      resolve(server);
    });
  });
}

function isNodeInvocation(
  _arg1: unknown,
  arg2: unknown
): arg2 is VercelServerResponseLike {
  return (
    typeof arg2 === 'object' &&
    arg2 !== null &&
    typeof (arg2 as VercelServerResponseLike).setHeader === 'function' &&
    typeof (arg2 as VercelServerResponseLike).end === 'function'
  );
}

/**
 * Create a universal Vercel handler for a NextRush app.
 *
 * Supports:
 * - Vercel Node.js Serverless runtime (Fluid Compute) via `(req, res)`
 * - Web Standard Fetch API via `(request: Request)`
 * - Named route handler exports (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`)
 * - Standalone local dev runner (`listenIfStandalone`)
 *
 * @param app - The NextRush application instance.
 * @param options - Tuning options (timeout, onError, proxy, platform).
 * @returns A universal callable handler set.
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createVercelHandler } from '@nextrush/adapter-serverless';
 *
 * const app = createApp();
 * app.get('/api/health', (ctx) => ctx.json({ status: 'ok' }));
 *
 * const handler = createVercelHandler(app);
 *
 * export default handler;
 * export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } = handler;
 * export { handler as fetch };
 *
 * handler.listenIfStandalone({ port: 3000 });
 * ```
 */
export function createVercelHandler(
  appSource: AppSource<Application>,
  options: VercelHandlerOptions = {}
): VercelHandler {
  const engine = createEdgeFetchHandler(appSource, {
    platform: options.platform ?? 'vercel',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.onError !== undefined ? { onError: options.onError } : {}),
  });

  const dispatch = async (
    arg1: Request | VercelIncomingMessageLike,
    arg2?: unknown
  ): Promise<Response | undefined> => {
    if (isNodeInvocation(arg1, arg2)) {
      const webReq = toVercelWebRequest(arg1 as VercelIncomingMessageLike);
      const trackedTasks: Promise<unknown>[] = [];
      const executionContext: EdgeExecutionContext = {
        waitUntil(promise: Promise<unknown>): void {
          trackedTasks.push(promise);
        },
      };

      const webRes = await engine(webReq, executionContext);
      await writeVercelWebResponse(arg2, webRes);

      if (trackedTasks.length > 0) {
        // 1. Check native Vercel / Next.js request context if available
        const globalContext =
          (globalThis as unknown as { [k: symbol]: { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } })[
            Symbol.for('@vercel/request-context')
          ]?.get?.() ??
          (globalThis as unknown as { [k: symbol]: { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } })[
            Symbol.for('@next/request-context')
          ]?.get?.();

        if (globalContext && typeof globalContext.waitUntil === 'function') {
          for (const task of trackedTasks) {
            globalContext.waitUntil(task);
          }
        } else {
          // 2. Settle tasks before container freeze
          await Promise.race([
            Promise.allSettled(trackedTasks),
            new Promise((resolve) => setTimeout(resolve, options.waitUntilTimeout ?? 5000)),
          ]);
        }
      }
      return undefined;
    }
    return engine(arg1 as Request, arg2 as EdgeExecutionContext | undefined);
  };

  const universalHandler = ((
    arg1: Request | VercelIncomingMessageLike,
    arg2?: unknown
  ) => dispatch(arg1, arg2)) as VercelHandler;

  const webHandler: VercelWebHandler = async (request, ctx) =>
    engine(request, ctx as EdgeExecutionContext | undefined);

  const routeHandlers: VercelRouteHandlers = {
    GET: webHandler,
    POST: webHandler,
    PUT: webHandler,
    PATCH: webHandler,
    DELETE: webHandler,
    HEAD: webHandler,
    OPTIONS: webHandler,
  };

  Object.assign(universalHandler, routeHandlers);
  (universalHandler as unknown as { fetch: VercelWebHandler }).fetch = webHandler;
  (universalHandler as unknown as { listenIfStandalone: (opts?: VercelListenOptions) => Promise<unknown> }).listenIfStandalone = (
    opts?: VercelListenOptions
  ) => listenIfStandalone(universalHandler, opts);

  return universalHandler;
}
