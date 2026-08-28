/**
 * Express-bridge cost-isolation ladder server.
 *
 * A single parameterized server used ONLY by scripts/express-bridge-ladder.js.
 * LADDER_ARM selects the middleware shape:
 *
 *   native               — NextRush, single handler (compose fast path)
 *   native-noop          — + one native noop middleware (2-layer compose)
 *   native-morgan-shape  — + a native logger mimicking morgan('tiny') work
 *   bridge-noop          — + compat((req, res, next) => next())
 *   bridge-read          — + compat(mw that reads req.method/url/headers/get('host'))
 *   bridge-write         — + compat(mw that writes res.setHeader + res.statusCode)
 *   bridge-mixed         — + compat(mw that does both)
 *
 * Every arm serves byte-identical `{ message: 'Hello World' }` on `/` from the
 * shared payload module, so throughput/latency differences isolate the
 * middleware shape, not the response.
 */

import { serve } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { compat } from '@nextrush/express-bridge';
import { LISTEN_HOST } from '../config/constants.js';
import { HELLO_WORLD } from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const ARM = process.env.LADDER_ARM ?? 'native';

const app = createApp();

// ---- native NextRush middleware arms ----------------------------------------
const nativeNoop = (ctx, next) => next();

/** Approximate the work of morgan('tiny') natively: on response completion,
 *  read method/url/status/content-length, compute response time, write a line. */
const nativeMorganShape = async (ctx, next) => {
  const start = performance.now();
  await next();
  const ms = performance.now() - start;
  const raw = ctx.raw?.res;
  const len =
    typeof raw?.getHeader === 'function' ? String(raw.getHeader('content-length') ?? '-') : '-';
  process.stdout.write(`${ctx.method} ${ctx.url} ${ctx.status} ${len} - ${ms.toFixed(1)} ms\n`);
};

// ---- Express 3-arity synthetic middleware (ran through compat) ---------------
const expressNoop = (_req, _res, next) => next();
const expressRead = (req, _res, next) => {
  void req.method;
  void req.url;
  void req.headers;
  const get = req.get;
  if (typeof get === 'function') void get('host');
  next();
};
const expressWrite = (_req, res, next) => {
  res.setHeader('x-bench', '1');
  res.statusCode = 200;
  next();
};
const expressMixed = (req, res, next) => {
  void req.method;
  void req.url;
  void req.headers;
  const get = req.get;
  if (typeof get === 'function') void get('host');
  res.setHeader('x-bench', '1');
  res.statusCode = 200;
  const gh = res.getHeader;
  if (typeof gh === 'function') void gh('x-bench');
  next();
};

switch (ARM) {
  case 'native-noop':
    app.use(nativeNoop);
    break;
  case 'native-morgan-shape':
    app.use(nativeMorganShape);
    break;
  case 'bridge-noop':
    app.use(compat(expressNoop));
    break;
  case 'bridge-read':
    app.use(compat(expressRead));
    break;
  case 'bridge-write':
    app.use(compat(expressWrite));
    break;
  case 'bridge-mixed':
    app.use(compat(expressMixed));
    break;
  case 'native':
  default:
    break;
}

app.use((ctx) => ctx.json(HELLO_WORLD));

let serverInstance;
(async () => {
  serverInstance = await serve(app, { port: PORT, host: LISTEN_HOST });
  console.log(`express-bridge ladder arm '${ARM}' listening on http://${LISTEN_HOST}:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);