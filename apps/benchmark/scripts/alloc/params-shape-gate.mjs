/**
 * Hot-path container shape gate.
 *
 * Asserts that every per-request key/value container the framework hands to
 * application code has V8 FAST properties, not dictionary properties. A
 * dictionary-mode object cannot inline-cache its property loads, so shipping
 * one exports a permanent deoptimization to every handler that reads
 * `ctx.params.id` or `ctx.query.q`.
 *
 * This is the gate that was missing when `Object.create(null)` was chosen: the
 * security requirement is about the PROTOTYPE CHAIN, but that primitive also
 * changes the STORAGE MODE, and nothing observed the second effect.
 *
 * Covers `@nextrush/router`, `@nextrush/runtime`, `@nextrush/body-parser`, and
 * `@nextrush/cookies`. `@nextrush/form-data`'s container (`parser.ts`'s
 * `fields`) was converted to the same base but is NOT gated here: its parser
 * takes a Web Streams `ReadableStream`, not a plain string, so it doesn't fit
 * this file's single-call-per-container pattern without a disproportionate
 * amount of stream setup for one assertion.
 *
 * Requires `--allow-natives-syntax`. Cannot live in the vitest suites: V8 flags
 * are rejected in worker-thread `execArgv`, and both configs use `pool:
 * 'threads'`.
 *
 * Run: node --allow-natives-syntax scripts/alloc/params-shape-gate.mjs
 * Exits non-zero on any violation.
 */

import { createRouter } from '../../../../packages/router/dist/index.js';
import { parseQueryString } from '../../../../packages/runtime/dist/index.js';
import { parseUrlEncoded } from '../../../../packages/middleware/body-parser/dist/index.js';
import { parseCookies } from '../../../../packages/middleware/cookies/dist/index.js';

const failures = [];

function assertFast(label, obj) {
  const fast = %HasFastProperties(obj);
  console.log(`  ${fast ? 'PASS' : 'FAIL'}  fast properties  ${label}`);
  if (!fast) failures.push(`${label} has dictionary properties`);
}

function assertNoObjectPrototype(label, obj) {
  let proto = Object.getPrototypeOf(obj);
  let reachedObjectPrototype = false;
  while (proto !== null) {
    if (proto === Object.prototype) reachedObjectPrototype = true;
    proto = Object.getPrototypeOf(proto);
  }
  const safe = !reachedObjectPrototype && obj.toString === undefined;
  console.log(`  ${safe ? 'PASS' : 'FAIL'}  Object.prototype unreachable  ${label}`);
  if (!safe) failures.push(`${label} can reach Object.prototype`);
}

console.log('\n=== ctx.params (router) ===');
const router = createRouter();
router.get('/users/:id', () => {});
router.get('/deep/:a/:b/:c', () => {});
router.get('/users/list', () => {});

const oneParam = router.match('GET', '/users/42').params;
const threeParams = router.match('GET', '/deep/1/2/3').params;
const emptyParams = router.match('GET', '/users/list').params;

assertFast('params, 1 bound param', oneParam);
assertNoObjectPrototype('params, 1 bound param', oneParam);
assertFast('params, 3 bound params', threeParams);
assertNoObjectPrototype('params, 3 bound params', threeParams);
// Read on every static-route request; a dictionary miss-read is ~2.2x slower.
assertFast('shared EMPTY_PARAMS (static-route hit)', emptyParams);
assertNoObjectPrototype('shared EMPTY_PARAMS (static-route hit)', emptyParams);

console.log('\n=== ctx.query (runtime) ===');
const oneKey = parseQueryString('q=hello');
const manyKeys = parseQueryString('a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8');
const emptyQuery = parseQueryString('');

assertFast('query, 1 key', oneKey);
assertNoObjectPrototype('query, 1 key', oneKey);
assertFast('query, 8 keys', manyKeys);
assertNoObjectPrototype('query, 8 keys', manyKeys);
assertFast('shared EMPTY_QUERY (query-less request)', emptyQuery);
assertNoObjectPrototype('shared EMPTY_QUERY (query-less request)', emptyQuery);

console.log('\n=== pollution safety must survive the optimization ===');
const polluted = createRouter();
polluted.get('/:__proto__', () => {});
const attack = polluted.match('GET', '/danger').params;
const ownKey = Object.prototype.hasOwnProperty.call(attack, '__proto__');
const notPolluted = {}.danger === undefined && Object.prototype.danger === undefined;
console.log(`  ${ownKey ? 'PASS' : 'FAIL'}  __proto__ param binds as an OWN key`);
console.log(`  ${notPolluted ? 'PASS' : 'FAIL'}  Object.prototype not mutated`);
if (!ownKey) failures.push('__proto__ param did not bind as an own key');
if (!notPolluted) failures.push('Object.prototype was polluted');

const deniedQuery = parseQueryString('__proto__=x&constructor=y&prototype=z');
const denied = Object.keys(deniedQuery).length === 0;
console.log(`  ${denied ? 'PASS' : 'FAIL'}  query denylist still rejects dangerous keys`);
if (!denied) failures.push('query denylist regressed');

console.log('\n=== body-parser urlencoded body (backlog P3) ===');
const flatBody = parseUrlEncoded('a=1&b=2&c=3');
const nestedBody = parseUrlEncoded('user[name]=Bob&user[age]=30', true);
assertFast('urlencoded body, flat', flatBody);
assertNoObjectPrototype('urlencoded body, flat', flatBody);
assertFast('urlencoded body, nested', nestedBody);
assertNoObjectPrototype('urlencoded body, nested', nestedBody);
assertNoObjectPrototype('urlencoded body, nested inner object', nestedBody.user);

console.log('\n=== cookies parseCookies (backlog P3) ===');
const cookies = parseCookies('a=1; b=2; c=3');
assertFast('parsed cookies', cookies);
assertNoObjectPrototype('parsed cookies', cookies);

if (failures.length > 0) {
  console.error(`\nSHAPE GATE FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nSHAPE GATE PASSED — every hot-path container has fast properties.\n');
