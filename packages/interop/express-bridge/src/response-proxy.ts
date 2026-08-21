/**
 * @nextrush/express-bridge - Response proxy
 *
 * A per-request `Proxy` over the real `ServerResponse`. Implements the same
 * four-bucket algorithm as the request proxy, plus the captured-`origWriteHead`
 * header-safety wrap that avoids `on-headers` recursion.
 *
 * @packageDocumentation
 */

import type { Context, ResponseBody } from '@nextrush/types';
import { assertHeaderSafe } from '@nextrush/runtime';
import { UnsupportedExpressApiError } from './errors';
import { serializeCookie, type ExpressCookieOptions } from './cookie-serialize';
import { isUnsupportedResponseApi, RESPONSE_OVERLAY } from './surface';
import { isSafeStateKey, projectState } from './state';

interface NodeRes {
  statusCode?: number;
  setHeader?: (name: string, value: unknown) => void;
  getHeader?: (name: string) => unknown;
  removeHeader?: (name: string) => void;
  end?: (...args: unknown[]) => unknown;
  write?: (...args: unknown[]) => boolean;
  writeHead?: (...args: unknown[]) => unknown;
  headersSent?: boolean;
  [key: string]: unknown;
}

interface ResponseProxyDeps {
  ctx: Context;
  rawRes: NodeRes;
  /** Notified when the response becomes terminal (marks continuation terminated). */
  onTerminal: () => void;
}

/**
 * Build the captured-`origWriteHead` header-safety wrap.
 *
 * At proxy creation we capture `origWriteHead = target.writeHead` (bound to the
 * real response); the assert-wrap never looks up the current `target.writeHead`
 * at call time — that is what recurses once `on-headers` assigns an own
 * `writeHead`. Node's `writeHead(status, message?, headers?)` overloads are
 * parsed only to validate header values; the original arguments are forwarded
 * unchanged.
 */
function buildWriteHeadWrap(origWriteHead: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown {
  return function writeHeadWrap(this: unknown, ...args: unknown[]): unknown {
    const maybeHeaders = typeof args[1] === 'object' && args[1] !== null
      ? (args[1] as Record<string, unknown>)
      : (args[2] as Record<string, unknown> | undefined) ?? {};

    for (const [name, value] of Object.entries(maybeHeaders)) {
      if (value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) {
        assertHeaderSafe(name, value as string | number | string[]);
      }
    }

    return origWriteHead.apply(this, args);
  };
}

/**
 * Create the Express-like response adapter for one request.
 */
export function createResponseProxy(deps: ResponseProxyDeps): unknown {
  const { ctx, rawRes, onTerminal } = deps;
  const target = rawRes as Record<string | symbol, unknown>;

  // Capture the prototype method UNBOUND; the assert-wrap applies it with the
  // caller's `this` at call time (D2). Binding here would break the
  // `own !== origWriteHead` identity check in `resolveWriteHead`.
  const origWriteHead = typeof rawRes.writeHead === 'function'
    ? rawRes.writeHead
    : function writeHeadFallback(..._args: unknown[]): unknown {
        return undefined;
      };
  const assertWriteHead = buildWriteHeadWrap(origWriteHead);

  // Per-request, null-prototype locals (Express `res.locals`), not `ctx.state`.
  const locals = Object.create(null) as Record<string, unknown>;

  function resolveWriteHead(): unknown {
    const own = target.writeHead;
    if (typeof own === 'function' && own !== origWriteHead && own !== assertWriteHead) {
      return own;
    }
    return assertWriteHead;
  }

  function overlayGet(key: string | symbol): { found: boolean; value?: unknown } {
    switch (key) {
      case 'status':
        return {
          found: true,
          value: (code: number): unknown => {
            ctx.status = code;
            return holder.value;
          },
        };
      case 'statusCode':
        return { found: true, value: ctx.status };
      case 'set':
      case 'setHeader':
        return {
          found: true,
          value: (field: string, value: unknown): unknown => {
            ctx.set(field, value as string | number | string[]);
            return holder.value;
          },
        };
      case 'get':
      case 'getHeader':
        return {
          found: true,
          value: (field: string): unknown =>
            typeof rawRes.getHeader === 'function' ? rawRes.getHeader(field) : ctx.get(field),
        };
      case 'removeHeader':
        return {
          found: true,
          value: (field: string): unknown => {
            rawRes.removeHeader?.(field);
            return holder.value;
          },
        };
      case 'send':
        return {
          found: true,
          value: (body: ResponseBody): unknown => {
            ctx.send(body);
            onTerminal();
            return holder.value;
          },
        };
      case 'json':
        return {
          found: true,
          value: (body: unknown): unknown => {
            ctx.json(body);
            onTerminal();
            return holder.value;
          },
        };
      case 'end':
        return {
          found: true,
          value: (...args: unknown[]): unknown => {
            const result = (rawRes.end as (...a: unknown[]) => unknown).apply(rawRes, args);
            onTerminal();
            return result;
          },
        };
      case 'redirect':
        return {
          found: true,
          value: (a: unknown, b?: unknown): unknown => {
            // Three Express overloads: (status, url) | (url, status?) | (url).
            if (typeof a === 'number') {
              ctx.redirect(String(b), a);
            } else {
              ctx.redirect(String(a), typeof b === 'number' ? b : undefined);
            }
            onTerminal();
            return holder.value;
          },
        };
      case 'cookie':
        return {
          found: true,
          value: (name: string, value: string, options?: ExpressCookieOptions): unknown => {
            ctx.set('Set-Cookie', serializeCookie(name, value, options));
            return holder.value;
          },
        };
      case 'headersSent':
        return { found: true, value: rawRes.headersSent === true };
      case 'locals':
        return { found: true, value: locals };
      case 'writeHead':
        return { found: true, value: resolveWriteHead() };
      default:
        return { found: false };
    }
  }

  function overlaySet(key: string | symbol, value: unknown): boolean {
    if (key === 'statusCode') {
      ctx.status = Number(value);
      return true;
    }
    if (key === 'writeHead') {
      // `on-headers` assigns its own wrap; pass through to the real target.
      return Reflect.set(target, key, value);
    }
    return false;
  }

  const holder: { value: unknown } = { value: undefined };
  holder.value = new Proxy(target, {
    get(_t, key: string | symbol, receiver) {
      const ov = overlayGet(key);
      if (ov.found) return ov.value;

      if (isUnsupportedResponseApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }

      if (Reflect.has(target, key)) {
        return Reflect.get(target, key, receiver);
      }

      return undefined;
    },

    set(_t, key: string | symbol, value: unknown, receiver): boolean {
      if (!isSafeStateKey(key)) {
        return true;
      }

      if (overlaySet(key, value)) {
        return true;
      }

      if (isUnsupportedResponseApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }

      if (Reflect.has(target, key)) {
        return Reflect.set(target, key, value, receiver);
      }

      projectState(ctx, key, value);
      return true;
    },

    has(_t, key: string | symbol): boolean {
      if (RESPONSE_OVERLAY.has(key)) return true;
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
      if (isUnsupportedResponseApi(key)) {
        throw new UnsupportedExpressApiError(String(key));
      }
      if (overlaySet(key, desc.value)) {
        return true;
      }
      return Reflect.defineProperty(target, key, desc);
    },
  });

  return holder.value;
}
