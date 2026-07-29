/**
 * Barrel for the benchmark's shared utilities.
 *
 * The implementation lives in focused modules under `scripts/lib/` (logging,
 * args, time, system, fsx, server, metrics, stats, tools/*). This file only
 * re-exports their public surface so existing `./utils.js` importers keep
 * working while no single file exceeds the size ceiling (audit F-M03).
 */

export { ROOT_DIR, SERVERS_DIR, RESULTS_DIR, WRK_DIR } from './lib/paths.js';
export { log, logError, logWarn, logStep, logResult, logHeader } from './lib/logging.js';
export { parseArgs } from './lib/args.js';
export { sleep, timestamp, parseDuration } from './lib/time.js';
export { formatBytes, getSystemInfo, hasTaskset } from './lib/system.js';
export { ensureDir, saveResults, saveReport } from './lib/fsx.js';
export { startServer, stopServer, waitForServer } from './lib/server.js';
export {
  startMetricsSampling,
  analyzeMemorySamples,
  analyzeCpuSamples,
  analyzeGcEvents,
} from './lib/metrics.js';
export {
  computeStats,
  isInvalidRun,
  filterValidRuns,
  aggregateLatency,
  parseLatencyToMs,
} from './lib/stats.js';
export {
  buildWrkPostScript,
  cleanupGeneratedScripts,
  generatedScriptPath,
  runWrk,
  parseWrkOutput,
  readWrkVersion,
  writeGeneratedScript,
} from './lib/tools/wrk.js';
export { runAutocannon, readAutocannonVersion } from './lib/tools/autocannon.js';
export { getToolVersion } from './lib/tools/version.js';
