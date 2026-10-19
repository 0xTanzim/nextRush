// Which adapter an in-proc row exercises.
//
// The in-proc rows must exercise the adapter for the runtime under test. On Node
// the Web runner is a different code path from `createHandler`/node:http, so a row
// labelled for the runtime must not quietly measure the Web adapter there — a
// number produced by the wrong adapter answers a question nobody asked. Each row
// prints the adapter and runtime it exercised, and `check.mjs` reports that line,
// so the table cannot imply otherwise.
import { createHandler as createBunHandler } from '@nextrush/adapter-bun';
import { createHandler as createDenoHandler } from '@nextrush/adapter-deno';
import { createHandler as createNodeHandler } from '@nextrush/adapter-node';
import type { Application } from '@nextrush/core';
import { nodeRequest, type NodeShape } from './_inproc-node';

const onDeno = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined';
const onBun = !onDeno && typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

/** The adapter package the current runtime's rows exercise. */
export const adapterLabel = onDeno ? 'adapter-deno' : onBun ? 'adapter-bun' : 'adapter-node';
/** The runtime those rows run on. */
export const runtimeLabel = onDeno ? 'deno' : onBun ? 'bun' : 'node';

const SERVER = { requestIP: () => ({ address: '1.1.1.1' }) } as never;

export interface Shape extends NodeShape {
  /** `0` disables the handler timeout, matching the `TIMEOUT=0` control. */
  timeoutMs?: number;
}

/**
 * Build one dispatch through the adapter for the runtime under test.
 *
 * @param prebuild - Reuse this many constructed requests instead of building one
 * per iteration. For a request with a body, constructing it is platform cost that
 * dwarfs the framework work and turns the profile into an attribution of the
 * harness; the Node arm's stand-in is a plain object, so it does not need this.
 * A body-bearing entry must prebuild `warmup + count`: a `Request` body is
 * single-use, so a warmup request cannot be timed again.
 */
export function prepare(app: Application, shape: Shape, prebuild = 0): (i: number) => unknown {
  const options = shape.timeoutMs === 0 ? { timeout: 0 } : {};

  if (!onBun && !onDeno) {
    return nodeRequest(createNodeHandler(app, options), shape);
  }

  const handle = onDeno ? createDenoHandler(app, options) : createBunHandler(app, options);
  const info = onDeno
    ? { remoteAddr: { hostname: '1.1.1.1', port: 1 } }
    : SERVER;
  const make = (): Request =>
    new Request(`http://localhost:3000${shape.path}`, {
      method: shape.body === undefined ? 'GET' : 'POST',
      headers: shape.headers,
      ...(shape.body === undefined ? {} : { body: shape.body }),
    });

  if (prebuild > 0) {
    const requests = Array.from({ length: prebuild }, make);
    return (i) => handle(requests[i % prebuild] as Request, info as never);
  }
  return () => handle(make(), info as never);
}

/** The status a dispatch produced, on either arm. */
export function statusOf(result: unknown): number {
  if (typeof result === 'number') return result;
  const status = (result as { status?: unknown }).status;
  return typeof status === 'number' ? status : 0;
}

/** Warm up, then time `count` dispatches and print the row and what it used. */
export async function runInproc(
  dispatch: (i: number) => unknown,
  count: number,
  warmup: number,
  framework?: string
): Promise<void> {
  for (let i = 0; i < warmup; i++) await dispatch(i);
  const started = performance.now();
  for (let i = warmup; i < warmup + count; i++) await dispatch(i);
  const perRequest = ((performance.now() - started) / count) * 1000;
  console.log(`US=${perRequest.toFixed(3)}`);
  if (framework) console.log(`FRAMEWORK=${framework} RUNTIME=${runtimeLabel}`);
  else console.log(`ADAPTER=${adapterLabel} RUNTIME=${runtimeLabel}`);
}
