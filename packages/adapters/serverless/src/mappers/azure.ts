/**
 * @nextrush/adapter-serverless - Azure Functions (v4 Node model, HTTP) mapper.
 *
 * Models the v4 `HttpRequest` essentials and returns an `HttpResponseInit`-shaped
 * result (`status`, not `statusCode`). The user adapts the real v4 request to
 * this shape at the boundary; the mapper is a pure, fixture-testable transform.
 *
 * @packageDocumentation
 */

import type { EventMapper } from '../types';
import { TEXT_CONTENT_TYPE, base64ToBytes, bytesToBase64 } from './_v2';

/** Azure Functions v4 HTTP request essentials. */
export interface AzureEvent {
  method: string;
  /** Full request URL (v4 `HttpRequest.url`). */
  url: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

/** Azure Functions v4 `HttpResponseInit`-shaped result. */
export interface AzureResult {
  status: number;
  headers: Record<string, string>;
  cookies?: string[];
  body: string;
  isBase64Encoded: boolean;
}

function toRequest(event: AzureEvent): Request {
  if (typeof event.method !== 'string') {
    throw new Error(
      '[nextrush/serverless] The azure mapper received an event with no method. This usually means ' +
        "the request-to-event bridge at your function's entry point is incomplete — check that it maps " +
        "req.method onto the event's method field before calling the handler."
    );
  }
  if (typeof event.url !== 'string') {
    throw new Error(
      '[nextrush/serverless] The azure mapper received an event with no url. This usually means the ' +
        "request-to-event bridge at your function's entry point is incomplete — check that it maps " +
        "req.url onto the event's url field before calling the handler."
    );
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(name, value);
  }

  const method = event.method.toUpperCase();
  const bodilessMethod = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;
  if (!bodilessMethod && event.body !== undefined) {
    body = event.isBase64Encoded === true ? (base64ToBytes(event.body) as BodyInit) : event.body;
  }

  // v4 gives a full URL; fall back to localhost origin if a bare path is passed.
  const url = /^https?:\/\//i.test(event.url) ? event.url : `http://localhost${event.url}`;
  return new Request(url, { method, headers, body });
}

async function fromResponse(response: Response): Promise<AzureResult> {
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
    status: response.status,
    headers,
    ...(cookies.length > 0 ? { cookies } : {}),
    body: isText ? new TextDecoder().decode(bytes) : bytesToBase64(bytes),
    isBase64Encoded: !isText,
  };
}

/** Azure Functions (v4 Node model, HTTP) EventMapper. */
export const azure: EventMapper<AzureEvent, AzureResult> = {
  name: 'azure',
  toRequest,
  fromResponse,
};
