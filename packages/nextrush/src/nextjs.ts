/**
 * NextRush Next.js Adapter — mount a NextRush app in a Next.js App Router
 * route handler
 *
 * Import from `nextrush/nextjs` when building an API route inside a Next.js
 * (App Router) project. This entry is a plain re-export — unlike
 * `nextrush/class`, `@nextrush/adapter-nextjs` never imports `next` at module
 * scope (its one `next/server` import, resolving `after()`, is deferred to
 * the first request), so no dynamic-import peer guard is needed here.
 *
 * @packageDocumentation
 * @module nextrush/nextjs
 *
 * @example
 * ```typescript
 * // app/api/[[...route]]/route.ts
 * import { createApp, createRouter } from 'nextrush';
 * import { handle } from 'nextrush/nextjs';
 *
 * const app = createApp();
 * const api = createRouter();
 * api.get('/hello', (ctx) => ctx.json({ message: 'Hello Next.js!' }));
 * app.route('/api', api);
 *
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
 * ```
 */

export { handle } from '@nextrush/adapter-nextjs';
export type {
  AppSource,
  NextHandlerOptions,
  NextRouteContext,
  NextRouteHandler,
  NextRouteHandlers,
  NextRouteParams,
} from '@nextrush/adapter-nextjs';
