/**
 * Canonical response payloads shared by every benchmark server.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Fairness requires that all frameworks return byte-identical response bodies
 * for a given scenario. Hand-copying payload literals into six servers lets
 * them drift silently. Every server imports these builders so the response
 * DATA is guaranteed identical; only the framework wiring differs.
 *
 * Determinism note: `postUserResponse` intentionally contains a random id and a
 * timestamp, and the middleware `X-Timestamp` header is dynamic. The parity
 * validator normalizes those fields before comparing (see scripts/validate-parity.js).
 */

/** GET / — baseline hello world. */
export const HELLO_WORLD = Object.freeze({ message: 'Hello World' });

/** GET /json — moderate (~200 byte) object. */
export const JSON_USER = Object.freeze({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'developer',
  active: true,
});

/** GET /large-json — ~5KB array. Built once at module load (immutable). */
export const LARGE_JSON = Object.freeze(
  Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: i % 2 === 0 ? 'developer' : 'designer',
    active: i % 3 !== 0,
  }))
);

/** GET /middleware — response body after the 5-layer stack. */
export const MIDDLEWARE_BODY = Object.freeze({ middleware: true, layers: 5 });

/** GET /users/:id — route param extraction. */
export function userById(id) {
  return { id, name: `User ${id}`, email: `user${id}@example.com` };
}

/** GET /search — query parsing. Limit is clamped to 10 for a bounded payload. */
export function searchResponse(q, rawLimit) {
  const limit = Math.min(parseInt(rawLimit ?? '10', 10) || 0, 10);
  return {
    query: q ?? '',
    limit,
    results: Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q ?? ''}"`,
    })),
  };
}

/** GET /api/v1/orgs/:orgId/teams/:teamId/members/:memberId — deep route. */
export function deepRoute(orgId, teamId, memberId) {
  return { orgId, teamId, memberId };
}

/**
 * POST /users — echoes the parsed body inside a wrapper.
 * Contains a random id and an ISO timestamp (normalized by the parity check).
 */
export function postUserResponse(data) {
  return {
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * The 5 middleware-layer headers, IDENTICAL across every framework so the
 * on-the-wire byte cost of the middleware scenario is the same everywhere.
 * `value: null` means "compute Date.now() at request time" (one dynamic layer,
 * same 13-char format in all frameworks).
 *
 * X-Framework is a constant ('bench'), NOT the framework name — a per-framework
 * value would make header bytes differ and quietly bias the middleware scenario.
 */
export const MIDDLEWARE_HEADERS = Object.freeze([
  Object.freeze({ name: 'X-Request-Id', value: '12345' }),
  Object.freeze({ name: 'X-Timestamp', value: null }),
  Object.freeze({ name: 'X-Framework', value: 'bench' }),
  Object.freeze({ name: 'X-Version', value: '1.0' }),
  Object.freeze({ name: 'X-Processed', value: 'true' }),
]);

/** Resolve a middleware header's value (dynamic timestamp or static string). */
export function mwHeaderValue(header) {
  return header.value === null ? Date.now().toString() : header.value;
}

/** Error scenario body — identical shape across frameworks that customize it. */
export const ERROR_BODY = Object.freeze({ error: 'Internal Server Error' });

/** The message thrown by the /error route in every server. */
export const ERROR_MESSAGE = 'Benchmark error';
