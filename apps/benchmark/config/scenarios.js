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
];

/** Subset for the quick profile. */
export const QUICK_SCENARIOS = ['hello-world', 'route-params', 'post-json', 'middleware-stack'];

/** Get scenario by ID. */
export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id);
}
