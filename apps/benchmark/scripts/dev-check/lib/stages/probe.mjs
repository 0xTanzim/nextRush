// Correctness-probe stage. Every probe runs against one real server, so the
// probes observe the same thing a client would; a probe that fails is a FAIL
// unless its bug id is a declared exemption for this runtime, in which case it is
// reported as KNOWN with the observation intact (the defect stays visible, the
// build stays green until it is fixed).

import { rawRequest } from '../raw-http.mjs';
import { findStaleExemptions } from '../known-failures.mjs';
import { PROBES, registry } from '../probe-registry.mjs';

const PROBE_PORT = 4390;
const CREATEHANDLER_PORT = 4391;

export async function stageProbe(ctx) {
  const failingBugs = [];

  const { out } = ctx.build('probe-server', ctx.target);
  await ctx.withServer(out, PROBE_PORT, {}, async () => {
    for (const probe of PROBES) {
      const [pass, note] = await probe.run(ctx, PROBE_PORT);
      const status = pass ? 'PASS' : ctx.isKnown(probe.bug) ? 'KNOWN' : 'FAIL';
      if (!pass) failingBugs.push(probe.bug);
      ctx.row(status, `probe.${probe.id}`, note, `${probe.bug ?? '-'} - ${probe.desc}`);
    }
  });

  if (ctx.rt === 'bun') await runCreateHandlerProbe(ctx, failingBugs);

  // A still-declared exemption whose probes all pass has stopped guarding
  // anything: the defect is fixed but the id was never deleted, so the probe can
  // regress unnoticed. Surfaced here, where the outcome is known.
  for (const id of findStaleExemptions(registry(), ctx.budgets.knownFailures ?? {}, ctx.rt, failingBugs)) {
    ctx.row('FAIL', `knownFailures.${id}`, 'no probe failed on this runtime', `delete ${id} in the change that fixed it`);
  }
}

/**
 * `Bun.serve({ fetch: createHandler(app) })` must route without the caller
 * awaiting `app.ready()` first. Driven on Bun only: it is the runtime whose
 * server global exposes the handler seam this probe needs.
 */
async function runCreateHandlerProbe(ctx, failingBugs) {
  const { out } = ctx.build('probe-createhandler-bun', 'bun');
  await ctx.withServer(out, CREATEHANDLER_PORT, {}, async () => {
    const r = await rawRequest(CREATEHANDLER_PORT, { target: '/' });
    const pass = r.status === 200 && r.body.includes('"ok":1');
    if (!pass) failingBugs.push('FB-02');
    ctx.row(
      pass ? 'PASS' : ctx.isKnown('FB-02') ? 'KNOWN' : 'FAIL',
      'probe.createhandler-without-ready',
      `status=${r.status} bytes=${r.bodyBytes}`,
      'FB-02 - Bun.serve({fetch:createHandler(app)}) must route without app.ready()'
    );
  });
}
