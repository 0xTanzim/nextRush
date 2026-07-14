/**
 * @nextrush/adapter-serverless - AWS API Gateway v1 (REST API) mapper.
 *
 * Payload format 1.0: single- and multi-value query params + headers, base64
 * bodies. Distinct from v2 (which is what Function URL / HTTP API use).
 *
 * @packageDocumentation
 */

import type { EventMapper } from '../types';
import { TEXT_CONTENT_TYPE, base64ToBytes, bytesToBase64 } from './_v2';

/** API Gateway v1 (REST API) event (payload format 1.0). */
export interface ApiGatewayV1Event {
  httpMethod: string;
  path?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  multiValueQueryStringParameters?: Record<string, string[] | undefined> | null;
  headers?: Record<string, string | undefined> | null;
  multiValueHeaders?: Record<string, string[] | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

/** API Gateway v1 (REST API) result (payload format 1.0). */
export interface ApiGatewayV1Result {
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded: boolean;
}

function buildQueryString(event: ApiGatewayV1Event): string {
  const params = new URLSearchParams();
  const multi = event.multiValueQueryStringParameters;
  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      for (const value of values ?? []) params.append(key, value);
    }
  } else if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value !== undefined) params.append(key, value);
    }
  }
  const s = params.toString();
  return s === '' ? '' : `?${s}`;
}

function toRequest(event: ApiGatewayV1Event): Request {
  const method = event.httpMethod.toUpperCase();
  const url = `http://localhost${event.path ?? '/'}${buildQueryString(event)}`;

  const headers = new Headers();
  if (event.multiValueHeaders) {
    for (const [name, values] of Object.entries(event.multiValueHeaders)) {
      for (const value of values ?? []) headers.append(name, value);
    }
  } else if (event.headers) {
    for (const [name, value] of Object.entries(event.headers)) {
      if (value !== undefined) headers.set(name, value);
    }
  }

  const bodilessMethod = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;
  if (!bodilessMethod && event.body !== undefined && event.body !== null) {
    body = event.isBase64Encoded === true ? (base64ToBytes(event.body) as BodyInit) : event.body;
  }

  return new Request(url, { method, headers, body });
}

async function fromResponse(response: Response): Promise<ApiGatewayV1Result> {
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') continue;
    headers[name] = value;
  }
  // v1 carries multiple Set-Cookie via multiValueHeaders.
  const setCookies = response.headers.getSetCookie();
  const multiValueHeaders = setCookies.length > 0 ? { 'set-cookie': setCookies } : undefined;

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  const isText = bytes.length === 0 || TEXT_CONTENT_TYPE.test(contentType);

  return {
    statusCode: response.status,
    headers,
    ...(multiValueHeaders !== undefined ? { multiValueHeaders } : {}),
    body: isText ? new TextDecoder().decode(bytes) : bytesToBase64(bytes),
    isBase64Encoded: !isText,
  };
}

/** AWS API Gateway v1 / REST API (payload format 1.0) EventMapper. */
export const apigwV1: EventMapper<ApiGatewayV1Event, ApiGatewayV1Result> = {
  name: 'apigw-v1',
  toRequest,
  fromResponse,
  detect: (event) => typeof event.httpMethod === 'string' && event.multiValueHeaders !== undefined,
};
