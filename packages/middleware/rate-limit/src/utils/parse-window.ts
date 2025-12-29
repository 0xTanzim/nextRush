import { TIME_UNITS, WINDOW_PATTERN } from '../constants';

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

  const match = window.match(WINDOW_PATTERN);

  if (!match?.[1] || !match[2]) {
    throw new Error(
      `Invalid window format: "${window}". Use format like "1s", "30s", "1m", "5m", "1h", "1d" or milliseconds.`
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multiplier = TIME_UNITS[unit];
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
