/**
 * @nextrush/adapter-serverless - Google Cloud Functions (HTTP) mapper.
 *
 * Models the functions-framework HTTP request essentials (an Express-style
 * `req`). The user adapts the real `req`/`res` to this shape at the boundary;
 * the mapper itself is a pure, fixture-testable transform.
 *
 * @packageDocumentation
 */

import type { EventMapper } from '../types';
import { TEXT_CONTENT_TYPE, base64ToBytes, bytesToBase64 } from './_v2';

/** Google Cloud Functions HTTP request essentials. */
export interface GcfEvent {
  method: string;
  path?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

/** Google Cloud Functions HTTP result. */
export interface GcfResult {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[];
  body: string;
  isBase64Encoded: boolean;
}

function toRequest(event: GcfEvent): Request {
  if (typeof event.method !== 'string') {
    throw new Error(
      '[nextrush/serverless] The gcf mapper received an event with no method. This usually means the ' +
        'request-to-event bridge at your function\'s entry point is incomplete — check that it maps ' +
        "req.method onto the event's method field before calling the handler."
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.query ?? {})) {
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else if (value !== undefined) params.append(key, value);
  }
  const qs = params.toString();
  const url = `http://localhost${event.path ?? '/'}${qs === '' ? '' : `?${qs}`}`;

  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else if (value !== undefined) headers.set(name, value);
  }

  const method = event.method.toUpperCase();
  const bodilessMethod = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;
  if (!bodilessMethod && event.body !== undefined) {
    body = event.isBase64Encoded === true ? (base64ToBytes(event.body) as BodyInit) : event.body;
  }

  return new Request(url, { method, headers, body });
}

async function fromResponse(response: Response): Promise<GcfResult> {
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') continue;
    headers[name] = value;
  }
  const cookies = response.headers.getSetCookie();

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  const isText = bytes.length === 0 || TEXT_CONTENT_TYPE.test(contentType);

  return {
    statusCode: response.status,
    headers,
    ...(cookies.length > 0 ? { cookies } : {}),
    body: isText ? new TextDecoder().decode(bytes) : bytesToBase64(bytes),
    isBase64Encoded: !isText,
  };
}

/** Google Cloud Functions (HTTP) EventMapper. */
export const gcf: EventMapper<GcfEvent, GcfResult> = {
  name: 'gcf',
  toRequest,
  fromResponse,
};
