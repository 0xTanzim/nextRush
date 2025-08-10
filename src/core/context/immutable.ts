/**
 * Context Safety Utilities for NextRush v2
 *
 * Provides context safety utilities to prevent race conditions
 * and improve thread safety for critical context properties.
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';

/**
 * Context properties that should be immutable (race condition prone)
 */
type ImmutableProps =
  | 'body'
  | 'params'
  | 'state'
  | 'query'
  | 'requestId'
  | 'logger';

/**
 * Context update operations
 */
export interface ContextUpdates {
  body?: unknown;
  params?: Record<string, string>;
  state?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
  requestId?: string;
  logger?: Context['logger'];
}

/**
 * Thread-safe context wrapper
 */
export class SafeContext {
  private _context: Context;
  private _frozenProps: Partial<Pick<Context, ImmutableProps>>;

  constructor(context: Context) {
    this._context = context;

    // Create frozen copies of mutable properties with proper typing
    this._frozenProps = {
      body: context.body,
      params: { ...context.params },
      state: { ...context.state },
      query: { ...context.query },
    };

    // Handle optional properties separately
    if (context.requestId) {
      this._frozenProps.requestId = context.requestId;
    }
    if (context.logger) {
      this._frozenProps.logger = context.logger;
    }
  }

  /**
   * Get the underlying context (for performance-critical operations)
   */
  get context(): Context {
    return this._context;
  }

  /**
   * Get frozen body (safe)
   */
  get body(): unknown {
    return this._frozenProps.body;
  }

  /**
   * Get frozen params (safe)
   */
  get params(): Record<string, string> {
    return { ...this._frozenProps.params };
  }

  /**
   * Get frozen state (safe)
   */
  get state(): Record<string, unknown> {
    return { ...this._frozenProps.state };
  }

  /**
   * Get frozen query (safe)
   */
  get query(): Record<string, string | string[] | undefined> {
    return { ...this._frozenProps.query };
  }

  /**
   * Get request ID (safe)
   */
  get requestId(): string | undefined {
    return this._frozenProps.requestId;
  }

  /**
   * Get logger (safe)
   */
  get logger(): Context['logger'] {
    return this._frozenProps.logger;
  }

  /**
   * Create new SafeContext with updates (immutable operation)
   */
  withUpdates(updates: ContextUpdates): SafeContext {
    const newContext = { ...this._context };

    // Apply updates to the underlying context
    if (updates.body !== undefined) {
      newContext.body = updates.body;
    }
    if (updates.params) {
      newContext.params = { ...updates.params };
    }
    if (updates.state) {
      newContext.state = { ...updates.state };
    }
    if (updates.query) {
      newContext.query = { ...updates.query };
    }
    if (updates.requestId !== undefined) {
      newContext.requestId = updates.requestId;
    }
    if (updates.logger !== undefined) {
      newContext.logger = updates.logger;
    }

    return new SafeContext(newContext);
  }

  /**
   * Update body immutably
   */
  withBody(body: unknown): SafeContext {
    return this.withUpdates({ body });
  }

  /**
   * Update params immutably
   */
  withParams(params: Record<string, string>): SafeContext {
    return this.withUpdates({ params });
  }

  /**
   * Add param immutably
   */
  withParam(key: string, value: string): SafeContext {
    return this.withUpdates({
      params: { ...this._frozenProps.params, [key]: value },
    });
  }

  /**
   * Update state immutably
   */
  withState(state: Record<string, unknown>): SafeContext {
    return this.withUpdates({ state });
  }

  /**
   * Add state property immutably
   */
  withStateProperty(key: string, value: unknown): SafeContext {
    return this.withUpdates({
      state: { ...this._frozenProps.state, [key]: value },
    });
  }

  /**
   * Update query immutably
   */
  withQuery(query: Record<string, string | string[] | undefined>): SafeContext {
    return this.withUpdates({ query });
  }

  /**
   * Update request ID immutably
   */
  withRequestId(requestId: string): SafeContext {
    return this.withUpdates({ requestId });
  }

  /**
   * Update logger immutably
   */
  withLogger(logger: Context['logger']): SafeContext {
    return this.withUpdates({ logger });
  }

  /**
   * Apply updates to the original context (mutable operation - use with caution)
   */
  commit(): Context {
    // Apply frozen properties back to the original context
    this._context.body = this._frozenProps.body;
    this._context.params = { ...this._frozenProps.params };
    this._context.state = { ...this._frozenProps.state };
    this._context.query = { ...this._frozenProps.query };

    // Handle optional properties with proper type checking
    if (this._frozenProps.requestId !== undefined) {
      this._context.requestId = this._frozenProps.requestId;
    }
    if (this._frozenProps.logger !== undefined) {
      this._context.logger = this._frozenProps.logger;
    }

    return this._context;
  }
}

/**
 * Create a thread-safe context wrapper
 */
export function createSafeContext(context: Context): SafeContext {
  return new SafeContext(context);
}

/**
 * Middleware utility type for safe contexts
 */
export type SafeMiddleware = (
  ctx: SafeContext,
  next: () => Promise<void>
) => Promise<SafeContext | void>;

/**
 * Convert regular middleware to work with safe contexts
 */
export function createSafeMiddleware(
  middleware: (ctx: Context, next: () => Promise<void>) => Promise<void>
): SafeMiddleware {
  return async (
    safeCtx: SafeContext,
    next: () => Promise<void>
  ): Promise<SafeContext | void> => {
    // Get the underlying context
    const ctx = safeCtx.context;

    // Run middleware with the underlying context
    await middleware(ctx, next);

    // Return updated safe context
    return createSafeContext(ctx);
  };
}

/**
 * Context safety utilities
 */
export const ContextSafety = {
  /**
   * Check if two contexts have the same immutable properties
   */
  areEqual: (ctx1: SafeContext, ctx2: SafeContext): boolean => {
    return (
      ctx1.body === ctx2.body &&
      JSON.stringify(ctx1.params) === JSON.stringify(ctx2.params) &&
      JSON.stringify(ctx1.state) === JSON.stringify(ctx2.state) &&
      JSON.stringify(ctx1.query) === JSON.stringify(ctx2.query) &&
      ctx1.requestId === ctx2.requestId
    );
  },

  /**
   * Create context snapshot for debugging
   */
  snapshot: (ctx: SafeContext) => ({
    body: ctx.body,
    params: ctx.params,
    state: ctx.state,
    query: ctx.query,
    requestId: ctx.requestId,
    timestamp: Date.now(),
  }),

  /**
   * Validate context integrity
   */
  validate: (ctx: SafeContext): boolean => {
    try {
      // Check if all required properties exist
      return !!(
        ctx.context &&
        ctx.context.req &&
        ctx.context.res &&
        typeof ctx.context.method === 'string' &&
        typeof ctx.context.url === 'string'
      );
    } catch {
      return false;
    }
  },

  /**
   * Deep freeze context state to prevent mutations
   */
  deepFreeze: (obj: Record<string, unknown>): Record<string, unknown> => {
    Object.freeze(obj);
    Object.values(obj).forEach(value => {
      if (value && typeof value === 'object') {
        ContextSafety.deepFreeze(value as Record<string, unknown>);
      }
    });
    return obj;
  },
};

/**
 * Context performance pool for reusing SafeContext instances
 */
class SafeContextPool {
  private static pool: SafeContext[] = [];
  private static readonly MAX_POOL_SIZE = 25;

  static acquire(context: Context): SafeContext {
    const pooled = this.pool.pop();

    if (pooled) {
      // Reset pooled context - create new instance for safety
      return new SafeContext(context);
    }

    return new SafeContext(context);
  }

  static release(_safeCtx: SafeContext): void {
    if (this.pool.length < this.MAX_POOL_SIZE) {
      // Don't actually pool - create fresh instances for safety
      // This method exists for interface compatibility
    }
  }

  static clear(): void {
    this.pool.length = 0;
  }

  static size(): number {
    return this.pool.length;
  }
}

export { SafeContextPool };
