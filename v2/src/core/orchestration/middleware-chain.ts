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
  private composed: ((ctx: Context) => Promise<void>) | undefined;
  private isDirty = true;

  /**
   * Add middleware to the chain
   */
  public use(middleware: Middleware): void {
    this.middleware.push(middleware);
    // Invalidate composed cache when the chain changes
    this.isDirty = true;
    this.composed = undefined;
  }

  /**
   * Execute the middleware chain
   */
  public async execute(ctx: Context): Promise<void> {
    // Compose once and reuse until the chain changes
    if (this.isDirty || !this.composed) {
      this.composed = this.compose(this.middleware);
      this.isDirty = false;
    }

    await this.composed(ctx);
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
    this.composed = undefined;
    this.isDirty = true;
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
      this.composed = undefined;
      this.isDirty = true;
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

  /**
   * Compose middleware array into a single callable function
   * using a Koa-like composition strategy. This is executed
   * only when the chain changes to avoid per-request overhead.
   */
  private compose(middleware: Middleware[]): (ctx: Context) => Promise<void> {
    // Defensive copy to avoid mutation issues
    const chain = middleware.slice();

    return async function run(ctx: Context): Promise<void> {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;

        const fn = chain[i];
        if (!fn) return;

        const result = fn(ctx, () => dispatch(i + 1));
        if (result instanceof Promise) {
          await result;
        }
      };

      await dispatch(0);
    };
  }
}
