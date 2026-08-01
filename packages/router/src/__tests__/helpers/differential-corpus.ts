/**
 * @nextrush/router - Differential / characterization corpus
 *
 * Shared corpus + canonical serializer backing the golden-master regression
 * harness for the `router-match-path-allocation-trim` change. The serializer
 * reduces a `Router.match()` result to a stable, JSON-comparable shape so the
 * pre-change matcher's output (captured once into `match-golden.json`) can be
 * asserted byte-identical against the post-rewrite matcher across every trim.
 *
 * WHY a golden master rather than two live matchers: the trims land in-place on
 * a single matcher, so the "old" implementation cannot coexist with the "new"
 * one in the same process. Persisting the pre-change output as a committed
 * fixture is the standard characterization technique for exactly this — the
 * fixture IS the old matcher's behavior, frozen.
 *
 * Intentional-delta cases (null-prototype params, and `__proto__`/`constructor`/
 * `prototype` param NAMES) are deliberately NOT in this corpus — they change
 * observably by design (design.md D8) and are pinned by dedicated forward
 * scenarios instead. This corpus covers only the behavior-PRESERVING contract:
 * which route resolves, the own-enumerable param entries and their values, and
 * whether an executor is present.
 *
 * @packageDocumentation
 * @internal
 */

import type { Context, RouteHandler } from '@nextrush/types';
import { createRouter, Router } from '../../router';

/** A tagged no-op handler so a match result's `handler` is identifiable. */
function h(tag: string): RouteHandler {
  const fn = (async (_ctx: Context) => {}) as RouteHandler & { tag: string };
  fn.tag = tag;
  return fn;
}

/** A single (method, path) probe against a named route set. */
export interface Probe {
  method: string;
  path: string;
}

/** A named router plus the probes run against it. */
export interface RouteSet {
  name: string;
  build: () => Router;
  probes: Probe[];
}

/**
 * Canonical, JSON-stable serialization of one match result.
 *
 * Deliberately excludes the params [[Prototype]] from the golden diff: the
 * prototype flips from `Object.prototype` to `null` for populated params by
 * design (D8), so it is asserted as a forward invariant elsewhere, not baked
 * into the byte-identical golden. Own-enumerable key OWNERSHIP and VALUES —
 * the real behavioral contract — ARE captured here.
 */
export interface SerializedMatch {
  matched: boolean;
  handlerTag: string | null;
  params: Array<[string, string]>;
  hasExecutor: boolean;
}

/** Run one probe against a built router and reduce it to the canonical shape. */
export function serializeMatch(router: Router, method: string, path: string): SerializedMatch {
  const result = router.match(method as never, path);
  if (!result) {
    return { matched: false, handlerTag: null, params: [], hasExecutor: false };
  }
  const handler = result.handler as (RouteHandler & { tag?: string }) | undefined;
  const params = Object.keys(result.params)
    .sort()
    .map((k) => [k, result.params[k]] as [string, string]);
  return {
    matched: true,
    handlerTag: handler?.tag ?? null,
    params,
    hasExecutor: typeof result.executor === 'function',
  };
}

/**
 * The default route set: exercises static, nested static, single/nested params,
 * backtracking, static-over-param-over-wildcard precedence, wildcard (incl.
 * empty capture), and param + trailing wildcard. Case-insensitive, non-strict,
 * decode on (framework defaults).
 */
function buildDefault(): Router {
  const r = createRouter();
  r.get('/', h('root'));
  r.get('/users', h('users'));
  r.get('/users/me', h('users.me')); // static beats param
  r.get('/users/:id', h('users.id'));
  r.get('/a/b/c', h('a.b.c')); // nested static
  r.get('/a/:x/c', h('a.x.c')); // backtracking target
  r.get('/a/b/d', h('a.b.d'));
  r.get('/a/:x/b/:y', h('a.x.b.y')); // nested params
  r.get('/p/me', h('p.me')); // static > param > wildcard at one node
  r.get('/p/:id', h('p.id'));
  r.get('/p/*', h('p.star'));
  r.get('/files/*', h('files.star')); // wildcard incl. empty capture
  r.get('/g/:x/*', h('g.x.star')); // param + trailing wildcard
  r.post('/users', h('users.post')); // method variety on a static path
  return r;
}

function buildCaseSensitive(): Router {
  const r = createRouter({ caseSensitive: true });
  r.get('/Users/:id', h('cs.users.id'));
  r.get('/Static', h('cs.static'));
  return r;
}

function buildStrict(): Router {
  const r = createRouter({ strict: true });
  r.get('/strict', h('strict.static'));
  r.get('/strict/:id', h('strict.id'));
  return r;
}

function buildDecodeOff(): Router {
  const r = createRouter({ decode: false });
  r.get('/raw/:id', h('raw.id'));
  r.get('/raw/*', h('raw.star'));
  return r;
}

function buildAll(): Router {
  const r = createRouter();
  r.all('/any', h('any'));
  return r;
}

function buildPrefix(): Router {
  const r = createRouter({ prefix: '/api' });
  r.get('/health', h('api.health'));
  r.get('/items/:id', h('api.items.id'));
  return r;
}

function buildMount(): Router {
  const child = createRouter();
  child.get('/x', h('mount.x'));
  child.get('/:p', h('mount.p'));
  const parent = createRouter();
  parent.mount('/sub', child);
  return parent;
}

function buildGroup(): Router {
  const r = createRouter();
  r.group('/g', (g) => {
    g.get('/y', h('group.y'));
    g.get('/:z', h('group.z'));
  });
  return r;
}

/**
 * Backtracking-specific set. `/bt/:x/c` + `/bt/b/d` forces the walk to try the
 * static `b` branch, fail at `c`, and fall back to the param branch. `/w/:x/deep`
 * + `/w/*` is the stale-param guard: the param branch binds `:x`, fails deeper,
 * backtracks, and the wildcard must match with NO leftover `x` binding.
 */
function buildBacktrack(): Router {
  const r = createRouter();
  r.get('/bt/:x/c', h('bt.x.c'));
  r.get('/bt/b/d', h('bt.b.d'));
  r.get('/w/:x/deep', h('w.x.deep'));
  r.get('/w/*', h('w.star'));
  return r;
}

/** Every route set + its probe corpus. */
export const ROUTE_SETS: RouteSet[] = [
  {
    name: 'default',
    build: buildDefault,
    probes: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/users' },
      { method: 'GET', path: '/users/' }, // trailing slash (static, non-strict)
      { method: 'GET', path: '/users/me' }, // static beats param
      { method: 'GET', path: '/users/42' }, // param
      { method: 'GET', path: '/users/42/' }, // trailing slash (param, non-strict)
      { method: 'GET', path: '/Users/AbC' }, // non-ASCII-free cased; value keeps case
      { method: 'GET', path: '/users/a%20b' }, // percent-decoded space
      { method: 'GET', path: '/users/a%2Fb' }, // encoded slash stays in value
      { method: 'GET', path: '/users/a%2Eb' }, // encoded dot stays in value
      { method: 'GET', path: '/users/%zz' }, // malformed encoding → raw
      { method: 'GET', path: '/users/%' }, // malformed → raw
      { method: 'GET', path: '/users/%2' }, // truncated → raw
      { method: 'GET', path: '/users/\u00dcrl' }, // non-ASCII uppercase param value
      { method: 'GET', path: '/a/b/c' }, // nested static
      { method: 'GET', path: '/a/b/c/' },
      { method: 'GET', path: '/a/b/d' },
      { method: 'GET', path: '/a/b/x' }, // backtrack: static b fails at x → param :x=b
      { method: 'GET', path: '/a/1/b/2' }, // nested params
      { method: 'GET', path: '/p/me' }, // static
      { method: 'GET', path: '/p/other' }, // param
      { method: 'GET', path: '/p/a/b/c' }, // wildcard
      { method: 'GET', path: '/files/A/b/c' }, // wildcard original-case remainder
      { method: 'GET', path: '/files' }, // wildcard empty capture
      { method: 'GET', path: '/files/' }, // wildcard empty capture (trailing)
      { method: 'GET', path: '/g/1/b/c' }, // param + trailing wildcard
      { method: 'GET', path: '/users?q=1' }, // query stripped
      { method: 'GET', path: '/users/42?x=y' }, // query stripped, param
      { method: 'GET', path: '//a//b//c' }, // repeated-slash collapse
      { method: 'GET', path: '///' }, // all-slash
      { method: 'GET', path: '/nope' }, // miss
      { method: 'POST', path: '/users' }, // method variety
      { method: 'POST', path: '/users/me' }, // method-miss on known path
      { method: 'DELETE', path: '/users/42' }, // method-miss on param path
      { method: 'GET', path: `/deep/${Array.from({ length: 200 }, (_, i) => `s${i}`).join('/')}` }, // deep miss
    ],
  },
  {
    name: 'caseSensitive',
    build: buildCaseSensitive,
    probes: [
      { method: 'GET', path: '/Users/AbC' },
      { method: 'GET', path: '/users/abc' }, // lowercase miss (case-sensitive)
      { method: 'GET', path: '/Static' },
      { method: 'GET', path: '/static' }, // miss
    ],
  },
  {
    name: 'strict',
    build: buildStrict,
    probes: [
      { method: 'GET', path: '/strict' },
      { method: 'GET', path: '/strict/' }, // strict: trailing slash NOT stripped → behavior as today
      { method: 'GET', path: '/strict/42' },
      { method: 'GET', path: '/strict/42/' },
    ],
  },
  {
    name: 'decodeOff',
    build: buildDecodeOff,
    probes: [
      { method: 'GET', path: '/raw/a%20b' }, // raw, not decoded
      { method: 'GET', path: '/raw/a%2Fb' },
      { method: 'GET', path: '/raw/x/y/z' }, // wildcard raw remainder
    ],
  },
  {
    name: 'all',
    build: buildAll,
    probes: [
      { method: 'GET', path: '/any' },
      { method: 'POST', path: '/any' },
      { method: 'PUT', path: '/any' },
      { method: 'DELETE', path: '/any' },
      { method: 'PATCH', path: '/any' },
      { method: 'HEAD', path: '/any' },
      { method: 'OPTIONS', path: '/any' },
    ],
  },
  {
    name: 'prefix',
    build: buildPrefix,
    probes: [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/health' }, // miss (no prefix)
      { method: 'GET', path: '/api/items/7' },
    ],
  },
  {
    name: 'mount',
    build: buildMount,
    probes: [
      { method: 'GET', path: '/sub/x' }, // copied static
      { method: 'GET', path: '/sub/other' }, // copied param
    ],
  },
  {
    name: 'group',
    build: buildGroup,
    probes: [
      { method: 'GET', path: '/g/y' }, // group static
      { method: 'GET', path: '/g/other' }, // group param
    ],
  },
  {
    name: 'backtrack',
    build: buildBacktrack,
    probes: [
      { method: 'GET', path: '/bt/b/c' }, // static b fails at c → param :x=b matches
      { method: 'GET', path: '/bt/b/d' }, // static b/d
      { method: 'GET', path: '/bt/z/c' }, // param directly (no static z)
      { method: 'GET', path: '/w/foo/other' }, // param :x binds, fails, backtracks → wildcard, NO stale x
      { method: 'GET', path: '/w/foo/deep' }, // param :x=foo matches deep
      { method: 'GET', path: '/w/a/b/c' }, // wildcard multi-segment
    ],
  },
];

/**
 * Compute the full golden map: `"<set> <METHOD> <path>" -> SerializedMatch`.
 * Deterministic and side-effect-free (each route set is freshly built).
 */
export function computeGolden(): Record<string, SerializedMatch> {
  const out: Record<string, SerializedMatch> = {};
  for (const set of ROUTE_SETS) {
    const router = set.build();
    for (const probe of set.probes) {
      const key = `${set.name} ${probe.method} ${probe.path}`;
      out[key] = serializeMatch(router, probe.method, probe.path);
    }
  }
  return out;
}
