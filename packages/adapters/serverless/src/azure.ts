/**
 * @nextrush/adapter-serverless - Azure Functions (Tier 1 handler).
 *
 * ```typescript
 * import { createAzureHandler } from '@nextrush/adapter-serverless';
 * import { app as functions } from '@azure/functions';
 *
 * functions.http('api', { handler: createAzureHandler(app) });
 * ```
 *
 * True drop-in (RFC-027): `createAzureHandler` accepts Azure Functions v4's
 * real `HttpRequest` and returns an `HttpResponseInit`-shaped result — no
 * user-written field mapping. Use {@link createAzureEventHandler} for the
 * struct-based path (fixture testing, custom bridges, non-standard hosts).
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createServerlessAdapter } from './adapter';
import { azure, type AzureEvent, type AzureResult } from './mappers/azure';
import { TEXT_CONTENT_TYPE, base64ToBytes, bytesToBase64 } from './mappers/_v2';
import type { AzureHttpRequestLike, AzureHttpResponseLike } from './platform-shapes';
import type { AppSource, ServerlessHandler, ServerlessHandlerOptions } from './types';

/**
 * Bridge an Azure Functions v4 request into an {@link AzureEvent}.
 *
 * @remarks
 * Pure and independently testable (RFC-027 §8.2). Reads the body via the v4
 * `arrayBuffer()` contract — always available, unlike GCF's optional
 * `rawBody` — so there is no lossy/parsed-body fallback path on this side.
 */
export async function toAzureEvent(req: AzureHttpRequestLike): Promise<AzureEvent> {
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of req.headers) headers[name] = value;

  const method = req.method;
  const bodilessMethod = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';

  let body: string | undefined;
  let isBase64Encoded = false;

  if (!bodilessMethod) {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > 0) {
      const contentType = headers['content-type'] ?? '';
      const isText = TEXT_CONTENT_TYPE.test(contentType);
      body = isText ? new TextDecoder().decode(bytes) : bytesToBase64(bytes);
      isBase64Encoded = !isText;
    }
  }

  return {
    method,
    url: req.url,
    headers,
    ...(body !== undefined ? { body, isBase64Encoded } : {}),
  };
}

/**
 * Parse a raw `Set-Cookie` line into Azure Functions v4 structured cookie object.
 *
 * @remarks
 * Preserves security attributes (`SameSite`, `Secure`, `HttpOnly`, `Path`, `Domain`, `Max-Age`, `Expires`)
 * so session and auth cookies retain their security guarantees on Azure Functions.
 */
function parseSetCookie(line: string): {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
} {
  const parts = line.split(';').map((p) => p.trim());
  const [first = '', ...attributes] = parts;
  const eqIdx = first.indexOf('=');
  const name = eqIdx === -1 ? first : first.slice(0, eqIdx).trim();
  const value = eqIdx === -1 ? '' : first.slice(eqIdx + 1).trim();

  const cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = { name, value };

  for (const attr of attributes) {
    const attrEq = attr.indexOf('=');
    const attrName = (attrEq === -1 ? attr : attr.slice(0, attrEq)).toLowerCase().trim();
    const attrVal = attrEq === -1 ? '' : attr.slice(attrEq + 1).trim();

    if (attrName === 'path') {
      cookie.path = attrVal;
    } else if (attrName === 'domain') {
      cookie.domain = attrVal;
    } else if (attrName === 'httponly') {
      cookie.httpOnly = true;
    } else if (attrName === 'secure') {
      cookie.secure = true;
    } else if (attrName === 'samesite') {
      const lower = attrVal.toLowerCase();
      if (lower === 'strict') cookie.sameSite = 'Strict';
      else if (lower === 'lax') cookie.sameSite = 'Lax';
      else if (lower === 'none') cookie.sameSite = 'None';
    } else if (attrName === 'max-age') {
      const parsed = parseInt(attrVal, 10);
      if (!Number.isNaN(parsed)) cookie.maxAge = parsed;
    } else if (attrName === 'expires') {
      const d = new Date(attrVal);
      if (!Number.isNaN(d.getTime())) cookie.expires = d;
    }
  }

  return cookie;
}

/**
 * Map an {@link AzureResult} into an Azure v4 `HttpResponseInit`-assignable
 * result.
 *
 * @remarks
 * Decodes a base64 result body back to bytes — the fix for the binary-
 * response corruption in the previous hand-written bridge (RFC-027 §3.2.2).
 */
export function toAzureResponse(result: AzureResult): AzureHttpResponseLike {
  return {
    status: result.status,
    headers: result.headers,
    ...(result.cookies !== undefined && result.cookies.length > 0
      ? { cookies: result.cookies.map(parseSetCookie) }
      : {}),
    body: result.isBase64Encoded ? base64ToBytes(result.body) : result.body,
  };
}

/**
 * Create an Azure Functions (v4) HTTP handler for a NextRush app — a true
 * drop-in for the v4 programming model's `HttpHandler` signature.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(req, ctx?) => Promise<HttpResponseInit-shaped>`.
 *
 * @see {@link createAzureEventHandler} for the struct-based path (fixture
 * testing, custom bridges, non-standard hosts).
 *
 * @example
 * ```typescript
 * functions.http('api', { handler: createAzureHandler(app) });
 * ```
 */
export function createAzureHandler(
  app: AppSource<Application>,
  options: ServerlessHandlerOptions = {}
): (req: AzureHttpRequestLike, ctx?: unknown) => Promise<AzureHttpResponseLike> {
  const eventHandler = createAzureEventHandler(app, options);
  return async (req: AzureHttpRequestLike): Promise<AzureHttpResponseLike> => {
    const event = await toAzureEvent(req);
    const result = await eventHandler(event);
    return toAzureResponse(result);
  };
}

/**
 * Create an Azure Functions (v4) handler over the {@link AzureEvent} struct.
 *
 * @remarks
 * This is `createAzureHandler`'s pre-RFC-027 behavior, kept unchanged and
 * explicitly named — the honest answer for fixture tests, a custom bridge, or
 * a host whose request shape isn't v4-standard.
 *
 * @param app - The NextRush application instance, or an async factory producing one.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(event) => Promise<result>` over the Azure v4 request essentials.
 *
 * @see {@link createAzureHandler} for the true drop-in over the real v4 `HttpRequest`.
 */
export function createAzureEventHandler(
  app: AppSource<Application>,
  options: ServerlessHandlerOptions = {}
): ServerlessHandler<AzureEvent, AzureResult> {
  return createServerlessAdapter<AzureEvent, AzureResult>({
    mappers: [azure],
    provider: 'azure',
    platform: 'azure',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  }).createHandler(app);
}
