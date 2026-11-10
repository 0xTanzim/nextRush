/**
 * @nextrush/runtime - AppSource Memoization
 *
 * Memoizes an {@link AppSource} into an async resolver function.
 * Enables serverless and edge adapters to accept an async application factory,
 * allowing asynchronous initialization (controller registration, async config, DB setup)
 * to run on the first incoming request rather than at module evaluation scope.
 *
 * This completely eliminates the need for top-level `await` in serverless entrypoints,
 * preventing `ERR_REQUIRE_ASYNC_MODULE` crashes in AWS Lambda and Vercel Node runtimes.
 *
 * @packageDocumentation
 */

import type { AppSource } from '@nextrush/types';

/**
 * Determine if an AppSource is a factory function.
 */
function isFactory<TApp>(source: AppSource<TApp>): source is () => TApp | Promise<TApp> {
  return typeof source === 'function';
}

/**
 * Memoize an {@link AppSource} into a single resolved application promise.
 *
 * @remarks
 * A factory that throws during boot is NOT permanently cached as failed — the next
 * invocation re-attempts resolution so transient cold-start failures do not poison
 * the serverless container.
 *
 * @typeParam TApp - The application instance type.
 * @param source - An application instance or an async factory returning one.
 * @returns A zero-argument function returning a Promise resolving to the application.
 */
export function memoizeAppSource<TApp>(source: AppSource<TApp>): () => Promise<TApp> {
  if (!isFactory(source)) {
    const app = source;
    return () => Promise.resolve(app);
  }

  let cached: Promise<TApp> | undefined;
  return (): Promise<TApp> => {
    cached ??= Promise.resolve(source()).catch((err: unknown) => {
      cached = undefined;
      throw err;
    });
    return cached;
  };
}
