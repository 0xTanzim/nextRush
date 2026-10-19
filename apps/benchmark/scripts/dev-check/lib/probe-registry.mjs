// The correctness probes: one raw HTTP request each, asserting a behaviour that
// is supposed to hold end-to-end. Data plus one small predicate per probe, kept
// separate from the stage that runs them so the gate's bookkeeping check can read
// the registry without starting a server.

import { rawRequest } from './raw-http.mjs';

const parseJson = (r) => {
  try { return JSON.parse(r.body); } catch { return undefined; }
};

/** A framework error must be answered — not a hang, not an empty 200. */
const answered500 = (r) => !r.timedOut && r.status === 500;
const shape = (r) => `status=${r.status} timedOut=${r.timedOut} bytes=${r.bodyBytes}`;

/**
 * `path` is the requested target as the client wrote it, deliberately NOT
 * pre-normalised: what the runtime does to a hostile path is part of what the
 * probe is measuring.
 */
export const PROBES = [
  {
    id: 'json-bigint',
    bug: 'FB-01',
    desc: 'ctx.json({n:10n}) must answer 500 (no hang, no empty 200)',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/bigint' });
      return [answered500(r), shape(r)];
    },
  },
  {
    id: 'json-circular',
    bug: 'FB-01',
    desc: 'ctx.json(circular) must answer 500',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/circular' });
      return [answered500(r), shape(r)];
    },
  },
  {
    id: 'json-undefined',
    bug: 'FB-01',
    desc: 'ctx.json(undefined) must answer 500',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/undef' });
      return [answered500(r), shape(r)];
    },
  },
  {
    id: 'throw-masked',
    bug: null,
    desc: 'thrown Error message never reaches the client',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/boom' });
      return [r.status === 500 && !r.body.includes('secret-db-password'), `status=${r.status}`];
    },
  },
  {
    id: 'param-case-preserved',
    bug: 'FB-06',
    desc: '/users/ABC123 -> ctx.params.id === "ABC123"',
    run: async (_ctx, port) => {
      const v = parseJson(await rawRequest(port, { target: '/users/ABC123' }))?.params?.id;
      return [v === 'ABC123', `params.id=${JSON.stringify(v)}`];
    },
  },
  {
    id: 'wildcard-case-preserved',
    bug: 'FB-06',
    desc: '/files/Foo/Bar.TXT -> params["*"] keeps case',
    run: async (_ctx, port) => {
      const v = parseJson(await rawRequest(port, { target: '/files/Foo/Bar.TXT' }))?.params?.['*'];
      return [v === 'Foo/Bar.TXT', `params["*"]=${JSON.stringify(v)}`];
    },
  },
  {
    id: 'dot-segment-literal',
    bug: 'FB-04',
    desc: 'GET /files/../admin: Node/Deno 400; Bun/Edge platform-normalised (documented)',
    run: async (ctx, port) => {
      const r = await rawRequest(port, { target: '/files/../admin' });
      return [ctx.rt === 'node' ? r.status === 400 : [200, 400].includes(r.status), `status=${r.status} rt=${ctx.rt}`];
    },
  },
  {
    id: 'dot-segment-encoded',
    bug: 'FB-04',
    desc: 'GET /files/%2e%2e/admin must be 400 (Node/Deno); Bun normalises first',
    run: async (ctx, port) => {
      const r = await rawRequest(port, { target: '/files/%2e%2e/admin' });
      return [ctx.rt === 'node' ? r.status === 400 : [200, 400].includes(r.status), `status=${r.status} rt=${ctx.rt}`];
    },
  },
  {
    id: 'error-code-4xx',
    bug: 'FB-05',
    desc: 'invalid JSON -> body.code === "INVALID_JSON" (not INTERNAL_ERROR)',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, {
        method: 'POST',
        target: '/echo',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });
      return [parseJson(r)?.code === 'INVALID_JSON', `status=${r.status} code=${parseJson(r)?.code}`];
    },
  },
  {
    id: 'error-no-engine-text',
    bug: 'FB-05',
    desc: 'error message must not contain the JS engine parse text',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, {
        method: 'POST',
        target: '/echo',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });
      const m = String(parseJson(r)?.message ?? '');
      return [
        !/position \d|Parse error|Unexpected token|Expected property|Expected '/.test(m),
        `message=${JSON.stringify(m)}`,
      ];
    },
  },
  {
    id: 'unsupported-content-type',
    bug: 'FB-05',
    desc: 'POST application/xml -> 415',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, {
        method: 'POST',
        target: '/echo',
        headers: { 'content-type': 'application/xml' },
        body: '<a/>',
      });
      return [r.status === 415, `status=${r.status}`];
    },
  },
  {
    id: 'timer-header',
    bug: 'FB-03',
    desc: 'timer({exposeHeader:true}) must emit X-Response-Time',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/' });
      return [r.headers['x-response-time'] !== undefined, `x-response-time=${r.headers['x-response-time']}`];
    },
  },
  {
    id: 'server-timing-header',
    bug: 'FB-03',
    desc: 'serverTiming({exposeHeader:true}) must emit Server-Timing',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/' });
      return [r.headers['server-timing'] !== undefined, `server-timing=${r.headers['server-timing']}`];
    },
  },
  {
    id: 'compression-gzip',
    bug: 'FB-03',
    desc: 'GET /big + Accept-Encoding: gzip -> Content-Encoding: gzip',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/big', headers: { 'accept-encoding': 'gzip' } });
      return [r.headers['content-encoding'] === 'gzip', `content-encoding=${r.headers['content-encoding']} bytes=${r.bodyBytes}`];
    },
  },
  {
    id: 'not-found-shape',
    bug: null,
    desc: 'unknown route -> 404 JSON',
    run: async (_ctx, port) => {
      const r = await rawRequest(port, { target: '/nope' });
      return [r.status === 404 && parseJson(r)?.error === 'Not Found', `status=${r.status}`];
    },
  },
];

/**
 * Probes that only run on the runtime whose server they drive. Registered
 * unconditionally so the bookkeeping check can see the id on every runtime.
 */
export const PROBES_EXTRA = [{ id: 'createhandler-without-ready', bug: 'FB-02' }];

/** Every probe the gate knows about, as `{ id, bug }` — registry, not results. */
export function registry() {
  return [...PROBES.map(({ id, bug }) => ({ id, bug })), ...PROBES_EXTRA];
}
