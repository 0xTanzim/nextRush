/**
 * @nextrush/adapter-serverless - AWS Lambda Function URL mapper.
 *
 * Uses the API Gateway v2 / Lambda Function URL payload format (version 2.0).
 *
 * @packageDocumentation
 */

import type { EventMapper } from '../types';

/** Lambda Function URL / APIGW v2 event (payload format 2.0), minimal shape. */
export interface LambdaFunctionUrlEvent {
  version?: string;
  rawPath?: string;
  rawQueryString?: string;
  cookies?: string[];
  headers?: Record<string, string | undefined>;
  requestContext: { http: { method: string; path?: string; sourceIp?: string } };
  body?: string;
  isBase64Encoded?: boolean;
}

/** Lambda Function URL / APIGW v2 result (payload format 2.0). */
export interface LambdaFunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[];
  body: string;
  isBase64Encoded: boolean;
}

const TEXT_CONTENT_TYPE =
  /^text\/|^application\/(json|xml|javascript|graphql|x-www-form-urlencoded)|\+json|\+xml/i;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toRequest(event: LambdaFunctionUrlEvent): Request {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath ?? '/';
  const qs = event.rawQueryString !== undefined && event.rawQueryString !== '' ? `?${event.rawQueryString}` : '';
  const url = `http://localhost${path}${qs}`;

  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(name, value);
  }
  // APIGW v2 delivers cookies as an array, not a Cookie header.
  if (event.cookies !== undefined && event.cookies.length > 0) {
    headers.set('cookie', event.cookies.join('; '));
  }

  const bodilessMethod = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;
  if (!bodilessMethod && event.body !== undefined) {
    body = event.isBase64Encoded === true ? (base64ToBytes(event.body) as BodyInit) : event.body;
  }

  return new Request(url, { method, headers, body });
}

async function fromResponse(response: Response): Promise<LambdaFunctionUrlResult> {
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') continue; // cookies go in their own field
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

/** AWS Lambda Function URL (APIGW v2 payload format) EventMapper. */
export const lambdaFunctionUrl: EventMapper<LambdaFunctionUrlEvent, LambdaFunctionUrlResult> = {
  name: 'lambda-function-url',
  toRequest,
  fromResponse,
  detect: (event) => event.version === '2.0',
};
