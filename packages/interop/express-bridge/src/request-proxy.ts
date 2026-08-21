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

  function overlayGet(key: string | symbol): { found: boolean; value?: unknown } {
    switch (key) {
      case 'method':
        return { found: true, value: ctx.method };
      case 'url':
        return { found: true, value: ctx.url };
      case 'originalUrl':
        return { found: true, value: ctx.url };
      case 'path':
        return { found: true, value: ctx.path };
      case 'query':
        return { found: true, value: ctx.query };
      case 'params':
        return { found: true, value: ctx.params };
      case 'headers':
        return { found: true, value: ctx.headers };
      case 'body':
        return { found: true, value: ctx.body };
      case 'ip':
        return { found: true, value: ctx.ip };
      case 'protocol':
        return { found: true, value: protocol(rawReq) };
      case 'secure':
        return { found: true, value: protocol(rawReq) === 'https' };
      case 'hostname':
        return { found: true, value: hostname(ctx) };
      case 'cookies':
        return { found: true, value: readState(ctx, 'cookies') };
      case 'get':
        return {
          found: true,
          value: (field: string): string | undefined => ctx.get(field),
        };
      default:
        return { found: false };
    }
  }

  function overlaySet(key: string | symbol, value: unknown): boolean {
    switch (key) {
      case 'body':
        ctx.body = value;
        return true;
      case 'cookies':
        return projectState(ctx, key, value);
      default:
        return false;
    }
  }

  return new Proxy(target, {
    get(_t, key: string | symbol, receiver) {
      const ov = overlayGet(key);
      if (ov.found) return ov.value;

      if (isUnsupportedRequestApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }

      if (Reflect.has(target, key)) {
        const value = Reflect.get(target, key, receiver);
        return value;
      }

      return readState(ctx, key);
    },

    set(_t, key: string | symbol, value: unknown, receiver): boolean {
      if (!isSafeStateKey(key)) {
        return true;
      }

      if (overlaySet(key, value)) {
        return true;
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
      if (overlaySet(key, desc.value)) {
        return true;
      }
      return Reflect.defineProperty(target, key, desc);
    },
  });
}
