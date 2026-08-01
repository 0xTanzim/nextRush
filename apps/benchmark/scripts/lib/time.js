/** Time helpers. */

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Parse a duration string like "10s", "2m", "1h" into seconds. */
export function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${str}`);
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return val;
  if (unit === 'm') return val * 60;
  return val * 3600;
}
