/**
 * NextRush v2 - A modern, type-safe, and high-performance Node.js web framework
 *
 * @packageDocumentation
 * @example
 * ```typescript
 * import { createApp } from 'nextrush-v2';
 *
 * const app = createApp();
 *
 * app.use(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.path}`);
 *   await next();
 * });
 *
 * app.get('/hello', async (ctx) => {
 *   ctx.res.json({ message: 'Hello, World!' });
 * });
 *
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 */

// Core exports
export {
  createApp,
  type Application,
  type ApplicationOptions,
} from '@/core/app/application';
export { createRouter, type Router } from '@/core/router';

// Context and types
export type { Context, Middleware, Next } from '@/types/context';
export type {
  NextRushRequest as Request,
  NextRushResponse as Response,
} from '@/types/http';

// Error exports
export {
  BadRequestError,
  InternalServerError,
  NextRushError,
  NotFoundError,
  ValidationError,
} from '@/errors/custom-errors';

// Utility exports
export { joinPaths, resolvePath } from '@/utils/path-utils';
export { sanitizeInput, validateRequest } from '@/utils/validation';

// Version info
export const VERSION = '2.0.0-alpha.1';
export const NODE_VERSION = '>=18.0.0';

// Import createApp for default export
import { createApp } from '@/core/app/application';

// Default export for convenience
export default {
  createApp,
  VERSION,
  NODE_VERSION,
} as const;
