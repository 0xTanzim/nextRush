/**
 * Argument parsing/defaulting for scripts/profile.js, kept separate from the
 * generic `--key value` parser (lib/args.js) so the defaulting rules are
 * independently testable — mirrors run.js's convention of extracting its own
 * override-parsing helpers (parseConnectionsOverride, parseDurationOverride).
 */

const DEFAULT_SERVER = 'nextrush-v3.js';
const DEFAULT_DURATION = '20s';

/**
 * @param {Record<string, string | boolean>} args - output of lib/args.js's parseArgs()
 * @returns {{ scenario: string, server: string, duration: string, heapSnapshot: boolean, cpuProf: boolean }}
 */
export function parseProfileArgs(args) {
  if (typeof args.scenario !== 'string' || args.scenario.length === 0) {
    throw new Error('--scenario is required (e.g. --scenario hello-world)');
  }

  return {
    scenario: args.scenario,
    server: typeof args.server === 'string' ? args.server : DEFAULT_SERVER,
    duration: typeof args.duration === 'string' ? args.duration : DEFAULT_DURATION,
    heapSnapshot: args['heap-snapshot'] !== 'false',
    cpuProf: args['cpu-prof'] !== 'false',
  };
}
