/**
 * @nextrush/body-parser - Deferred Reader Installation (RFC-047)
 *
 * @remarks
 * In lazy mode the parser does not read; it installs a reader the context's
 * `readBody()` delegates to. Everything the eager path does (byte acquisition,
 * size limits, `verify`, decode, parse, depth guard) still happens — once, the
 * first time the application asks for the body.
 *
 * The reader is one per request and holds three states: unset, in-flight, and
 * settled (value or error). That single slot is what makes concurrent
 * `readBody()` calls safe: the single-consumption body source is never drained
 * twice, and a rejected read cannot be retried into a different outcome.
 *
 * @packageDocumentation
 */

import { BODY_READER, type BodyReaderCarrier, type DeferredBodyReader } from '@nextrush/types';

import { Errors } from './errors.js';
import type { BodyParserContext } from './types.js';

/** Reads, validates and parses the body once. Supplied by the owning parser. */
export type BodyReadFn = () => Promise<unknown>;

/**
 * Install a deferred reader on the context and make `ctx.body` fail loudly
 * until it resolves.
 *
 * @param ctx - Request context the parser claimed
 * @param read - Performs the delegated read/parse and returns the parsed value
 *
 * @remarks
 * Only the first parser to claim a request installs a reader; a second lazy
 * parser seeing the slot already filled leaves it alone, so registration order
 * decides ownership exactly as it does in eager mode.
 *
 * `ctx.body` becomes an own accessor that throws `BODY_NOT_READ` while unset and
 * re-throws the read's own error after a failed read. A write to `ctx.body`
 * (the router, the respond-early middlewares) marks the body resolved, so
 * existing framework writes keep their meaning. The accessor is an own property
 * on this one context, which keeps every eager-mode context free of both the
 * extra field and the hidden-class transition.
 */
export function installLazyReader(ctx: BodyParserContext, read: BodyReadFn): void {
  const carrier = ctx as BodyParserContext & BodyReaderCarrier;
  if (carrier[BODY_READER] !== undefined) return;

  let promise: Promise<unknown> | undefined;
  let settled = false;
  let value: unknown;
  let failure: unknown;
  let failed = false;
  // A write to `ctx.body` (validation's coerced body, the router's or CORS's
  // empty body) is newer than any read that was already in flight. The write
  // bumps the generation, and a read that resolves afterwards must not
  // overwrite it.
  let generation = 0;

  const reader: DeferredBodyReader = {
    read<T = unknown>(): Promise<T> {
      if (settled) return Promise.resolve(value) as Promise<T>;
      if (failed) return Promise.reject(failure);
      if (promise !== undefined) return promise as Promise<T>;

      const start = generation;
      const pending = read().then(
        (result) => {
          if (generation === start) {
            settled = true;
            value = result;
          }
          return result;
        },
        (err: unknown) => {
          if (generation === start) {
            failed = true;
            failure = err;
          }
          throw err;
        }
      );
      promise = pending;
      return pending as Promise<T>;
    },
  };

  // A plain store, not `defineProperty`: this slot is new on every context, so
  // there is no descriptor to override, and the install runs on every lazy
  // request. The measured difference is part of the read-path regression
  // budget (RFC-047 §14).
  (carrier as { [BODY_READER]?: DeferredBodyReader })[BODY_READER] = reader;

  // The `body` accessor must replace the existing data property, which is why
  // this one does need `defineProperty`.
  Object.defineProperty(ctx, 'body', {
    configurable: true,
    enumerable: true,
    get(): unknown {
      if (settled) return value;
      if (failed) throw failure;
      throw Errors.bodyNotRead();
    },
    set(next: unknown): void {
      generation += 1;
      settled = true;
      value = next;
      failed = false;
      failure = undefined;
      // The written value is authoritative: a later `readBody()` must return it
      // instead of the (possibly already consumed) stream's parse.
      promise = undefined;
    },
  });
}

/**
 * Whether the request already has a parsed body, without tripping the lazy
 * accessor.
 *
 * @remarks
 * Parser detection uses this instead of `ctx.body !== undefined`. In lazy mode
 * the body is unread at detection time, and a plain read would throw
 * `BODY_NOT_READ` — turning the "a previous parser already handled this"
 * short-circuit into a failure.
 */
export function hasResolvedBody(ctx: BodyParserContext): boolean {
  // A filled slot is the claim: the parser that installed the reader owns this
  // request, whether or not the application ever reads it. Asking
  // `hasValue()` would report "not handled" until the read completes, letting a
  // second parser consume a stream the reader still holds.
  if ((ctx as BodyParserContext & BodyReaderCarrier)[BODY_READER] !== undefined) return true;
  return ctx.body !== undefined;
}
