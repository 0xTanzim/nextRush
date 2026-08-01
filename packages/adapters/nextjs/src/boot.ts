/**
 * @nextrush/adapter-nextjs - Boot
 *
 * Memoizes the {@link AppSource} → `Application` resolution once per
 * `handle()` call, and resolves Next's `after()` once as a capability probe
 * (RFC-024 §8.3) — never a runtime-identity check. `next` stays an optional
 * peer: when `next/server` cannot be imported, `after` resolves to
 * `undefined` and callers degrade to their existing no-op contract.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';

/** An app, or a (possibly async) factory producing one. */
export type AppSource = Application | (() => Application | Promise<Application>);

function isFactory(source: AppSource): source is () => Application | Promise<Application> {
  return typeof source === 'function';
}

/**
 * Memoize an {@link AppSource} into a single resolved `Application`.
 *
 * @remarks
 * A factory that throws is not memoized as failed — the next call re-invokes
 * it, so a transient boot failure does not permanently poison the handler
 * (RFC-024 §8.7).
 */
export function memoizeAppSource(source: AppSource): () => Promise<Application> {
  if (!isFactory(source)) {
    const app = source;
    return () => Promise.resolve(app);
  }

  let cached: Promise<Application> | undefined;
  return (): Promise<Application> => {
    cached ??= Promise.resolve(source()).catch((err: unknown) => {
      cached = undefined;
      throw err;
    });
    return cached;
  };
}

/** The shape of Next's `after` export, probed structurally so `next` need not be installed. */
export type AfterFn = (task: () => void | Promise<void>) => void;

let afterPromise: Promise<AfterFn | undefined> | undefined;

/**
 * Resolve `next/server`'s `after()` once, caching the result (including a
 * negative result) for the lifetime of the process.
 */
export function resolveAfter(): Promise<AfterFn | undefined> {
  afterPromise ??= import('next/server')
    .then((mod: unknown) => {
      const candidate = (mod as { after?: unknown }).after;
      return typeof candidate === 'function' ? (candidate as AfterFn) : undefined;
    })
    .catch(() => undefined);
  return afterPromise;
}
