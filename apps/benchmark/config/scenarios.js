/**
 * Test scenario definitions.
 *
 * Each scenario targets a specific framework capability. All servers implement
 * every endpoint and (except where noted) return byte-identical response bodies
 * built from servers/_shared/payloads.js.
 *
 * `expectStatus` drives non-2xx handling in the runner: for a success scenario,
 * any non-2xx response invalidates the run; the error scenario expects 500.
 */

/**
 * A request body at or above 1MB for the `large-post` scenario, built once at
 * module load (same pattern as `LARGE_JSON` below) rather than per-request —
 * a fixed JSON array of small objects, sized comfortably past the 1MB floor
 * (target ~1.5MB) so the scenario isn't a coin-flip against a parser's exact
 * default limit (`@nextrush/body-parser`'s default JSON limit is exactly
 * 1MB — every server's route for this scenario configures a higher limit
 * explicitly rather than relying on a default sized right at the boundary).
 */
function buildLargePostBody() {
  const items = [];
  let size = 0;
  let i = 0;
  const target = 1_572_864; // 1.5 MiB
  while (size < target) {
    const item = { id: i, name: `item-${i}`, value: 'x'.repeat(50) };
    items.push(item);
    size += JSON.stringify(item).length + 1; // +1 for the array separator
    i++;
  }
  return JSON.stringify({ items });
}

const LARGE_POST_BODY = buildLargePostBody();

export const SCENARIOS = [
  {
    id: 'hello-world',
    name: 'Hello World',
    method: 'GET',
    path: '/',
    expectStatus: 200,
    description: 'Baseline framework overhead — minimal JSON response',
    category: 'baseline',
    identicalWork: true,
  },
  {
    id: 'json-serialize',
    name: 'JSON Serialization',
    method: 'GET',
    path: '/json',
    expectStatus: 200,
    description: 'JSON serialization performance with moderate payload (~200 bytes)',
    category: 'serialization',
    identicalWork: true,
  },
  {
    id: 'route-params',
    name: 'Route Parameters',
    method: 'GET',
    path: '/users/12345',
    expectStatus: 200,
    description: 'Router parameter extraction',
    category: 'routing',
    identicalWork: true,
  },
  {
    id: 'query-string',
    name: 'Query Strings',
    method: 'GET',
    path: '/search?q=benchmark&limit=10',
    expectStatus: 200,
    description: 'Query string parsing performance',
    category: 'parsing',
    identicalWork: true,
  },
  {
    id: 'post-json',
    name: 'POST JSON',
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
    expectStatus: 200,
    description: 'Request body parsing + JSON response',
    category: 'parsing',
    // Body contains a random id + timestamp — bodies are equal after normalization.
    identicalWork: true,
    // The random id's digit count varies (1-4 digits), so byte-identical work does
    // not guarantee byte-identical Content-Length — only the framing MECHANISM
    // (fixed-length vs. chunked) is checked for parity, not the exact byte count.
    variableLength: true,
  },
  {
    id: 'deep-route',
    name: 'Deep Route',
    method: 'GET',
    path: '/api/v1/orgs/123/teams/456/members/789',
    expectStatus: 200,
    description: 'Deep parameterized route',
    category: 'routing',
    identicalWork: true,
  },
  {
    id: 'middleware-stack',
    name: 'Middleware Stack',
    method: 'GET',
    path: '/middleware',
    expectStatus: 200,
    description:
      '5 idiomatic middleware/hook layers, each setting one identical response header. ' +
      'Mechanisms differ per framework (Koa/Express/Hono/NextRush middleware chains, ' +
      'Fastify onRequest hooks, raw-node a manual function chain) — this measures each ' +
      "framework's own 5-layer dispatch cost, NOT an identical mechanism.",
    category: 'middleware',
    // Mechanisms differ by design — this is per-framework idiomatic, not like-for-like.
    identicalWork: false,
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    method: 'GET',
    path: '/error',
    expectStatus: 500,
    description:
      'Uncaught throw routed through each framework\'s idiomatic error handler (raw-node ' +
      'uses a local catch — it has no pipeline). Returns 500. Mechanisms differ.',
    category: 'error',
    identicalWork: false,
  },
  {
    id: 'large-json',
    name: 'Large JSON',
    method: 'GET',
    path: '/large-json',
    expectStatus: 200,
    description: 'Large payload serialization (~5KB JSON array)',
    category: 'serialization',
    identicalWork: true,
  },
  {
    id: 'empty-response',
    name: 'Empty Response',
    method: 'GET',
    path: '/empty',
    expectStatus: 204,
    description: 'Absolute minimum — 204 No Content, zero serialization',
    category: 'baseline',
    identicalWork: true,
  },
  {
    id: 'send-object',
    name: 'Send Object',
    method: 'GET',
    path: '/send-object',
    expectStatus: 200,
    description:
      'Dispatches a plain object through each framework\'s own response-serialization ' +
      'helper (not a pre-serialized string) — the general object-dispatch code path ' +
      'named by the performance reconciliation report\'s Rec 11 / F-09',
    category: 'serialization',
    identicalWork: true,
  },
  {
    id: 'static-file',
    name: 'Static File',
    method: 'GET',
    path: '/static/bench.txt',
    expectStatus: 200,
    description:
      "Serves a small static file through each framework's own static-file middleware. " +
      'Header-set divergence across frameworks (accept-ranges, cache-control, etag, ' +
      "last-modified are present in some servers and not others) means this is each framework's " +
      'own idiomatic mechanism, not verified byte-identical work — like `middleware-stack` and ' +
      '`error-handling`, it is scored separately rather than folded into the headline score.',
    category: 'static',
    identicalWork: false,
  },
  {
    id: 'large-post',
    name: 'Large POST Body',
    method: 'POST',
    path: '/large-post',
    headers: { 'Content-Type': 'application/json' },
    body: LARGE_POST_BODY,
    expectStatus: 200,
    description:
      'A request body at or above 1MB — measures body-parsing/response cost at a size ' +
      'distinct from the existing smaller `post-json` scenario (Rec 11)',
    category: 'parsing',
    identicalWork: true,
    variableLength: true,
    // A 1.5MiB body queues past wrk's 2s default socket timeout well below a
    // publishable profile's top concurrency (measured: 17-25 timeouts in 5s at
    // 64 connections on EVERY framework), and one socket timeout makes the whole
    // run non-publishable. At this size the cell is bandwidth/JSON.parse-bound
    // anyway — ~230 MB/s of loopback ingest, where framework dispatch is noise —
    // so measuring it at high concurrency buys nothing and costs the gate.
    maxConnections: 8,
  },
];

/** Subset for the quick profile. */
export const QUICK_SCENARIOS = ['hello-world', 'route-params', 'post-json', 'middleware-stack'];

/** Get scenario by ID. */
export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id);
}
