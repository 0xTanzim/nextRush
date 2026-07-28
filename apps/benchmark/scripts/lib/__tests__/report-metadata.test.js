import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateMarkdownReport } from '../../report-md.js';
import { resolveFrameworkVersions } from '../report/versions.js';

function cell(rps) {
  return {
    runs: [{ errors: {} }],
    validRuns: 3,
    stats: { mean: rps, stddev: 10, min: rps, max: rps, cv: 1, values: [rps] },
    latency: { p50: '1.00ms', p99: '2.00ms' },
    invalid: false,
    summary: { rpsMean: rps, rpsStddev: 10, cv: 1 },
  };
}

function framework(name, rps, resources = true) {
  return {
    framework: name,
    frameworkId: name,
    scenarios: {
      'hello-world': {
        scenario: 'Hello World',
        scenarioId: 'hello-world',
        concurrencyResults: { 1: cell(rps / 2), 64: cell(rps) },
      },
    },
    memory: resources
      ? { rssMin: '30.0 MB', rssMax: '50.0 MB', rssAvg: '40.0 MB', rssPeak: '50.0 MB', samples: 290 }
      : undefined,
    cpu: resources ? { cpuAvgPct: 21.6, cpuMaxPct: 86.3, samples: 290 } : undefined,
    gc: resources
      ? { count: 12, totalPauseMs: '8.40', maxPauseMs: '1.20', avgPauseMs: '0.70', scavenges: 10, markCompacts: 2 }
      : undefined,
  };
}

function report({ frameworks = ['raw-node', 'nextrush-v3'], configuration = {} } = {}) {
  return {
    runId: '2026-07-27T15-42-50',
    timestamp: '2026-07-27T20:31:45.917Z',
    profile: 'standard',
    publishable: true,
    tool: 'wrk',
    system: {
      platform: 'linux',
      arch: 'x64',
      nodeVersion: 'v26.4.0',
      cpuModel: 'Intel(R) Core(TM) i5-8300H CPU @ 2.30GHz',
      cpuCores: 8,
      totalMemory: '15.46 GB',
      freeMemory: '12.73 GB',
      kernelVersion: '7.1.4-204.fc44.x86_64',
      uptime: '0h',
      toolVersion: 'wrk 4.2.0',
      cpuPinning: 'off',
    },
    configuration: {
      duration: '30s',
      connections: [1, 64],
      runs: 3,
      threads: 4,
      pinCores: null,
      order: 'fixed',
      scenarios: ['hello-world'],
      ...configuration,
    },
    results: Object.fromEntries(frameworks.map((id, i) => [id, framework(id, 30000 - i * 1000)])),
  };
}

test('system information is a visible top-level section, not collapsed', () => {
  const md = generateMarkdownReport(report());
  const section = md.slice(md.indexOf('## System Information'), md.indexOf('## Load Configuration'));

  assert.ok(md.indexOf('## System Information') > 0, 'System Information section must exist');
  assert.doesNotMatch(section, /<details>/, 'device information must not be hidden behind a toggle');
  for (const value of ['linux', 'x64', 'v26.4.0', 'i5-8300H', '15.46 GB', '7.1.4-204.fc44.x86_64', 'wrk 4.2.0']) {
    assert.ok(section.includes(value), `expected system info to report ${value}`);
  }
});

test('load configuration is visible and states every knob that shaped the numbers', () => {
  const md = generateMarkdownReport(report());
  const section = md.slice(md.indexOf('## Load Configuration'));

  assert.match(section, /\| Load tool \| wrk 4.2.0 \|/);
  assert.doesNotMatch(section, /wrk wrk/, 'tool name must not be duplicated');
  assert.match(section, /\| Duration \| 30s \|/);
  assert.match(section, /\| Connections \| 1, 64 \|/);
  assert.match(section, /\| Runs per configuration \| 3 \|/);
  assert.match(section, /\| Threads \(wrk\) \| 4 \|/);
  assert.match(section, /\| Pipelining \| 1 /);
  assert.match(section, /\| CPU pinning \| off \|/);
  assert.match(section, /\| Framework order \| fixed \|/);
});

test('load configuration reports warmup and cooldown when the run recorded them', () => {
  const md = generateMarkdownReport(
    report({
      configuration: {
        warmupDuration: '10s',
        scenarioWarmupDuration: '3s',
        cooldownMs: 3000,
        pauseBetweenTestsMs: 2000,
      },
    })
  );

  assert.match(md, /\| Framework warmup \| 10s \|/);
  assert.match(md, /\| Per-scenario warmup \| 3s \|/);
  assert.match(md, /\| Cooldown between frameworks \| 3s \|/);
  assert.match(md, /\| Pause between tests \| 2s \|/);
});

test('load configuration says so explicitly when warmup was not recorded', () => {
  const md = generateMarkdownReport(report());

  assert.match(md, /\| Framework warmup \| not recorded in this run \|/);
});

test('report states the measurement count so the run size is auditable', () => {
  const md = generateMarkdownReport(report());

  // 2 frameworks x 1 scenario x 2 connections x 3 runs = 12
  assert.match(md, /12 timed runs/);
});

test('frameworks under test are listed with version and provenance', () => {
  const md = generateMarkdownReport(report(), {
    frameworkVersions: { 'raw-node': 'Node v26.4.0', 'nextrush-v3': '3.1.0 (workspace)' },
    versionSource: 'recorded at run time',
  });

  assert.match(md, /## Frameworks Under Test/);
  assert.match(md, /\| raw-node \| Node v26.4.0 \|/);
  assert.match(md, /\| nextrush-v3 \| 3.1.0 \(workspace\) \|/);
  assert.match(md, /recorded at run time/);
});

test('framework versions fall back to not-recorded rather than guessing', () => {
  const md = generateMarkdownReport(report());

  assert.match(md, /## Frameworks Under Test/);
  assert.match(md, /not recorded/);
});

test('scenarios are listed with method, path and expected status', () => {
  const md = generateMarkdownReport(report({ configuration: { scenarios: ['hello-world', 'post-json', 'error-handling'] } }));
  const section = md.slice(md.indexOf('## Scenarios Executed'));

  assert.match(section, /\| Hello World \| `hello-world` \| GET \| `\/` \| 200 \|/);
  assert.match(section, /\| POST JSON \| `post-json` \| POST \| `\/users` \| 200 \|/);
  assert.match(section, /\| Error Handling \| `error-handling` \| GET \| `\/error` \| 500 \|/);
});

test('per-framework resources keep sample counts and the GC breakdown', () => {
  const md = generateMarkdownReport(report());

  assert.match(md, /RSS peak \| 50.0 MB/);
  assert.match(md, /RSS avg \| 40.0 MB/);
  assert.match(md, /RSS min \/ max \| 30.0 MB \/ 50.0 MB/);
  assert.match(md, /CPU avg \/ peak \| 21.6% \/ 86.3%/);
  assert.match(md, /Samples \| 290/);
  assert.match(md, /GC events \| 12 \(10 scavenge \/ 2 mark-compact\)/);
  assert.match(md, /GC pause \| 8.40ms total · 1.20ms max · 0.70ms avg/);
});

test('a single-framework run skips ranking and says why, keeping its own measurements', () => {
  const md = generateMarkdownReport(report({ frameworks: ['nextrush-v3'] }));

  assert.doesNotMatch(md, /## Scoreboard/);
  assert.match(md, /Only one framework was benchmarked/);
  assert.match(md, /## Per-scenario results/);
  assert.match(md, /## System Information/);
  assert.match(md, /## Load Configuration/);
});

test('a comparison run keeps the ranking sections', () => {
  const md = generateMarkdownReport(report());

  assert.match(md, /## Scoreboard/);
  assert.match(md, /## Per-scenario rankings/);
});

test('resolveFrameworkVersions maps framework ids to the versions actually installed', () => {
  const versions = resolveFrameworkVersions({
    devDependencies: { fastify: '5.10.0', hono: '4.12.30', koa: '3.2.1', express: '5.2.1' },
    nodeVersion: 'v26.4.0',
    nextrushVersion: '3.1.0',
  });

  assert.equal(versions.fastify, '5.10.0');
  assert.equal(versions.hono, '4.12.30');
  assert.equal(versions.koa, '3.2.1');
  assert.equal(versions.express, '5.2.1');
  assert.equal(versions['raw-node'], 'Node v26.4.0');
  assert.equal(versions['nextrush-v3'], '3.1.0 (workspace)');
  assert.equal(versions['nextrush-v3-class'], '3.1.0 (workspace)');
});

test('resolveFrameworkVersions omits a framework whose package is not installed', () => {
  const versions = resolveFrameworkVersions({ devDependencies: {}, nodeVersion: 'v26.4.0' });

  assert.equal(versions.fastify, undefined);
  assert.equal(versions['raw-node'], 'Node v26.4.0');
});
