/**
 * Registration-cost child harness — boots the class/DI path with N generated
 * controllers and reports registerControllers() wall-clock time, in a fresh
 * process per invocation so V8 JIT/GC state from one scale never leaks into
 * the next (matching the fairness discipline in scripts/lib/server.js, which
 * always spawns a fresh process per benchmark run).
 *
 * Invoked by registration-cost.js via `node registration-cost-child.js <N>`.
 * Prints a single JSON line to stdout: { n, bootMs } — nothing else, so the
 * parent can parse stdout directly without a wire protocol.
 *
 * Each generated controller is a structural clone of nextrush-v3-class.js's
 * BenchController (one @Get route, decorated the same way) — N independent
 * classes, not N copies of one class, so the DI container's per-class
 * metadata bookkeeping is exercised N times, not memoized away.
 */

import { Controller, Get, registerControllers } from '@nextrush/class';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const n = parseInt(process.argv[2], 10);
if (!Number.isFinite(n) || n < 1) {
  console.error(`Usage: node registration-cost-child.js <controllerCount>`);
  process.exit(1);
}

/** Apply Get/Controller decorators as plain function calls (see
 * nextrush-v3-class.js's header comment for why plain .js can't use
 * `@Decorator` syntax). */
function makeController(index) {
  class GeneratedController {
    ping() {
      return { ok: true, index };
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(GeneratedController.prototype, 'ping');
  Get('/ping')(GeneratedController.prototype, 'ping', descriptor);
  Controller(`/gen-${index}`)(GeneratedController);
  return GeneratedController;
}

const controllers = Array.from({ length: n }, (_, i) => makeController(i));

const app = createApp({ router: createRouter() });

const start = process.hrtime.bigint();
await registerControllers(app, { controllers });
const end = process.hrtime.bigint();

const bootMs = Number(end - start) / 1_000_000;
console.log(JSON.stringify({ n, bootMs }));
