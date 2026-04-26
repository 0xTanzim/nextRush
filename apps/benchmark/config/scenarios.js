/**
 * Test scenario definitions.
 *
 * Each scenario targets a specific framework capability.
 * All servers MUST implement every endpoint.
 */

export const SCENARIOS = [
  {
    id: 'hello-world',
    name: 'Hello World',
    method: 'GET',
    path: '/',
    description: 'Baseline framework overhead — minimal JSON response',
    category: 'baseline',
  },
  {
    id: 'json-serialize',
    name: 'JSON Serialization',
    method: 'GET',
    path: '/json',
    description: 'JSON serialization performance with moderate payload (~200 bytes)',
    category: 'serialization',
  },
  {
    id: 'route-params',
    name: 'Route Parameters',
    method: 'GET',
    path: '/users/12345',
    description: 'Router parameter extraction from radix tree',
    category: 'routing',
  },
  {
    id: 'query-string',
    name: 'Query Strings',
    method: 'GET',
    path: '/search?q=benchmark&limit=10',
    description: 'Query string parsing performance',
    category: 'parsing',
  },
  {
    id: 'post-json',
    name: 'POST JSON',
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
    description: 'Request body parsing + JSON response',
    category: 'parsing',
  },
  {
    id: 'deep-route',
    name: 'Deep Route',
    method: 'GET',
    path: '/api/v1/orgs/123/teams/456/members/789',
    description: 'Deep parameterized route — radix tree depth performance',
    category: 'routing',
  },
  {
    id: 'middleware-stack',
    name: 'Middleware Stack',
    method: 'GET',
    path: '/middleware',
    description: 'Request through 5 middleware layers — per-middleware overhead',
    category: 'middleware',
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    method: 'GET',
    path: '/error',
    description: 'Error throw + catch pipeline (expects 500 response)',
    category: 'error',
    expectStatus: 500,
  },
  {
    id: 'large-json',
    name: 'Large JSON',
    method: 'GET',
    path: '/large-json',
    description: 'Large payload serialization (~5KB JSON array)',
    category: 'serialization',
  },
  {
    id: 'empty-response',
    name: 'Empty Response',
    method: 'GET',
    path: '/empty',
    description: 'Absolute minimum — 204 No Content, zero serialization',
    category: 'baseline',
  },
];

/** Subset for quick profile */
export const QUICK_SCENARIOS = ['hello-world', 'route-params', 'post-json', 'middleware-stack'];

/** Get scenario by ID */
export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id);
}
