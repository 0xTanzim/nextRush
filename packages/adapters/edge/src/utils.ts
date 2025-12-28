/**
 * @nextrush/adapter-edge - Utility Functions
 *
 * @packageDocumentation
 */

import type { QueryParams, Runtime } from '@nextrush/types';

/**
 * Edge runtime detection result
 */
export interface EdgeRuntimeInfo {
  runtime: Runtime;
  isCloudflare: boolean;
  isVercel: boolean;
  isNetlify: boolean;
  isGenericEdge: boolean;
}

/**
 * Parse query string into object
 */
export function parseQueryString(queryString: string): QueryParams {
  if (!queryString) {
    return {};
  }

  const params: QueryParams = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (!key) continue;

    const decodedKey = decodeURIComponent(key);
    const decodedValue = value !== undefined ? decodeURIComponent(value) : '';

    const existing = params[decodedKey];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(decodedValue);
      } else {
        params[decodedKey] = [existing, decodedValue];
      }
    } else {
      params[decodedKey] = decodedValue;
    }
  }

  return params;
}

/**
 * Detect the specific edge runtime
 */
export function detectEdgeRuntime(): EdgeRuntimeInfo {
  let runtime: Runtime = 'edge';
  let isCloudflare = false;
  let isVercel = false;
  let isNetlify = false;

  // Cloudflare Workers
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Cloudflare-Workers')
  ) {
    runtime = 'cloudflare-workers';
    isCloudflare = true;
  }
  // Vercel Edge
  else if (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.VERCEL_REGION !== undefined
  ) {
    runtime = 'vercel-edge';
    isVercel = true;
  }
  // Netlify Edge (uses Deno under the hood)
  else if (
    typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined' &&
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.NETLIFY === 'true'
  ) {
    runtime = 'edge';
    isNetlify = true;
  }

  return {
    runtime,
    isCloudflare,
    isVercel,
    isNetlify,
    isGenericEdge: !isCloudflare && !isVercel && !isNetlify,
  };
}

/**
 * Get Content-Type header value
 */
export function getContentType(headers: Headers): string | undefined {
  return headers.get('content-type') ?? undefined;
}

/**
 * Get Content-Length header as number
 */
export function getContentLength(headers: Headers): number | undefined {
  const value = headers.get('content-length');
  if (value === null) return undefined;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}
