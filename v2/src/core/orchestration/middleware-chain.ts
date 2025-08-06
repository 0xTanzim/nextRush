/**
 * Middleware Chain Manager for NextRush v2
 * Handles middleware registration and execution
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@/types/context';

/**
 * Middleware Chain Manager responsible for middleware execution
 * Following Single Responsibility Principle
 */
export class MiddlewareChain {
  private middleware: Middleware[] = [];

  /**
   * Add middleware to the chain
   */
  public use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute the middleware chain
   */
  public async execute(ctx: Context): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      if (index >= this.middleware.length) {
        return;
      }

      const middleware = this.middleware[index];
      if (middleware) {
        const result = middleware(ctx, () => dispatch(index + 1));

        // Handle both sync and async middleware
        if (result instanceof Promise) {
          await result;
        }
      }
    };

    await dispatch(0);
  }

  /**
   * Get middleware chain statistics
   */
  public getStats(): {
    count: number;
    middleware: string[];
  } {
    return {
      count: this.middleware.length,
      middleware: this.middleware.map(mw => mw.name || 'anonymous'),
    };
  }

  /**
   * Clear all middleware
   */
  public clear(): void {
    this.middleware.length = 0;
  }

  /**
   * Get middleware at specific index
   */
  public getMiddleware(index: number): Middleware | undefined {
    return this.middleware[index];
  }

  /**
   * Remove middleware at specific index
   */
  public removeMiddleware(index: number): boolean {
    if (index >= 0 && index < this.middleware.length) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if middleware chain is empty
   */
  public isEmpty(): boolean {
    return this.middleware.length === 0;
  }
}
