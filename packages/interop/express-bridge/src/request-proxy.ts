/**
 * @nextrush/express-bridge - Request proxy
 *
 * A per-request `Proxy` over the real `IncomingMessage`. Implements the
 * four-bucket get/set algorithm: Express overlay / known-unsupported Express /
 * Node pass-through / ad-hoc `ctx.state`. The target is the real object, so
 * streams, `on`, `pipe`, `socket`, and `===` identity keep working.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import { UnsupportedExpressApiError } from './errors';
import { isUnsupportedRequestApi, REQUEST_OVERLAY } from './surface';
import { isSafeStateKey, projectState, readState } from './state';

interface NodeReq {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  socket?: { encrypted?: boolean; remoteAddress?: string };
  on?: unknown;
  [key: string]: unknown;
}

function hostname(ctx: Context): string | undefined {
  const host = ctx.get('Host');
  if (host === undefined) return undefined;
  return host.replace(/:\d+$/, '');
}

function protocol(req: NodeReq): 'http' | 'https' {
  return req.socket?.encrypted === true ? 'https' : 'http';
}

/**
 * Create the Express-like request adapter for one request.
 */
export function createRequestProxy(ctx: Context, rawReq: NodeReq): unknown {
  const target = rawReq as Record<string | symbol, unknown>;

  // Bucket-1 stable closure, created ONCE per request. Dynamic value reads
  // (method/url/path/query/...) are answered inline in the get trap — no
  // per-access closure or `{found, value}` wrapper allocation.
  const reqGet = (field: string): string | undefined => ctx.get(field);

  return new Proxy(target, {
    get(_t, key: string | symbol, receiver) {
      switch (key) {
        case 'method':
          return ctx.method;
        case 'url':
        case 'originalUrl':
          return ctx.url;
        case 'path':
          return ctx.path;
        case 'query':
          return ctx.query;
        case 'params':
          return ctx.params;
        case 'headers':
          return ctx.headers;
        case 'body':
          return ctx.body;
        case 'ip':
          return ctx.ip;
        case 'protocol':
          return protocol(rawReq);
        case 'secure':
          return protocol(rawReq) === 'https';
        case 'hostname':
          return hostname(ctx);
        case 'cookies':
          return readState(ctx, 'cookies');
        case 'get':
          return reqGet;
        default:
          break;
      }

      if (isUnsupportedRequestApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }

      if (Reflect.has(target, key)) {
        return Reflect.get(target, key, receiver);
      }

      return readState(ctx, key);
    },

    set(_t, key: string | symbol, value: unknown, receiver): boolean {
      if (!isSafeStateKey(key)) {
        return true;
      }

      switch (key) {
        case 'body':
          ctx.body = value;
          return true;
        case 'cookies':
          return projectState(ctx, key, value);
        default:
          break;
      }

      if (isUnsupportedRequestApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }

      if (Reflect.has(target, key)) {
        return Reflect.set(target, key, value, receiver);
      }

      projectState(ctx, key, value);
      return true;
    },

    has(_t, key: string | symbol): boolean {
      if (REQUEST_OVERLAY.has(key)) return true;
      if (Reflect.has(target, key)) return true;
      return isSafeStateKey(key) && key in (ctx.state as Record<string | symbol, unknown>);
    },

    ownKeys(_t): (string | symbol)[] {
      return Reflect.ownKeys(target);
    },

    getPrototypeOf(_t): object | null {
      return Object.getPrototypeOf(target) as object | null;
    },

    setPrototypeOf(): boolean {
      return false;
    },

    defineProperty(_t, key: string | symbol, desc: PropertyDescriptor): boolean {
      if (!isSafeStateKey(key)) {
        return false;
      }
      if (isUnsupportedRequestApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }
      switch (key) {
        case 'body':
          ctx.body = desc.value;
          return true;
        case 'cookies':
          return projectState(ctx, key, desc.value);
        default:
          break;
      }
      return Reflect.defineProperty(target, key, desc);
    },
  });
}
