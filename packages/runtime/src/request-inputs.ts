/**
 * @nextrush/runtime — lazily resolved per-request inputs for a Web context.
 *
 * @remarks
 * Two request inputs are expensive enough that a handler which never reads them
 * should not pay for them: the incoming-header record (a walk over every header)
 * and the client address (a platform call, or proxy-header resolution). Both are
 * therefore resolved on first read and memoized here, in one small holder, so
 * the context class stays a shell of response methods rather than growing two
 * more accessor bodies.
 *
 * Extracted rather than inlined also because this is the part worth unit-testing
 * directly: the counting-request tests assert the absence of work, which is only
 * meaningful against a holder that owns the platform objects.
 *
 * @packageDocumentation
 */

import type { IncomingHeaders } from '@nextrush/types';
import type { Request } from '@nextrush/types';
import { headersToRecord } from './headers';

/**
 * A resolved client address, or a resolver called on the first `ip` read.
 *
 * @remarks
 * Adapters resolve the address from a platform call (Bun's `server.requestIP`,
 * Deno's `remoteAddr`) or from proxy headers. Handing over a resolver instead of
 * a string keeps that work off the request path for the majority of handlers
 * that never look at `ip`. A plain string stays accepted so a caller that
 * already knows the address pays nothing.
 */
export type ClientAddress = string | (() => string);

/** Lazily resolved, memoized request inputs. */
export class RequestInputs {
  /** Memoized incoming-header record; built on first `headers` read. */
  private record?: IncomingHeaders;
  /** Memoized resolved address; filled on first `ip` read. */
  private resolvedAddress?: string;

  constructor(
    private readonly request: Request,
    private readonly address: ClientAddress
  ) {}

  /**
   * Incoming request headers, as a record.
   *
   * @remarks
   * Shape is unchanged from the eager field this replaces: prototype-less
   * (nothing inherited is reachable), lower-case keys, `set-cookie` kept as an
   * array when the platform exposes the separated entries.
   */
  get headers(): IncomingHeaders {
    return (this.record ??= headersToRecord(this.request.headers));
  }

  /**
   * Read one incoming header.
   *
   * @remarks
   * Reads the platform headers directly unless the record already exists, so a
   * single-name read costs one lookup instead of the full walk. Case folding is
   * the platform's (`Headers.get` is case-insensitive). `set-cookie` keeps the
   * record's "first value" semantics by asking the platform for the separated
   * entries where it can — `Headers.get` would comma-join them.
   */
  get(name: string): string | undefined {
    const lower = name.toLowerCase();
    const record = this.record;
    if (record === undefined) {
      const headers = this.request.headers;
      if (lower === 'set-cookie') {
        const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
        if (typeof getSetCookie === 'function') return getSetCookie.call(headers)[0];
      }
      return headers.get(lower) ?? undefined;
    }
    const value = record[lower];
    return Array.isArray(value) ? value[0] : value;
  }

  /** The client address; a lazily-supplied one is resolved exactly once. */
  get ip(): string {
    return (this.resolvedAddress ??=
      typeof this.address === 'string' ? this.address : this.address());
  }
}
