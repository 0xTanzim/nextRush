#!/usr/bin/env node

/**
 * Child of response-construction-alloc.js — measures one construction variant, for one
 * header shape, in an isolated `--expose-gc` process. Also serves the parent's output
 * equivalence check.
 *
 * The parent question is narrow: `WebResponseBuilder` allocates a `Headers` instance for
 * every request, writes the default `Content-Type` into it, and hands it to
 * `new Response(body, { status, headers })`. A Bun profile attributes 18.7 % self to
 * `Response`, but that figure covers the constructor, the header copy AND the body write.
 * This harness separates them by holding the body constant and varying only the header
 * record, so a header-record win is distinguishable from the constructor floor.
 *
 * Variants (all produce the same status, `Content-Type`, `Set-Cookie` values and body):
 *
 *  - `current`        eager `Headers` instance, as shipped
 *  - `literal`        a plain object literal per response
 *  - `shared-frozen`  one frozen literal reused across every response
 *  - `pairs`          a fresh sequence of `[name, value]` pairs per response
 *  - `json`           `Response.json(value)` — the platform serializes
 *  - `pre-serialized` `JSON.stringify` + the shared record
 *
 * Shapes:
 *
 *  - `default`    only the default `Content-Type` (the hello-world response)
 *  - `one-extra`  `Content-Type` + one application header (a request id)
 *  - `cookies`    `Content-Type` + two accumulated `Set-Cookie` values
 *
 * The `cookies` shape is what constrains the variant list. Both runtimes silently join a
 * repeated field supplied through an object literal — `{'Set-Cookie': ['a', 'b']}` becomes
 * the single header `a,b` — so `literal`, `shared-frozen` and `pre-serialized` cannot
 * reproduce two `Set-Cookie` headers. They are not measured for that shape, and the parent's
 * equivalence check enforces it rather than trusting the comment.
 *
 * Method (same as the other allocation children): warm up, force a full GC, snapshot
 * `heapUsed`, run N ops RETAINING every result so a mid-loop GC cannot reclaim what is
 * measured, snapshot again, report delta / N. This is an allocation RATE, not a byte-exact
 * object count, and it is deliberately not collected before the second snapshot: the eager
 * `Headers` instance is transient garbage that `new Response` consumes, so a collection
 * would erase exactly the cost being measured.
 *
 * The allocation figures are the primary signal. Timing is a SEPARATE non-retaining loop and
 * is secondary only: it runs with uncontrolled GC by construction, so its spread is reported
 * and the parent never gates on it. The adoption gate is the real `dev-check` in-process
 * ratio.
 *
 * Usage (invoked by the parent):
 *   node --expose-gc response-construction-alloc-child.js <variant> <shape> <N>
 *   node response-construction-alloc-child.js verify-output
 *   bun  --expose-gc response-construction-alloc-child.js <variant> <shape> <N>
 */

const CONTENT_TYPE = 'application/json; charset=utf-8';
const PAYLOAD = { message: 'Hello, World!' };
const BODY = JSON.stringify(PAYLOAD);

const SHAPES = ['default', 'one-extra', 'cookies'];

/** Shapes whose extra headers repeat a field name. */
const SHAPE_HAS_REPEATED_FIELD = { default: false, 'one-extra': false, cookies: true };

const DEFAULT_HEADERS = Object.freeze({ 'Content-Type': CONTENT_TYPE });
const ONE_EXTRA_HEADERS = Object.freeze({
  'Content-Type': CONTENT_TYPE,
  'x-request-id': 'abc-123',
});

/** The extra headers a shape adds, as `[name, value]` pairs. */
function extraHeaders(shape) {
  if (shape === 'default') return null;
  if (shape === 'one-extra') return [['x-request-id', 'abc-123']];
  return [
    ['Set-Cookie', 'a=1; Path=/'],
    ['Set-Cookie', 'b=2; Path=/'],
  ];
}

/** The shared record for a shape, for the variants that can use one. */
function sharedRecord(shape) {
  return shape === 'one-extra' ? ONE_EXTRA_HEADERS : DEFAULT_HEADERS;
}

/** Eager `Headers`, the shipped shape: one instance per response. */
function currentOp(shape) {
  const headers = new Headers();
  headers.set('Content-Type', CONTENT_TYPE);
  const extra = extraHeaders(shape);
  if (extra !== null) {
    for (const [field, value] of extra) headers.append(field, value);
  }
  return new Response(BODY, { status: 200, headers });
}

/** A plain object literal per response. Only legal when no field repeats. */
function literalOp(shape) {
  const headers = { 'Content-Type': CONTENT_TYPE };
  const extra = extraHeaders(shape);
  if (extra !== null) {
    for (const [field, value] of extra) headers[field] = value;
  }
  return new Response(BODY, { status: 200, headers });
}

/** One frozen literal, reused — no header record allocated per response. Only legal without repeats. */
function sharedFrozenOp(shape) {
  return new Response(BODY, { status: 200, headers: sharedRecord(shape) });
}

/**
 * Sequence-of-pairs init, built fresh per response.
 *
 * The one non-`Headers` form that preserves repeated fields, so the only candidate that
 * could replace `Headers` for every shape.
 */
function pairsOp(shape) {
  const headers = [['Content-Type', CONTENT_TYPE]];
  const extra = extraHeaders(shape);
  if (extra !== null) {
    for (const [field, value] of extra) headers.push([field, value]);
  }
  return new Response(BODY, { status: 200, headers });
}

/**
 * The platform serializes the value inside its own constructor.
 *
 * `Content-Type` is always passed explicitly, because `Response.json` does not default to the
 * builder's value and the two runtimes disagree on what it does default to: Node emits
 * `application/json`, Bun emits `application/json;charset=utf-8`, and the builder emits
 * `application/json; charset=utf-8`. The equivalence check caught that; without the override
 * this variant would be measured while producing different bytes.
 *
 * Extra headers go through the `headers` init option, not `response.headers.append()`.
 * Appending would mutate an already-constructed response, which the shipped builder never
 * does, and on Bun that mutation allocates enough to make `json` look more expensive than
 * `current` for no reason connected to the header record.
 */
function jsonOp(shape) {
  const headers = [['Content-Type', CONTENT_TYPE]];
  const extra = extraHeaders(shape);
  if (extra !== null) {
    for (const [field, value] of extra) headers.push([field, value]);
  }
  return Response.json(PAYLOAD, { headers });
}

/** Our own serialization, then the shared record. Only legal without repeats. */
function preSerializedOp(shape) {
  return new Response(JSON.stringify(PAYLOAD), { status: 200, headers: sharedRecord(shape) });
}

/** `requiresUniqueFields` marks a variant that cannot express a repeated header field. */
const OPS = {
  current: { op: currentOp, requiresUniqueFields: false },
  literal: { op: literalOp, requiresUniqueFields: true },
  'shared-frozen': { op: sharedFrozenOp, requiresUniqueFields: true },
  pairs: { op: pairsOp, requiresUniqueFields: false },
  json: { op: jsonOp, requiresUniqueFields: false },
  'pre-serialized': { op: preSerializedOp, requiresUniqueFields: true },
};

function isApplicable(variant, shape) {
  return !(OPS[variant].requiresUniqueFields && SHAPE_HAS_REPEATED_FIELD[shape]);
}

function forceGc() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
    return;
  }
  const bunGc = globalThis.Bun?.gc;
  if (typeof bunGc === 'function') {
    bunGc(true);
    return;
  }
  throw new Error('response-construction-alloc-child.js must run under `--expose-gc`');
}

/**
 * Compare every applicable variant against `current`, across every shape.
 *
 * A perf comparison between variants with different output is meaningless, and the
 * object-literal forms are exactly the ones at risk — both runtimes silently join a repeated
 * field. This checks observable output only: status, `Content-Type`, `Set-Cookie` values and
 * body bytes. Header *ordering* is deliberately not compared.
 */
async function verifyOutput() {
  const mismatches = [];
  let checked = 0;

  for (const variant of Object.keys(OPS)) {
    if (variant === 'current') continue;

    for (const shape of SHAPES) {
      if (!isApplicable(variant, shape)) continue;
      checked++;

      const expected = OPS.current.op(shape);
      const actual = OPS[variant].op(shape);
      const diff = compareResponses(expected, actual);
      if (diff !== null) mismatches.push({ variant, shape, diff });
    }
  }

  process.stdout.write(
    `${JSON.stringify({ equivalent: mismatches.length === 0, checked, mismatches })}\n`
  );
}

function compareResponses(expected, actual) {
  if (expected.status !== actual.status) {
    return `status ${actual.status} !== ${expected.status}`;
  }
  const expectedType = expected.headers.get('content-type');
  const actualType = actual.headers.get('content-type');
  if (expectedType !== actualType) {
    return `content-type ${actualType} !== ${expectedType}`;
  }
  const expectedCookies = expected.headers.getSetCookie();
  const actualCookies = actual.headers.getSetCookie();
  if (expectedCookies.join('|') !== actualCookies.join('|')) {
    return `set-cookie ${JSON.stringify(actualCookies)} !== ${JSON.stringify(expectedCookies)}`;
  }
  return null;
}

function warmup(op) {
  for (let i = 0; i < 5_000; i++) op();
}

/**
 * Bytes allocated per response, over a retaining loop.
 *
 * Retaining every response is deliberate: it stops a scavenge from reclaiming the record
 * mid-window, which is what makes the delta attributable to the construction.
 *
 * There is deliberately NO collection before the second snapshot. The quantity of interest
 * is allocation RATE — the eager `Headers` instance is transient garbage that `new Response`
 * consumes, so it never appears in retained footprint at all. Collecting first would erase
 * exactly the cost this harness exists to measure. That is the same method as
 * `web-context-alloc-child.js` and `handler-alloc-child.js`; `--max-semi-space-size` keeps
 * the young generation large enough that no scavenge fires mid-window.
 *
 * The `MEASURE_START` / `MEASURE_END` markers bracket the loop so the parent can count
 * collections that fired inside it from `--trace-gc`. They go to stderr; the result goes to
 * stdout, so the two never interleave.
 */
function measureAllocation(op, N) {
  forceGc();
  forceGc();
  const before = process.memoryUsage();

  process.stderr.write('MEASURE_START\n');

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = op();
  }

  process.stderr.write('MEASURE_END\n');

  const after = process.memoryUsage();

  // Touch every response so none can be optimized away or collected early.
  let sink = 0;
  for (let i = 0; i < N; i++) {
    if (retained[i].status === 200) sink++;
  }

  return {
    bytesPerOp: (after.heapUsed - before.heapUsed) / N,
    externalBytesPerOp: (after.external - before.external) / N,
    heapDelta: after.heapUsed - before.heapUsed,
    sink,
  };
}

/**
 * Nanoseconds per response, over a non-retaining loop.
 *
 * Non-retaining on purpose: this is a latency figure, and retaining N responses would
 * measure the collector instead. The loop therefore collects garbage as it goes, so this
 * figure carries GC cost that the allocation measurement deliberately excludes — hence it
 * is reported with its spread and never used as the gate. `sink` defeats dead-code
 * elimination.
 */
function measureTiming(op, N) {
  const iterations = Math.max(N, 20_000);
  for (let i = 0; i < 2_000; i++) op();

  let sink = 0;
  const started = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    sink += op().status;
  }
  const elapsed = Number(process.hrtime.bigint() - started);

  return { nsPerOp: elapsed / iterations, iterations, sink };
}

async function main() {
  const variant = process.argv[2] ?? 'current';

  if (variant === 'verify-output') {
    await verifyOutput();
    return;
  }

  const shape = process.argv[3] ?? 'default';
  const N = Number.parseInt(process.argv[4] ?? '20000', 10);

  if (OPS[variant] === undefined) {
    throw new Error(`unknown variant "${variant}"; expected one of ${Object.keys(OPS).join(', ')}`);
  }
  if (!SHAPES.includes(shape)) {
    throw new Error(`unknown shape "${shape}"; expected one of ${SHAPES.join(', ')}`);
  }
  if (!isApplicable(variant, shape)) {
    throw new Error(
      `variant "${variant}" cannot reproduce the "${shape}" shape: an object literal cannot ` +
        `carry a repeated header field, so its output would differ from the shipped builder`
    );
  }

  const op = () => OPS[variant].op(shape);

  warmup(op);
  const allocation = measureAllocation(op, N);
  const timing = measureTiming(op, N);

  process.stdout.write(
    `${JSON.stringify({
      variant,
      shape,
      N,
      runtime: globalThis.Bun === undefined ? 'node' : 'bun',
      bytesPerOp: allocation.bytesPerOp,
      externalBytesPerOp: allocation.externalBytesPerOp,
      heapDelta: allocation.heapDelta,
      nsPerOp: timing.nsPerOp,
      iterations: timing.iterations,
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(String(error?.stack ?? error) + '\n');
  process.exit(1);
});
