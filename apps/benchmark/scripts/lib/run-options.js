/**
 * Pure parsers for `run.js` CLI overrides.
 *
 * Split out of the orchestrator so a dev running a one-off custom concurrency
 * level, or an AI agent doing a quick checkup, gets a validated error instead of
 * a silently truncated or misinterpreted value — `parseInt('256,512')` reads as
 * `256` with no warning, which is the actual bug this fixes.
 */

const KNOWN_TOOLS = ['wrk', 'autocannon'];

/**
 * `--connections <n>` or `--connections <n1>,<n2>,...` — a dev or CI job
 * checking one specific concurrency level (e.g. 256 or 512) without picking a
 * whole profile, or several levels in one run. Deduplicated and sorted so the
 * declared order in the resulting report is always ascending.
 */
export function parseConnectionsOverride(raw) {
  if (raw === undefined || raw === null || raw === '') return null;

  const values = String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const n = Number(part);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`invalid --connections value: "${part}" (expected a positive integer)`);
      }
      return n;
    });

  return [...new Set(values)].sort((a, b) => a - b);
}

export function getRequestedTool({ tool, tools } = {}) {
  return tool ?? tools;
}

/**
 * `--duration <n|n<unit>>` or `--time <n|n<unit>>` — `--time` is the more
 * discoverable alias devs and agents reach for first; it wins if both are given.
 * A bare integer is normalized to seconds so `parseDuration`/wrk accept it.
 */
export function parseDurationOverride({ duration, time } = {}) {
  const raw = time ?? duration;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw);
  if (!/^[1-9]\d*(s|m|h)?$/.test(value)) {
    throw new Error(`invalid duration value: "${value}" (expected a positive integer with optional s, m, or h)`);
  }
  return /^\d+$/.test(value) ? `${value}s` : value;
}

/** Validate the number of measured repetitions before any server starts. */
export function parseRunsOverride(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`invalid --runs value: "${value}" (expected a positive integer)`);
  }
  return Number(value);
}

/**
 * `--tool wrk|autocannon` — validated rather than passed through, so a typo
 * (`--tool wkr`) fails loudly instead of silently falling back to autocannon
 * detection with no indication the requested tool was never used.
 */
export function resolveToolName(requested, detectDefault) {
  if (requested === undefined || requested === null || requested === '') return detectDefault();
  if (!KNOWN_TOOLS.includes(requested)) {
    throw new Error(`unknown --tool "${requested}" (expected one of: ${KNOWN_TOOLS.join(', ')})`);
  }
  return requested;
}
