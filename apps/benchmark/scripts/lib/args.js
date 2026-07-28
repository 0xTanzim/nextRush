/** Minimal CLI argument parser: `--key value` and boolean `--flag`. */

export function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const assignment = arg.slice(2);
    const separator = assignment.indexOf('=');
    if (separator >= 0) {
      const key = assignment.slice(0, separator);
      const value = assignment.slice(separator + 1);
      args[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[assignment] = next;
      i++;
    } else {
      args[assignment] = true;
    }
  }
  return args;
}
