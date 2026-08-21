/**
 * @nextrush/express-bridge - Compatibility surface definition
 *
 * Owns the frozen key sets that decide which Express APIs are overlayed,
 * which are known-unsupported (trapped with a teaching error), and which are
 * protected from prototype pollution. The candidate overlay tables are
 * confirmed or reduced by the P0 compatibility surface report.
 *
 * @packageDocumentation
 */

/** Frozen ad-hoc keys that must never project onto `ctx.state`. */
export const PROTO_DENYLIST: ReadonlySet<string | symbol> = Object.freeze(
  new Set<string | symbol>(['__proto__', 'prototype', 'constructor'])
);

/** Express request prototype APIs the bridge deliberately does not implement. */
export const UNSUPPORTED_REQUEST_API: ReadonlySet<string | symbol> = Object.freeze(
  new Set<string | symbol>([
    'accepts',
    'acceptsCharsets',
    'acceptsEncodings',
    'acceptsLanguages',
    'is',
    'range',
    'param',
    'xhr',
    'app',
  ])
);

/** Express response prototype APIs the bridge deliberately does not implement. */
export const UNSUPPORTED_RESPONSE_API: ReadonlySet<string | symbol> = Object.freeze(
  new Set<string | symbol>([
    'render',
    'download',
    'sendFile',
    'format',
    'links',
    'location',
    'vary',
  ])
);

/** Request properties the bridge maps to the NextRush context (bucket 1). */
export const REQUEST_OVERLAY: ReadonlySet<string | symbol> = Object.freeze(
  new Set<string | symbol>(['method', 'url', 'originalUrl', 'path', 'query', 'params', 'headers', 'body', 'ip', 'protocol', 'secure', 'hostname', 'cookies', 'get'])
);

/** Response properties the bridge maps to the NextRush context (bucket 1). */
export const RESPONSE_OVERLAY: ReadonlySet<string | symbol> = Object.freeze(
  new Set<string | symbol>(['status', 'statusCode', 'set', 'setHeader', 'get', 'getHeader', 'removeHeader', 'send', 'json', 'end', 'redirect', 'cookie', 'headersSent', 'locals'])
);

/**
 * Whether `key` is in the frozen proto denylist.
 */
export function isDenylisted(key: string | symbol): boolean {
  return PROTO_DENYLIST.has(key);
}

/**
 * Whether `key` is a known-unsupported Express request API.
 */
export function isUnsupportedRequestApi(key: string | symbol): boolean {
  return UNSUPPORTED_REQUEST_API.has(key);
}

/**
 * Whether `key` is a known-unsupported Express response API.
 */
export function isUnsupportedResponseApi(key: string | symbol): boolean {
  return UNSUPPORTED_RESPONSE_API.has(key);
}
