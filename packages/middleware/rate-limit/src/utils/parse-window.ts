/**
 * Parse window duration string to milliseconds
 *
 * @example
 * parseWindow('1s')  // 1000
 * parseWindow('30s') // 30000
 * parseWindow('1m')  // 60000
 * parseWindow('5m')  // 300000
 * parseWindow('1h')  // 3600000
 * parseWindow('1d')  // 86400000
 */
export function parseWindow(window: string | number): number {
  if (typeof window === 'number') {
    return window;
  }

  const match = window.match(/^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/i);

  if (!match?.[1] || !match[2]) {
    throw new Error(
      `Invalid window format: "${window}". Use format like "1s", "30s", "1m", "5m", "1h", "1d" or milliseconds.`
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    sec: 1000,
    second: 1000,
    seconds: 1000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    throw new Error(`Unknown time unit: "${unit}"`);
  }

  return Math.floor(value * multiplier);
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}
