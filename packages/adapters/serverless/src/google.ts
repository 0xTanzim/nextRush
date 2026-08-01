/**
 * @nextrush/adapter-serverless - Google Cloud Functions (Tier 1 handler).
 *
 * ```typescript
 * import { createGoogleHandler } from '@nextrush/adapter-serverless';
 * import * as functions from '@google-cloud/functions-framework';
 *
 * functions.http('api', createGoogleHandler(app));
 * ```
 *
 * True drop-in (RFC-027): `createGoogleHandler` accepts functions-framework's
 * real `(req, res)` and writes the response itself — no user-written field
 * mapping. Use {@link createGoogleEventHandler} for the struct-based path
 * (fixture testing, custom bridges, non-standard hosts).
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createServerlessAdapter } from './adapter';
import { gcf, type GcfEvent, type GcfResult } from './mappers/gcf';
import { TEXT_CONTENT_TYPE, base64ToBytes, bytesToBase64 } from './mappers/_v2';
import type { GcfHttpRequest, GcfHttpResponse } from './platform-shapes';
import type { ServerlessHandler, ServerlessHandlerOptions } from './types';

/**
 * Bridge a functions-framework request into a {@link GcfEvent}.
 *
 * @remarks
 * Pure and independently testable (RFC-027 §8.2). Prefers `rawBody` (raw
 * bytes, preserved exactly) over `body` (functions-framework's parsed body,
 * a lossy source for anything but plain-text/JSON debugging). When neither is
 * usable, the body is omitted and a named `[nextrush/serverless]` warning
 * names `rawBody` as the missing capability — never a silent
 * `"[object Object]"`.
 */
export function toGcfEvent(req: GcfHttpRequest): GcfEvent {
  const method = req.method;
  const path = req.path ?? req.originalUrl ?? req.url ?? '/';
  const headers: Record<string, string | string[] | undefined> = { ...req.headers };
  const bodilessMethod = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';

  let body: string | undefined;
  let isBase64Encoded = false;

  if (!bodilessMethod) {
    if (req.rawBody !== undefined) {
      const contentType = firstHeaderValue(headers['content-type']) ?? '';
      const isText = req.rawBody.length === 0 || TEXT_CONTENT_TYPE.test(contentType);
      body = isText ? new TextDecoder().decode(req.rawBody) : bytesToBase64(req.rawBody);
      isBase64Encoded = !isText;
    } else if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body !== undefined) {
      console.warn(
        '[nextrush/serverless] createGoogleHandler received a request whose body was already ' +
          "parsed (functions-framework's req.body) with no req.rawBody available. The raw bytes " +
          "can't be recovered from a parsed object, so the body was omitted rather than sending a " +
          "corrupted \"[object Object]\" string. This usually means a non-standard host populated " +
          'req.body without rawBody — use createGoogleEventHandler with your own bridge if this ' +
          'host never provides rawBody.'
      );
    }
  }

  return {
    method,
    path,
    ...(req.query !== undefined ? { query: req.query } : {}),
    headers,
    ...(body !== undefined ? { body, isBase64Encoded } : {}),
  };
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Write a {@link GcfResult} to a functions-framework response.
 *
 * @remarks
 * Decodes a base64 result body back to bytes before `send()` — the fix for
 * the binary-response corruption in the previous hand-written bridge
 * (RFC-027 §3.2.2). Multiple `Set-Cookie` values are written as one
 * array-valued header call, which Express supports.
 */
export function writeGcfResult(res: GcfHttpResponse, result: GcfResult): void {
  res.status(result.statusCode);
  for (const [name, value] of Object.entries(result.headers)) {
    res.setHeader(name, value);
  }
  if (result.cookies !== undefined && result.cookies.length > 0) {
    res.setHeader('Set-Cookie', result.cookies);
  }
  res.send(result.isBase64Encoded ? base64ToBytes(result.body) : result.body);
}

/**
 * Create a Google Cloud Functions HTTP handler for a NextRush app — a true
 * drop-in for functions-framework's `(req, res)` handler signature.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(req, res) => Promise<void>` for `functions.http('api', handler)`.
 *
 * @see {@link createGoogleEventHandler} for the struct-based path (fixture
 * testing, custom bridges, non-standard hosts).
 *
 * @example
 * ```typescript
 * functions.http('api', createGoogleHandler(app));
 * ```
 */
export function createGoogleHandler(
  app: Application,
  options: ServerlessHandlerOptions = {}
): (req: GcfHttpRequest, res: GcfHttpResponse) => Promise<void> {
  const eventHandler = createGoogleEventHandler(app, options);
  return async (req: GcfHttpRequest, res: GcfHttpResponse): Promise<void> => {
    const result = await eventHandler(toGcfEvent(req));
    writeGcfResult(res, result);
  };
}

/**
 * Create a Google Cloud Functions handler over the {@link GcfEvent} struct.
 *
 * @remarks
 * This is `createGoogleHandler`'s pre-RFC-027 behavior, kept unchanged and
 * explicitly named — the honest answer for fixture tests, a custom bridge, or
 * a host whose request shape isn't functions-framework-standard.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(event) => Promise<result>` over the GCF request essentials.
 *
 * @see {@link createGoogleHandler} for the true drop-in over the real `req`/`res`.
 */
export function createGoogleEventHandler(
  app: Application,
  options: ServerlessHandlerOptions = {}
): ServerlessHandler<GcfEvent, GcfResult> {
  return createServerlessAdapter<GcfEvent, GcfResult>({
    mappers: [gcf],
    provider: 'gcf',
    platform: 'gcf',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  }).createHandler(app);
}

/**
 * Alias of {@link createGoogleHandler}, naming the platform (Google Cloud
 * Functions) rather than the vendor (P4-1) — matches
 * `createCloudflareHandler`/`createLambdaHandler`'s platform-named
 * convention. Both names are fully supported; `createGoogleHandler` remains
 * canonical since it is what most users search for.
 */
export const createGcfHandler = createGoogleHandler;
