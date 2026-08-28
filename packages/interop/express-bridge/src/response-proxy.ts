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

  // Bucket-1 stable closures, created ONCE per request. Reading an overlay
  // property returns a pre-allocated closure (or an inline value) instead of
  // allocating a fresh closure + a `{found, value}` wrapper on every access.
  const holder: { value: unknown } = { value: undefined };

  function resolveWriteHead(): unknown {
    const own = target.writeHead;
    if (typeof own === 'function' && own !== origWriteHead && own !== assertWriteHead) {
      return own;
    }
    return assertWriteHead;
  }

  const resStatus = (code: number): unknown => {
    ctx.status = code;
    return holder.value;
  };
  const resSetHeader = (field: string, value: unknown): unknown => {
    ctx.set(field, value as string | number | string[]);
    return holder.value;
  };
  const resGetHeader = (field: string): unknown =>
    typeof rawRes.getHeader === 'function' ? rawRes.getHeader(field) : ctx.get(field);
  const resRemoveHeader = (field: string): unknown => {
    rawRes.removeHeader?.(field);
    return holder.value;
  };
  const resSend = (body: ResponseBody): unknown => {
    ctx.send(body);
    onTerminal();
    return holder.value;
  };
  const resJson = (body: unknown): unknown => {
    ctx.json(body);
    onTerminal();
    return holder.value;
  };
  const resEnd = (...args: unknown[]): unknown => {
    const result = (rawRes.end as (...a: unknown[]) => unknown).apply(rawRes, args);
    onTerminal();
    return result;
  };
  const resRedirect = (a: unknown, b?: unknown): unknown => {
    // Three Express overloads: (status, url) | (url, status?) | (url).
    if (typeof a === 'number') {
      ctx.redirect(String(b), a);
    } else {
      ctx.redirect(String(a), typeof b === 'number' ? b : undefined);
    }
    onTerminal();
    return holder.value;
  };
  const resCookie = (name: string, value: string, options?: ExpressCookieOptions): unknown => {
    ctx.set('Set-Cookie', serializeCookie(name, value, options));
    return holder.value;
  };

  holder.value = new Proxy(target, {
    get(_t, key: string | symbol, receiver) {
      switch (key) {
        case 'status':
          return resStatus;
        case 'statusCode':
          return ctx.status;
        case 'set':
        case 'setHeader':
          return resSetHeader;
        case 'get':
        case 'getHeader':
          return resGetHeader;
        case 'removeHeader':
          return resRemoveHeader;
        case 'send':
          return resSend;
        case 'json':
          return resJson;
        case 'end':
          return resEnd;
        case 'redirect':
          return resRedirect;
        case 'cookie':
          return resCookie;
        case 'headersSent':
          return rawRes.headersSent === true;
        case 'locals':
          return locals;
        case 'writeHead':
          return resolveWriteHead();
        default:
          break;
      }

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

      switch (key) {
        case 'statusCode':
          ctx.status = Number(value);
          return true;
        case 'writeHead':
          // `on-headers` assigns its own wrap; pass through to the real target.
          return Reflect.set(target, key, value);
        default:
          break;
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
      switch (key) {
        case 'statusCode':
          ctx.status = Number(desc.value);
          return true;
        case 'writeHead':
          return Reflect.set(target, key, desc.value);
        default:
          break;
      }
      return Reflect.defineProperty(target, key, desc);
    },
  });

  return holder.value;
}
