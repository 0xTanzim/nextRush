// Edge leg: run the correctness probes against the real `workerd` runtime.
//
// Opt-in and probe-only. The Edge adapter cannot run under Bun/Node/Deno, so this
// stage starts `workerd` with a generated config and reuses the same probe
// registry. Passing rows are INFO rather than PASS because Edge has no budget in
// this change; a failure outside a declared exemption still fails the run.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { coversRuntime, findStaleExemptions } from '../known-failures.mjs';
import { PROBES, registry } from '../probe-registry.mjs';
import { rawRequest } from '../raw-http.mjs';

const EDGE_PORT = 4400;
const READY_ATTEMPTS = 50;
const READY_DELAY_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function workerdBinary(ctx) {
  const candidates = [
    join(ctx.here, '../../node_modules/.bin/workerd'),
    join(ctx.repoRoot, 'node_modules/.bin/workerd'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function configFor(outFile) {
  return `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    ( name = "main",
      worker = (
        modules = [ ( name = "worker", esModule = embed "${basename(outFile)}" ) ],
        compatibilityDate = "2026-10-11"
      )
    ),
  ],
  sockets = [
    ( name = "http", address = "127.0.0.1:${EDGE_PORT}", http = (), service = "main" ),
  ],
);
`;
}

async function waitForEdge(child) {
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt++) {
    if (child.exitCode !== null) return false;
    const response = await rawRequest(EDGE_PORT, { target: '/', timeoutMs: 300 });
    if (response.status > 0) return true;
    await sleep(READY_DELAY_MS);
  }
  return false;
}

function stop(child) {
  if (child.exitCode === null) child.kill('SIGTERM');
}

export async function stageEdge(ctx) {
  const binary = workerdBinary(ctx);
  if (!binary) {
    return ctx.row('WARN', 'edge', 'skipped', 'workerd not installed — run pnpm install');
  }

  const { out } = ctx.build('edge-worker', ctx.target);
  const configPath = join(ctx.here, '.out', 'workerd.capnp');
  writeFileSync(configPath, configFor(out));

  const child = spawn(binary, ['serve', configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    if (!(await waitForEdge(child))) {
      const reason = stderr.trim().split('\n').pop() || `exited with code ${String(child.exitCode)}`;
      return ctx.row('WARN', 'edge', 'skipped', `workerd did not start: ${reason}`);
    }

    const failingBugs = [];
    for (const probe of PROBES) {
      const [pass, note] = await probe.run({ rt: 'edge' }, EDGE_PORT);
      const known = coversRuntime(ctx.budgets.knownFailures?.[probe.bug], 'edge');
      const status = pass ? 'INFO' : known ? 'KNOWN' : 'FAIL';
      if (!pass) failingBugs.push(probe.bug);
      ctx.row(status, `edge.${probe.id}`, note, `${probe.bug ?? '-'} - ${probe.desc}`);
    }

    for (const id of findStaleExemptions(
      registry(),
      ctx.budgets.knownFailures ?? {},
      'edge',
      failingBugs
    )) {
      ctx.row('FAIL', `knownFailures.${id}`, 'no edge probe failed', `delete ${id} in the change that fixed it`);
    }
  } finally {
    stop(child);
    await Promise.race([sleep(2000), new Promise((resolve) => child.once('exit', resolve))]);
  }
}
