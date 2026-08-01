/**
 * Run metadata: the device, the load configuration, the frameworks, the scenarios.
 *
 * These are visible top-level sections, never collapsed. A benchmark number means
 * nothing without the machine and the load parameters that produced it, so a
 * reader must not have to expand anything to see them.
 *
 * Anything the run did not persist is reported as "not recorded in this run"
 * rather than substituted from the current environment — a value read months
 * later is not evidence about what was measured.
 */

import { FRAMEWORKS } from '../../../config/frameworks.js';
import { deviationsFor } from '../../../config/deviations.js';
import { getScenario } from '../../../config/scenarios.js';
import { fairnessTag, table } from './format.js';

const NOT_RECORDED = 'not recorded in this run';
const BACKLOG_NOT_VERIFIED = 'not verified for this run';

/** How a deviation's direction of effect reads in the generated table. */
const DIRECTION_LABEL = Object.freeze({
  favours: '↑ favours this server',
  costs: '↓ costs this server',
  neutral: '· no measured effect',
});

const seconds = (ms) => (typeof ms === 'number' ? `${ms / 1000}s` : NOT_RECORDED);
const orNotRecorded = (value) => (value === null || value === undefined || value === '' ? NOT_RECORDED : value);

/** States the effective accept-queue backlog only when the parity gate actually read it back. */
function backlogRow(parity) {
  if (parity?.validated && typeof parity.backlog === 'number') {
    return [
      'Accept-queue backlog',
      `${parity.backlog} (overrides each framework's own native default — see LISTEN_BACKLOG)`,
    ];
  }
  return ['Accept-queue backlog', BACKLOG_NOT_VERIFIED];
}

/** `wrk` + `wrk 4.2.0` must read as "wrk 4.2.0", not "wrk wrk 4.2.0". */
function toolLabel(scoreboard) {
  const version = scoreboard.system.toolVersion;
  if (!version) return scoreboard.tool;
  return String(version).startsWith(scoreboard.tool) ? String(version) : `${scoreboard.tool} ${version}`;
}

export function systemSection(scoreboard) {
  const entries = Object.entries(scoreboard.system);
  if (entries.length === 0) return [];

  const labels = {
    platform: 'Platform',
    arch: 'Architecture',
    nodeVersion: 'Node.js',
    cpuModel: 'CPU',
    cpuCores: 'CPU cores (logical)',
    totalMemory: 'Total memory',
    freeMemory: 'Free memory at start',
    kernelVersion: 'Kernel',
    uptime: 'Host uptime at start',
    timestamp: 'Measured at',
    toolVersion: 'Load tool version',
    cpuPinning: 'CPU pinning',
  };

  const lines = ['## System Information', ''];
  lines.push('The device these numbers describe. Different hardware produces different numbers.');
  lines.push('');
  lines.push(
    ...table(
      ['Property', 'Value'],
      entries.map(([key, value]) => [labels[key] || key, String(value)])
    )
  );
  lines.push('');
  return lines;
}

export function loadConfigurationSection(scoreboard) {
  const config = scoreboard.configuration;
  const runs = config.runs ?? 1;
  const measurements =
    scoreboard.frameworks.length * scoreboard.scenarios.length * scoreboard.connections.length * runs;

  const lines = ['## Load Configuration', ''];
  lines.push(
    `${scoreboard.frameworks.length} framework(s) × ${scoreboard.scenarios.length} scenario(s) × ` +
      `${scoreboard.connections.length} concurrency level(s) × ${runs} run(s) = ` +
      `**${measurements} timed runs** of ${config.duration || '?'} each.`
  );
  lines.push('');

  const git = scoreboard.git || { commit: null, dirty: null };
  lines.push(
    `**Commit:** ${git.commit ? '\`' + git.commit + '\`' : NOT_RECORDED}` +
      (git.dirty === true ? ' — **dirty working tree at measurement time**' : git.dirty === false ? ' (clean)' : '')
  );
  lines.push('');

  const effective = config.nextrushEffectiveOptions;
  const effectiveRows = effective
    ? [
        ['NextRush effective timeout', `${effective.timeout} ms`],
        ['NextRush effective keepAliveTimeout', `${effective.keepAliveTimeout} ms`],
      ]
    : [];

  lines.push(
    ...table(
      ['Parameter', 'Value'],
      [
        ['Profile', `${scoreboard.profile}${scoreboard.publishable ? ' (publishable)' : ' (NOT publishable)'}`],
        ['Load tool', toolLabel(scoreboard)],
        ['Duration', orNotRecorded(config.duration)],
        ['Connections', (config.connections || []).join(', ') || NOT_RECORDED],
        ['Runs per configuration', orNotRecorded(config.runs)],
        [
          'Threads (wrk)',
          config.threadsRequested !== undefined && config.threadsRequested !== config.threads
            ? `${config.threads} (reduced from ${config.threadsRequested} to match ${config.clientPinnedCpus} pinned client CPU(s))`
            : orNotRecorded(config.threads),
        ],
        [
          'Host load average at start',
          config.hostLoadAvgAtStart === undefined || config.hostLoadAvgAtStart === null
            ? NOT_RECORDED
            : String(config.hostLoadAvgAtStart),
        ],
        ['Pipelining', '1 (disabled — one in-flight request per connection)'],
        ['Framework warmup', orNotRecorded(config.warmupDuration)],
        ['Per-scenario warmup', orNotRecorded(config.scenarioWarmupDuration)],
        ['Cooldown between frameworks', config.cooldownMs === undefined ? NOT_RECORDED : seconds(config.cooldownMs)],
        ['Pause between tests', config.pauseBetweenTestsMs === undefined ? NOT_RECORDED : seconds(config.pauseBetweenTestsMs)],
        ['CPU pinning', config.pinCores ? `server cores ${config.pinCores}` : scoreboard.system.cpuPinning || 'off'],
        ['Client pinning', config.clientPinCores ? `client cores ${config.clientPinCores}` : 'off'],
        ['Framework order', orNotRecorded(config.positionControl ?? config.order)],
        ['GC tracing', config.traceGc === undefined ? NOT_RECORDED : config.traceGc ? 'on' : 'off'],
        backlogRow(config.parity),
        ...effectiveRows,
      ]
    )
  );
  lines.push('');
  return lines;
}

export function frameworksSection(scoreboard, { frameworkVersions = null, versionSource = null } = {}) {
  const lines = ['## Frameworks Under Test', ''];
  const rows = [...scoreboard.frameworks, ...scoreboard.failed].map((fw) => {
    const config = FRAMEWORKS[fw.id] || {};
    const role = config.isBaseline ? 'baseline' : config.isTarget ? 'target' : 'comparison';
    const failed = scoreboard.failed.some((f) => f.id === fw.id);
    return [
      fw.id,
      frameworkVersions?.[fw.id] || 'not recorded',
      role,
      config.description || fw.name,
      failed ? '❌ failed to start' : '✓ measured',
    ];
  });

  lines.push(...table(['Server', 'Version', 'Role', 'Configuration', 'Status'], rows));
  lines.push('');
  lines.push(
    versionSource
      ? `Versions ${versionSource}.`
      : 'This run did not persist framework versions. Runs from now on record them; for older ' +
          'runs, check out the commit the run was made from to read `apps/benchmark/package.json`.'
  );
  lines.push('');
  return lines;
}

/**
 * Every place a server departs from its framework's own defaults.
 *
 * The fairness reasoning for each deviation lived only in server source comments,
 * so a reader of this report saw "logger disabled, default config" for a server
 * running without its headline serialization feature, and "minimal middleware"
 * for one with two defaults changed in its favour (audit F-23). Generated from
 * `config/deviations.js` so the disclosure cannot drift from the servers.
 */
export function deviationsSection(scoreboard) {
  const measured = [...scoreboard.frameworks, ...scoreboard.failed];
  const rows = measured.flatMap((fw) =>
    deviationsFor(fw.id).map((deviation) => [
      fw.id,
      deviation.setting,
      deviation.from,
      deviation.to,
      DIRECTION_LABEL[deviation.direction] ?? deviation.direction,
      deviation.why,
    ])
  );
  if (rows.length === 0) return [];

  const lines = ['## Configuration deviations from framework defaults', ''];
  lines.push(
    'No server here runs entirely stock. Every deviation below exists to make the comparison ' +
      'measure the same work, and each is listed with who it plausibly helps — including where it ' +
      'costs the framework it applies to. A deviation not declared in `config/deviations.js` fails ' +
      'the disclosure test, so this table cannot silently fall behind the servers.'
  );
  lines.push('');
  lines.push(
    ...table(['Server', 'Setting', 'Framework default', 'This suite', 'Direction', 'Why'], rows)
  );
  lines.push('');
  return lines;
}

export function scenariosSection(scoreboard) {
  const lines = ['## Scenarios Executed', ''];

  const rows = scoreboard.scenarios.map((scenario) => {
    const config = getScenario(scenario.id) || {};
    return [
      scenario.name,
      `\`${scenario.id}\``,
      config.method || '—',
      config.path ? `\`${config.path}\`` : '—',
      config.expectStatus ?? '—',
      `\`${scenario.category}\``,
      fairnessTag(scenario.identicalOutput),
    ];
  });

  lines.push(
    ...table(['Scenario', 'ID', 'Method', 'Path', 'Expected status', 'Category', 'Fairness'], rows)
  );
  lines.push('');
  lines.push(
    'All servers implement every endpoint from the same canonical payloads ' +
      '(`servers/_shared/payloads.js`). `⚠️ idiomatic` marks a scenario where the mechanism ' +
      'differs per framework by design, so it is excluded from the headline score.'
  );
  lines.push('');
  lines.push(
    '`like-for-like` means the **response** is verified identical — status, body bytes, content type, ' +
      'framing and the full header set are byte-compared across servers before any timing. It does ' +
      'not mean the work performed to produce that response is equivalent; where a known asymmetry ' +
      'exists it is named below.'
  );
  lines.push('');

  const withNotes = scoreboard.scenarios.filter((scenario) => scenario.workNotes);
  if (withNotes.length > 0) {
    lines.push('**Known work asymmetries**', '');
    for (const scenario of withNotes) {
      lines.push(`- \`${scenario.id}\` — ${scenario.workNotes}`);
    }
    lines.push('');
  }
  return lines;
}

/** Explains an absent ranking instead of leaving a hole where one would be. */
export function singleFrameworkNotice(scoreboard) {
  const [only] = scoreboard.frameworks;
  return [
    '## Ranking',
    '',
    `Only one framework was benchmarked in this run (${only?.name || 'unknown'}), so there is ` +
      'nothing to rank. Its own measurements are below; run `pnpm bench:compare` for a ranked ' +
      'comparison.',
    '',
  ];
}
