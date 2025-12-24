/**
 * Response Guard Utility for NextRush v2
 *
 * Provides utilities to safely handle response state and prevent
 * writing to closed or finished responses.
 *
 * @packageDocumentation
 */

import type { ServerResponse } from 'node:http';

/**
 * Response state information
 */
export interface ResponseState {
  /** Headers have been sent */
  readonly headersSent: boolean;

  /** Response has finished */
  readonly finished: boolean;

  /** Response has been destroyed */
  readonly destroyed: boolean;

  /** Response is writable */
  readonly writable: boolean;
}

/**
 * Check if response can be written to
 *
 * Returns true if the response is still open and can receive data.
 * Use this before any write operation to prevent errors.
 *
 * @param res - Server response object
 * @returns True if response is writable
 *
 * @example
 * ```typescript
 * if (canWriteResponse(res)) {
 *   res.end('Hello');
 * }
 * ```
 */
export function canWriteResponse(res: ServerResponse): boolean {
  return (
    !res.headersSent &&
    !res.writableEnded &&
    !res.destroyed &&
    res.writable !== false
  );
}

/**
 * Check if headers can still be set
 *
 * @param res - Server response object
 * @returns True if headers can be set
 *
 * @example
 * ```typescript
 * if (canSetHeaders(res)) {
 *   res.setHeader('Content-Type', 'application/json');
 * }
 * ```
 */
export function canSetHeaders(res: ServerResponse): boolean {
  return !res.headersSent;
}

/**
 * Get response state information
 *
 * @param res - Server response object
 * @returns Response state object
 *
 * @example
 * ```typescript
 * const state = getResponseState(res);
 * console.log(state.headersSent); // false
 * console.log(state.writable);    // true
 * ```
 */
export function getResponseState(res: ServerResponse): ResponseState {
  return {
    headersSent: res.headersSent,
    finished: res.writableEnded ?? (res as any).finished ?? false,
    destroyed: res.destroyed ?? false,
    writable: res.writable !== false && !res.writableEnded && !res.destroyed,
  };
}

/**
 * Execute a callback only if response is writable
 *
 * Provides a safe wrapper for response operations.
 *
 * @param res - Server response object
 * @param callback - Function to execute if response is writable
 * @returns True if callback was executed
 *
 * @example
 * ```typescript
 * guardedWrite(res, () => {
 *   res.setHeader('Content-Type', 'application/json');
 *   res.end(JSON.stringify({ ok: true }));
 * });
 * ```
 */
export function guardedWrite(
  res: ServerResponse,
  callback: () => void
): boolean {
  if (canWriteResponse(res)) {
    callback();
    return true;
  }
  return false;
}

/**
 * Execute a callback only if headers can be set
 *
 * @param res - Server response object
 * @param callback - Function to execute if headers can be set
 * @returns True if callback was executed
 *
 * @example
 * ```typescript
 * guardedSetHeader(res, () => {
 *   res.setHeader('X-Custom', 'value');
 * });
 * ```
 */
export function guardedSetHeader(
  res: ServerResponse,
  callback: () => void
): boolean {
  if (canSetHeaders(res)) {
    callback();
    return true;
  }
  return false;
}

/**
 * Higher-order function to create a guarded response method
 *
 * Wraps a response method to automatically check response state
 * before execution.
 *
 * @param res - Server response object
 * @param method - Method to wrap
 * @returns Guarded method that only executes if response is writable
 *
 * @example
 * ```typescript
 * const safeJson = createGuardedMethod(res, (data: unknown) => {
 *   res.setHeader('Content-Type', 'application/json');
 *   res.end(JSON.stringify(data));
 * });
 *
 * safeJson({ message: 'Hello' }); // Only executes if response is writable
 * ```
 */
export function createGuardedMethod<T extends (...args: any[]) => any>(
  res: ServerResponse,
  method: T
): (...args: Parameters<T>) => ReturnType<T> | void {
  return (...args: Parameters<T>): ReturnType<T> | void => {
    if (canWriteResponse(res)) {
      return method(...args);
    }
  };
}

/**
 * Safe response utilities for common operations
 */
export const ResponseGuard = {
  /**
   * Safely end response with data
   */
  end(res: ServerResponse, data?: string | Buffer): boolean {
    return guardedWrite(res, () => res.end(data));
  },

  /**
   * Safely write data to response
   */
  write(res: ServerResponse, data: string | Buffer): boolean {
    return guardedWrite(res, () => {
      res.write(data);
    });
  },

  /**
   * Safely set status code
   */
  status(res: ServerResponse, code: number): boolean {
    return guardedSetHeader(res, () => {
      res.statusCode = code;
    });
  },

  /**
   * Safely set header
   */
  setHeader(res: ServerResponse, name: string, value: string | number): boolean {
    return guardedSetHeader(res, () => {
      res.setHeader(name, value);
    });
  },

  /**
   * Safely send JSON response
   */
  json(res: ServerResponse, data: unknown, statusCode: number = 200): boolean {
    return guardedWrite(res, () => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    });
  },

  /**
   * Safely send text response
   */
  text(res: ServerResponse, data: string, statusCode: number = 200): boolean {
    return guardedWrite(res, () => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(data);
    });
  },

  /**
   * Safely send HTML response
   */
  html(res: ServerResponse, data: string, statusCode: number = 200): boolean {
    return guardedWrite(res, () => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(data);
    });
  },

  /**
   * Safely redirect
   */
  redirect(res: ServerResponse, url: string, statusCode: number = 302): boolean {
    return guardedWrite(res, () => {
      res.statusCode = statusCode;
      res.setHeader('Location', url);
      res.end();
    });
  },
};
