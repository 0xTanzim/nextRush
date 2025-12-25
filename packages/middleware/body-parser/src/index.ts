/**
 * @nextrush/body-parser - Body Parsing Middleware
 *
 * Parse incoming request bodies in middleware before your handlers.
 * Supports JSON and URL-encoded form data.
 *
 * @packageDocumentation
 */

/**
 * Minimal context interface for body-parser middleware
 */
export interface BodyParserContext {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  req: {
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
  };
  body?: unknown;
  rawBody?: Buffer;
}

/**
 * Body parser middleware function type
 */
export type BodyParserMiddleware = (
  ctx: BodyParserContext,
  next?: () => Promise<void>
) => Promise<void>;

/**
 * JSON body parser options
 */
export interface JsonOptions {
  /** Maximum body size in bytes (default: 1MB) */
  limit?: number | string;
  /** Custom JSON reviver function */
  reviver?: (key: string, value: unknown) => unknown;
  /** Content-Types to parse as JSON (default: ['application/json']) */
  type?: string | string[];
  /** Store raw body buffer (default: false) */
  rawBody?: boolean;
  /** Strict mode - only parse arrays and objects (default: true) */
  strict?: boolean;
}

/**
 * URL-encoded body parser options
 */
export interface UrlEncodedOptions {
  /** Maximum body size in bytes (default: 100KB) */
  limit?: number | string;
  /** Content-Types to parse (default: ['application/x-www-form-urlencoded']) */
  type?: string | string[];
  /** Store raw body buffer (default: false) */
  rawBody?: boolean;
  /** Extended parsing for nested objects (default: true) */
  extended?: boolean;
  /** Maximum parameter limit (default: 1000) */
  parameterLimit?: number;
}

/**
 * Text body parser options
 */
export interface TextOptions {
  /** Maximum body size in bytes (default: 100KB) */
  limit?: number | string;
  /** Content-Types to parse (default: ['text/plain']) */
  type?: string | string[];
  /** Store raw body buffer (default: false) */
  rawBody?: boolean;
  /** Default charset (default: 'utf-8') */
  defaultCharset?: string;
}

/**
 * Raw body parser options
 */
export interface RawOptions {
  /** Maximum body size in bytes (default: 100KB) */
  limit?: number | string;
  /** Content-Types to parse (default: ['application/octet-stream']) */
  type?: string | string[];
}

/**
 * Body parser error class
 */
export class BodyParserError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly expose: boolean;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'BodyParserError';
    this.status = status;
    this.code = code;
    this.expose = status < 500;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Parse limit string to bytes (e.g., '1mb' -> 1048576)
 */
function parseLimit(limit: number | string | undefined, defaultLimit: number): number {
  if (limit === undefined) return defaultLimit;
  if (typeof limit === 'number') return limit;

  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(limit);
  if (!match) return defaultLimit;

  const value = parseFloat(match[1]!);
  const unit = (match[2] || 'b').toLowerCase();

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Check if content-type matches
 */
function matchContentType(
  contentType: string | undefined,
  types: string[]
): boolean {
  if (!contentType) return false;

  const ct = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return types.some(type => {
    if (type === '*/*') return true;
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -2);
      return ct.startsWith(prefix);
    }
    return ct === type;
  });
}

/**
 * Get content type from headers
 */
function getContentType(headers: Record<string, string | string[] | undefined>): string | undefined {
  const ct = headers['content-type'];
  if (Array.isArray(ct)) return ct[0];
  return ct;
}

/**
 * Get content length from headers
 */
function getContentLength(headers: Record<string, string | string[] | undefined>): number | undefined {
  const cl = headers['content-length'];
  const value = Array.isArray(cl) ? cl[0] : cl;
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Read body from request stream
 */
async function readBody(
  ctx: BodyParserContext,
  limit: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    const contentLength = getContentLength(ctx.headers);

    // Pre-check content-length if available
    if (contentLength !== undefined && contentLength > limit) {
      reject(new BodyParserError(
        `Request body too large (${contentLength} bytes exceeds ${limit} byte limit)`,
        413,
        'ENTITY_TOO_LARGE'
      ));
      return;
    }

    ctx.req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > limit) {
        reject(new BodyParserError(
          `Request body too large (exceeds ${limit} byte limit)`,
          413,
          'ENTITY_TOO_LARGE'
        ));
        return;
      }
      chunks.push(chunk);
    });

    ctx.req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    ctx.req.on('error', (err: Error) => {
      reject(new BodyParserError(
        `Error reading request body: ${err.message}`,
        400,
        'BODY_READ_ERROR'
      ));
    });
  });
}

/**
 * Safely decode URI component, returning original on failure
 */
function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch {
    return str;
  }
}

/**
 * Parse URL-encoded string to object
 */
function parseUrlEncoded(
  str: string,
  extended: boolean,
  parameterLimit: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const pairs = str.split('&');

  if (pairs.length > parameterLimit) {
    throw new BodyParserError(
      `Too many parameters (${pairs.length} exceeds ${parameterLimit} limit)`,
      413,
      'TOO_MANY_PARAMETERS'
    );
  }

  for (const pair of pairs) {
    if (!pair) continue;

    const eqIndex = pair.indexOf('=');
    const key = eqIndex === -1
      ? safeDecodeURIComponent(pair)
      : safeDecodeURIComponent(pair.slice(0, eqIndex));
    const value = eqIndex === -1
      ? ''
      : safeDecodeURIComponent(pair.slice(eqIndex + 1));

    if (!key) continue;

    if (extended && key.includes('[')) {
      setNestedValue(result, key, value);
    } else {
      if (key in result) {
        const existing = result[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Set nested value for extended URL-encoded parsing
 */
function setNestedValue(
  obj: Record<string, unknown>,
  key: string,
  value: string
): void {
  const parts = key.split(/\[|\]/).filter(Boolean);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      // Check if next part is numeric for array
      const nextPart = parts[i + 1] ?? '';
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  if (Array.isArray(current)) {
    const index = parseInt(lastPart, 10);
    (current as unknown[])[index] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * JSON body parser middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { json } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse JSON bodies
 * app.use(json());
 *
 * // With options
 * app.use(json({
 *   limit: '1mb',
 *   strict: true,
 * }));
 * ```
 */
export function json(options: JsonOptions = {}): BodyParserMiddleware {
  const {
    limit = '1mb',
    reviver,
    type = ['application/json'],
    rawBody = false,
    strict = true,
  } = options;

  const limitBytes = parseLimit(limit, 1024 * 1024); // 1MB default
  const types = Array.isArray(type) ? type : [type];

  return async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip non-body methods
    if (ctx.method === 'GET' || ctx.method === 'HEAD' || ctx.method === 'DELETE') {
      if (next) await next();
      return;
    }

    // Check content type
    const contentType = getContentType(ctx.headers);
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Read body
    const buffer = await readBody(ctx, limitBytes);

    if (rawBody) {
      ctx.rawBody = buffer;
    }

    // Handle empty body
    if (buffer.length === 0) {
      ctx.body = {};
      if (next) await next();
      return;
    }

    // Parse JSON
    const str = buffer.toString('utf-8');

    try {
      const parsed = JSON.parse(str, reviver);

      // Strict mode check
      if (strict) {
        if (typeof parsed !== 'object' || parsed === null) {
          throw new BodyParserError(
            'Request body must be a JSON object or array in strict mode',
            400,
            'STRICT_MODE_VIOLATION'
          );
        }
      }

      ctx.body = parsed;
    } catch (err) {
      if (err instanceof BodyParserError) throw err;
      throw new BodyParserError(
        `Invalid JSON: ${(err as Error).message}`,
        400,
        'INVALID_JSON'
      );
    }

    if (next) await next();
  };
}

/**
 * URL-encoded body parser middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { urlencoded } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse URL-encoded bodies
 * app.use(urlencoded());
 *
 * // With extended parsing
 * app.use(urlencoded({
 *   extended: true,
 *   limit: '100kb',
 * }));
 * ```
 */
export function urlencoded(options: UrlEncodedOptions = {}): BodyParserMiddleware {
  const {
    limit = '100kb',
    type = ['application/x-www-form-urlencoded'],
    rawBody = false,
    extended = true,
    parameterLimit = 1000,
  } = options;

  const limitBytes = parseLimit(limit, 100 * 1024); // 100KB default
  const types = Array.isArray(type) ? type : [type];

  return async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip non-body methods
    if (ctx.method === 'GET' || ctx.method === 'HEAD' || ctx.method === 'DELETE') {
      if (next) await next();
      return;
    }

    // Check content type
    const contentType = getContentType(ctx.headers);
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Read body
    const buffer = await readBody(ctx, limitBytes);

    if (rawBody) {
      ctx.rawBody = buffer;
    }

    // Handle empty body
    if (buffer.length === 0) {
      ctx.body = {};
      if (next) await next();
      return;
    }

    // Parse URL-encoded
    const str = buffer.toString('utf-8');

    try {
      ctx.body = parseUrlEncoded(str, extended, parameterLimit);
    } catch (err) {
      if (err instanceof BodyParserError) throw err;
      throw new BodyParserError(
        `Invalid URL-encoded body: ${(err as Error).message}`,
        400,
        'INVALID_URLENCODED'
      );
    }

    if (next) await next();
  };
}

/**
 * Text body parser middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { text } from '@nextrush/body-parser';
 *
 * const app = createApp();
 * app.use(text());
 * ```
 */
export function text(options: TextOptions = {}): BodyParserMiddleware {
  const {
    limit = '100kb',
    type = ['text/plain'],
    rawBody = false,
    defaultCharset = 'utf-8',
  } = options;

  const limitBytes = parseLimit(limit, 100 * 1024); // 100KB default
  const types = Array.isArray(type) ? type : [type];

  return async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip non-body methods
    if (ctx.method === 'GET' || ctx.method === 'HEAD' || ctx.method === 'DELETE') {
      if (next) await next();
      return;
    }

    // Check content type
    const contentType = getContentType(ctx.headers);
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Read body
    const buffer = await readBody(ctx, limitBytes);

    if (rawBody) {
      ctx.rawBody = buffer;
    }

    // Parse charset from content-type
    let charset = defaultCharset;
    if (contentType) {
      const charsetMatch = /charset=([^\s;]+)/.exec(contentType);
      if (charsetMatch && charsetMatch[1]) {
        charset = charsetMatch[1].toLowerCase();
      }
    }

    ctx.body = buffer.toString(charset as BufferEncoding);

    if (next) await next();
  };
}

/**
 * Raw body parser middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { raw } from '@nextrush/body-parser';
 *
 * const app = createApp();
 * app.use(raw());
 * ```
 */
export function raw(options: RawOptions = {}): BodyParserMiddleware {
  const {
    limit = '100kb',
    type = ['application/octet-stream'],
  } = options;

  const limitBytes = parseLimit(limit, 100 * 1024); // 100KB default
  const types = Array.isArray(type) ? type : [type];

  return async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip non-body methods
    if (ctx.method === 'GET' || ctx.method === 'HEAD' || ctx.method === 'DELETE') {
      if (next) await next();
      return;
    }

    // Check content type
    const contentType = getContentType(ctx.headers);
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Read body
    const buffer = await readBody(ctx, limitBytes);
    ctx.body = buffer;

    if (next) await next();
  };
}

/**
 * Combined body parser middleware (JSON + URL-encoded)
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { bodyParser } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse both JSON and URL-encoded bodies
 * app.use(bodyParser());
 * ```
 */
export function bodyParser(options: {
  json?: JsonOptions | false;
  urlencoded?: UrlEncodedOptions | false;
} = {}): BodyParserMiddleware {
  const jsonMiddleware = options.json !== false ? json(options.json || {}) : null;
  const urlencodedMiddleware = options.urlencoded !== false ? urlencoded(options.urlencoded || {}) : null;

  return async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Try JSON first
    if (jsonMiddleware) {
      const contentType = getContentType(ctx.headers);
      if (matchContentType(contentType, ['application/json'])) {
        await jsonMiddleware(ctx, next);
        return;
      }
    }

    // Try URL-encoded
    if (urlencodedMiddleware) {
      const contentType = getContentType(ctx.headers);
      if (matchContentType(contentType, ['application/x-www-form-urlencoded'])) {
        await urlencodedMiddleware(ctx, next);
        return;
      }
    }

    // Neither matched, just continue
    if (next) await next();
  };
}

// Default export for convenience
export default bodyParser;
