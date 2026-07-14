/**
 * @nextrush/adapter-serverless - Shared API Gateway v2 payload-format core.
 *
 * AWS Lambda Function URL and API Gateway v2 (HTTP API) both use payload
 * format 2.0. The event↔Request/Response translation is identical; only the
 * mapper `name` differs. This module owns that shared logic so the two mappers
 * cannot drift.
 *
 * @packageDocumentation
 */

/** API Gateway v2 / Lambda Function URL event (payload format 2.0). */
export interface ApiGatewayV2Event {
  version?: string;
  rawPath?: string;
  rawQueryString?: string;
  cookies?: string[];
  headers?: Record<string, string | undefined>;
  requestContext: { http: { method: string; path?: string; sourceIp?: string } };
  body?: string;
  isBase64Encoded?: boolean;
}

/** API Gateway v2 / Lambda Function URL result (payload format 2.0). */
export interface ApiGatewayV2Result {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[];
  body: string;
  isBase64Encoded: boolean;
}

export const TEXT_CONTENT_TYPE =
  /^text\/|^application\/(json|xml|javascript|graphql|x-www-form-urlencoded)|\+json|\+xml/i;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function v2ToRequest(event: ApiGatewayV2Event): Request {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath ?? '/';
  const qs = event.rawQueryString !== undefined && event.rawQueryString !== '' ? `?${event.rawQueryString}` : '';

  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(name, value);
  }
  if (event.cookies !== undefined && event.cookies.length > 0) {
    headers.set('cookie', event.cookies.join('; '));
  }

  const bodilessMethod = method === 'GET' || method === 'HEAD';
  let body: BodyInit | undefined;
  if (!bodilessMethod && event.body !== undefined) {
    body = event.isBase64Encoded === true ? (base64ToBytes(event.body) as BodyInit) : event.body;
  }

  return new Request(`http://localhost${path}${qs}`, { method, headers, body });
}

export async function v2FromResponse(response: Response): Promise<ApiGatewayV2Result> {
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
