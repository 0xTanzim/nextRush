/**
 * Body parser middleware for NextRush v2
 *
 * @packageDocumentation
 */

import { Context } from '@/types/context';
import { NextRushRequest } from '@/types/http';
import { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import { URLSearchParams } from 'node:url';
import type { JsonOptions, Middleware, UrlencodedOptions } from './types';

/**
 * Default JSON parser options
 */
const DEFAULT_JSON_OPTIONS: Required<JsonOptions> = {
  limit: '100kb',
  strict: true,
  type: 'application/json',
  verify: () => {},
};

/**
 * Default URL-encoded parser options
 */
const DEFAULT_URLENCODED_OPTIONS: Required<UrlencodedOptions> = {
  extended: true,
  limit: '100kb',
  parameterLimit: 1000,
  type: 'application/x-www-form-urlencoded',
  verify: () => {},
};

/**
 * Parse JSON body from request
 */
async function parseJsonBody(
  req: IncomingMessage | NextRushRequest,
  limit: number
): Promise<unknown> {
  // Handle mock context for testing
  const reqWithBody = req as any;

  if (
    reqWithBody.body &&
    typeof reqWithBody.body === 'string' &&
    reqWithBody.body.length > 0 &&
    reqWithBody.body !== null
  ) {
    if (reqWithBody.body.length > limit) {
      throw new Error('Payload too large');
    }
    try {
      return JSON.parse(reqWithBody.body);
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }

  // Handle empty string or null body (for tests)
  if (reqWithBody.body === '' || reqWithBody.body === null) {
    return undefined;
  }

  // For real HTTP requests, req.body will be undefined, so we need to read from stream
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;

    // Handle Node.js HTTP request stream
    if (typeof req.on === 'function' && req.readable !== false) {
      // Ensure stream is not already consumed
      if (req.destroyed) {
        resolve(undefined);
        return;
      }

      // Set up stream event handlers
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          req.destroy(new Error('Payload too large'));
          reject(new Error('Payload too large'));
          return;
        }
        data += chunk.toString();
      });

      req.on('end', () => {
        if (data.length === 0) {
          resolve(undefined);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', (error: Error) => {
        reject(error);
      });

      // If stream is already ended (no more data), resolve immediately
      if (req.readableEnded) {
        resolve(undefined);
      }

      // Force stream to start reading if it's paused
      if (req.readable && !req.readableEnded) {
        req.resume();
      }
    } else {
      // Fallback for mock context or already consumed body
      resolve(undefined);
    }
  });
}

/**
 * Parse URL-encoded body from request
 */
async function parseUrlencodedBody(
  req: IncomingMessage | NextRushRequest,
  limit: number,
  extended: boolean,
  parameterLimit: number = 1000
): Promise<Record<string, string | Record<string, string>>> {
  // Handle mock context for testing
  const reqWithBody = req as any;
  if (reqWithBody.body && typeof reqWithBody.body === 'string') {
    if (reqWithBody.body.length > limit) {
      throw new Error('Payload too large');
    }
    try {
      if (extended) {
        // Extended parsing with nested objects
        const params = new URLSearchParams(reqWithBody.body);
        const result: Record<string, string | Record<string, string>> = {};

        let count = 0;
        for (const [key, value] of params.entries()) {
          if (count >= parameterLimit) break;
          count++;

          if (key.includes('[') && key.includes(']')) {
            // Handle nested keys like user[name]
            const match = key.match(/^([^[]+)\[([^\]]+)\]$/);
            if (match) {
              const [, parentKey, childKey] = match;
              if (parentKey && childKey) {
                if (!result[parentKey]) {
                  result[parentKey] = {};
                }
                (result[parentKey] as Record<string, string>)[childKey] = value;
              } else {
                result[key] = value;
              }
            } else {
              result[key] = value;
            }
          } else {
            result[key] = value;
          }
        }
        return result;
      } else {
        // Basic parsing with parameter limit
        const params = new URLSearchParams(reqWithBody.body);
        const result: Record<string, string> = {};

        let count = 0;
        for (const [key, value] of params.entries()) {
          if (count >= parameterLimit) break;
          count++;
          result[key] = value;
        }
        return result;
      }
    } catch (error) {
      throw new Error('Invalid URL-encoded data');
    }
  }

  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;

    if (typeof req.on === 'function') {
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          if (typeof req.destroy === 'function') {
            req.destroy(new Error('Payload too large'));
          }
          return;
        }
        data += chunk.toString();
      });

      req.on('end', () => {
        try {
          if (extended) {
            // Simple extended parsing (for now)
            const params = new URLSearchParams(data);
            const result: Record<string, string> = {};
            for (const [key, value] of params.entries()) {
              result[key] = value;
            }
            resolve(result);
          } else {
            // Basic parsing
            const params = new URLSearchParams(data);
            const result: Record<string, string> = {};
            for (const [key, value] of params.entries()) {
              result[key] = value;
            }
            resolve(result);
          }
        } catch (error) {
          reject(new Error('Invalid URL-encoded data'));
        }
      });

      req.on('error', (error: Error) => {
        reject(error);
      });
    } else {
      // Fallback for mock context
      const reqWithBody = req as any;
      if (
        reqWithBody.body === '' ||
        reqWithBody.body === null ||
        reqWithBody.body === undefined
      ) {
        resolve({});
      } else {
        resolve({});
      }
    }
  });
}

/**
 * Convert size string to bytes
 */
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    return 0; // Return 0 for invalid formats instead of throwing
  }

  const value = parseFloat(match[1] || '0');
  const unit = (match[2] || 'b') as string;

  return Math.floor(value * (units[unit] || 1));
}

/**
 * Create JSON body parser middleware
 *
 * @param options - JSON parser configuration options
 * @returns JSON parser middleware function
 *
 * @example
 * ```typescript
 * import { json } from '@/core/middleware/body-parser';
 *
 * const app = createApp();
 * app.use(json({ limit: '10mb' }));
 *
 * app.post('/api/users', (ctx) => {
 *   console.log(ctx.body); // Parsed JSON body
 *   ctx.res.json({ success: true });
 * });
 * ```
 */
export function json(options: JsonOptions = {}): Middleware {
  const config = { ...DEFAULT_JSON_OPTIONS, ...options };
  const limit = parseSize(config.limit);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const contentType = ctx.req.headers['content-type'] || '';
    console.log(
      `JSON middleware: contentType=${contentType}, config.type=${config.type}`
    );

    if (contentType.includes(config.type)) {
      try {
        try {
          const parsedBody = await parseJsonBody(ctx.req, limit);
          ctx.body = parsedBody;
          // Patch: also assign to ctx.req.body for test/mocks
          if (typeof ctx.req.body === 'string') {
            ctx.req.body = parsedBody;
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Payload too large') {
            ctx.status = 413;
            ctx.body = undefined;
            if (typeof ctx.res.json === 'function') {
              ctx.res.json({ error: 'Payload too large' });
            }
            return;
          }
          throw error;
        }
      } catch (error) {
        console.log(`JSON middleware caught error: ${error}`);
        ctx.status = 400;
        ctx.body = undefined;
        // eslint-disable-next-line no-console
        console.error('JSON parsing error:', error);
        if (typeof ctx.res.json === 'function') {
          ctx.res.statusCode = ctx.status;
          console.log(`Sending 400 response for malformed JSON`);
          ctx.res.json({
            error: 'Invalid JSON',
            message:
              error instanceof Error ? error.message : 'JSON parsing failed',
          });
        }
        console.log(
          `JSON middleware returning early with status: ${ctx.status}`
        );
        return;
      }
    }
    await next();
  };
}

/**
 * Create URL-encoded body parser middleware
 *
 * @param options - URL-encoded parser configuration options
 * @returns URL-encoded parser middleware function
 *
 * @example
 * ```typescript
 * import { urlencoded } from '@/core/middleware/body-parser';
 *
 * const app = createApp();
 * app.use(urlencoded({ extended: true }));
 *
 * app.post('/api/login', (ctx) => {
 *   console.log(ctx.body); // Parsed form data
 *   ctx.res.json({ success: true });
 * });
 * ```
 */
export function urlencoded(options: UrlencodedOptions = {}): Middleware {
  const config = { ...DEFAULT_URLENCODED_OPTIONS, ...options };
  const limit = parseSize(config.limit);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const contentType = ctx.req.headers['content-type'] || '';

    if (contentType.includes(config.type)) {
      try {
        try {
          const body = await parseUrlencodedBody(
            ctx.req,
            limit,
            config.extended,
            config.parameterLimit
          );
          ctx.body = body;
          // Patch: also assign to ctx.req.body for test/mocks
          if (typeof ctx.req.body === 'string') {
            ctx.req.body = body;
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Payload too large') {
            ctx.status = 413;
            ctx.body = undefined;
            if (typeof ctx.res.json === 'function') {
              ctx.res.json({ error: 'Payload too large' });
            }
            return;
          }
          throw error;
        }
      } catch (error) {
        ctx.status = 400;
        if (typeof ctx.res.json === 'function') {
          ctx.res.json({ error: 'Invalid URL-encoded body' });
        }
        return;
      }
    }

    await next();
  };
}

/**
 * Create raw body parser middleware
 *
 * @param options - Raw parser configuration options
 * @returns Raw parser middleware function
 *
 * @example
 * ```typescript
 * import { raw } from '@/core/middleware/body-parser';
 *
 * const app = createApp();
 * app.use(raw({ type: 'application/octet-stream' }));
 *
 * app.post('/api/upload', (ctx) => {
 *   console.log(ctx.body); // Raw buffer
 *   ctx.res.json({ success: true });
 * });
 * ```
 */
export function raw(
  options: { type?: string; limit?: string } = {}
): Middleware {
  const config = {
    type: 'application/octet-stream',
    limit: '100kb',
    ...options,
  };
  const limit = parseSize(config.limit);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const contentType = ctx.req.headers['content-type'] || '';

    if (contentType.includes(config.type)) {
      // Handle mock context for testing
      if (ctx.req.body) {
        let buffer: Buffer;

        if (typeof ctx.req.body === 'string') {
          buffer = Buffer.from(ctx.req.body);
        } else if (Buffer.isBuffer(ctx.req.body)) {
          buffer = ctx.req.body;
        } else {
          await next();
          return;
        }

        if (buffer.length > limit) {
          ctx.status = 413;
          ctx.body = undefined;
          if (typeof ctx.res.json === 'function') {
            ctx.res.json({ error: 'Payload too large' });
          }
          return;
        }

        ctx.body = buffer;
        await next();
      } else {
        await next();
      }
    } else {
      await next();
    }
  };
}

/**
 * Create text body parser middleware
 *
 * @param options - Text parser configuration options
 * @returns Text parser middleware function
 */
export function text(
  options: { type?: string; limit?: string } = {}
): Middleware {
  const config = {
    type: 'text/plain',
    limit: '100kb',
    ...options,
  };
  const limit = parseSize(config.limit);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const contentType = ctx.req.headers['content-type'] || '';

    if (contentType.includes(config.type)) {
      // Handle mock context for testing
      if (ctx.req.body && typeof ctx.req.body === 'string') {
        const body = ctx.req.body;
        if (body.length > limit) {
          ctx.status = 413;
          ctx.body = undefined;
          if (typeof ctx.res.json === 'function') {
            ctx.res.json({ error: 'Payload too large' });
          }
          return;
        }
        ctx.body = body;
        await next();
        return;
      }

      return new Promise((resolve, reject) => {
        let data = '';
        let size = 0;

        if (typeof ctx.req.on === 'function') {
          ctx.req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
              if (typeof ctx.req.destroy === 'function') {
                ctx.req.destroy(new Error('Payload too large'));
              }
              return;
            }
            data += chunk.toString();
          });

          ctx.req.on('end', () => {
            try {
              ctx.body = data;
              resolve();
            } catch (error) {
              ctx.status = 400;
              if (typeof ctx.res.json === 'function') {
                ctx.res.json({ error: 'Invalid text body' });
              }
              reject(error);
            }
          });

          ctx.req.on('error', (error: Error) => {
            ctx.status = 400;
            if (typeof ctx.res.json === 'function') {
              ctx.res.json({ error: 'Body parsing error' });
            }
            reject(error);
          });
        } else {
          // Fallback for mock context
          resolve();
        }
      });
    }

    await next();
  };
}

/**
 * Body parser utilities for testing and advanced usage
 */
export const bodyParserUtils = {
  /**
   * Parse size string to bytes
   */
  parseSize,

  /**
   * Parse JSON body
   */
  parseJsonBody,

  /**
   * Parse URL-encoded body
   */
  parseUrlencodedBody,

  /**
   * Default JSON options
   */
  DEFAULT_JSON_OPTIONS,

  /**
   * Default URL-encoded options
   */
  DEFAULT_URLENCODED_OPTIONS,
};
