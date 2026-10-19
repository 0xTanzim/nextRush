/**
 * @nextrush/compression - the outgoing response compression rewrites
 *
 * A response-only middleware needs the body the adapter is about to send. Under
 * RFC-041 every shipped adapter records that body on the context, under
 * {@link OUTGOING_RESPONSE}, and flushes it once the middleware chain unwinds —
 * so one accessor covers the whole family instead of an adapter matrix.
 *
 * @remarks
 * The `raw.res` shape is kept as a fallback for a third-party adapter that still
 * exposes a buffered body. No shipped adapter uses it, and it has no way to
 * report a failed rewrite, so it is a compatibility path rather than a supported
 * one.
 *
 * @packageDocumentation
 */

import { OUTGOING_RESPONSE, type Context, type OutgoingResponseHandle } from '@nextrush/types';

/** The body compression may rewrite: a serialized response, never a request. */
export type OutgoingBody = string | Uint8Array | object;

/**
 * The outgoing response as compression sees it.
 *
 * @remarks
 * Deliberately narrow — read the body, read a header, replace the body. The
 * status and the flush belong to the adapter.
 */
export interface OutgoingResponseView {
  /** The body the adapter will send, or `null` when there is none to rewrite. */
  body(): OutgoingBody | null;

  /** The first value recorded for a field, case-insensitively. */
  header(name: string): string | undefined;

  /** Replace the body; `false` when the response can no longer be rewritten. */
  replaceBody(body: Uint8Array): boolean;
}

/** The `ctx.raw.res` shape a pre-RFC-041 adapter exposes. */
interface RawOutgoingResponse {
  body?: unknown;
  getHeader?: (name: string) => string | number | string[] | undefined;
}

/**
 * Resolve the response the adapter will flush.
 *
 * @returns The view, or `null` when the adapter exposes no outgoing response at
 *   all — the only case worth reporting, because nothing can be rewritten.
 */
export function outgoingResponseOf(ctx: Context): OutgoingResponseView | null {
  const record = ctx[OUTGOING_RESPONSE];
  if (record !== undefined) return recordView(record);

  const raw = ctx.raw?.res as RawOutgoingResponse | undefined;
  if (typeof raw?.getHeader !== 'function') return null;
  return rawView(raw);
}

function recordView(record: OutgoingResponseHandle): OutgoingResponseView {
  return {
    body: () => record.body,
    header: (name) => record.getHeader(name),
    replaceBody: (body) => record.setBody(body),
  };
}

function rawView(raw: RawOutgoingResponse): OutgoingResponseView {
  return {
    body: () => serializedBody(raw.body),
    header: (name) => firstValue(raw.getHeader?.(name)),
    replaceBody: (body) => {
      raw.body = body;
      return true;
    },
  };
}

/** Keep the serialized forms; a function or a missing body is nothing to rewrite. */
function serializedBody(body: unknown): OutgoingBody | null {
  if (typeof body === 'function' || body === undefined || body === null) return null;
  return body as OutgoingBody;
}

function firstValue(value: string | number | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value[0];
  return undefined;
}
