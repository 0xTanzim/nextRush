/**
 * @nextrush/router — handler return-value settlement (RFC-050).
 *
 * Central place that turns a handler's resolved return value into a response,
 * shared by the route dispatch executor and the class runtime so both produce
 * the same bytes for the same value. The `void` contract is unchanged:
 * `undefined` settles nothing.
 *
 * @internal — exported for `@nextrush/class`; not part of the semver-covered
 * public surface.
 */

import type { Context, NodeStreamLike } from '@nextrush/types';

/** The value kinds `ctx.send` writes verbatim, byte for byte. */
type BinaryOrStream = Uint8Array | ArrayBuffer | ReadableStream | NodeStreamLike;

/**
 * Settle `value` into `ctx`, unless the handler already committed a response.
 *
 * @remarks
 * Order is deliberate (first match wins): `undefined` (nothing, the documented
 * `void` contract), a committed response (the handler already answered),
 * `Response` (adopt), `string`, binary/stream, `null` (JSON `null`), object or
 * array (JSON), other primitives (string form).
 *
 * @returns A promise only when the settlement itself is asynchronous — a
 *   returned `Response` whose body must be read. Otherwise `undefined`, so the
 *   caller can keep its synchronous fast path.
 */
export function settleHandlerReturn(ctx: Context, value: unknown): void | Promise<void> {
  if (value === undefined || ctx.responded) return;

  if (value instanceof Response) return adoptResponse(ctx, value);
  if (typeof value === 'string') {
    ctx.send(value);
    return;
  }
  if (isBinaryOrStream(value)) {
    ctx.send(value);
    return;
  }
  if (value === null) {
    ctx.json(null);
    return;
  }
  if (typeof value === 'object') {
    ctx.json(value);
    return;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    ctx.send(String(value));
    return;
  }
  // A function is the only remaining kind, and it is not a payload. The JSON path
  // turns it into the runtime's actionable serialization error instead of
  // `String(value)` echoing its source text to the client.
  ctx.json(value);
}

/**
 * Copy a returned `Response` onto the context: status first (so the recorded
 * response flushes it), then headers — `Set-Cookie` as a multi-value field —
 * then the body as bytes, so an explicit header still beats the body method's
 * default `Content-Type`.
 */
function adoptResponse(ctx: Context, response: Response): void | Promise<void> {
  ctx.status = response.status;

  const cookies: string[] = [];
  if (typeof response.headers.getSetCookie === 'function') {
    cookies.push(...response.headers.getSetCookie());
  }
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') {
      if (cookies.length === 0) cookies.push(value);
      return;
    }
    ctx.set(name, value);
  });
  if (cookies.length > 0) ctx.set('set-cookie', cookies);

  if (response.body === null) {
    ctx.send(null);
    return;
  }
  return response.arrayBuffer().then((buffer) => {
    ctx.send(new Uint8Array(buffer));
  });
}

function isBinaryOrStream(value: unknown): value is BinaryOrStream {
  return (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    value instanceof ReadableStream ||
    isNodeReadable(value)
  );
}

/** Mirrors `@nextrush/runtime`'s readable detection: pipe plus async iteration. */
function isNodeReadable(value: unknown): value is NodeStreamLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NodeStreamLike).pipe === 'function' &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}
