/** autocannon runner + version detection. */

import { readFileSync } from 'node:fs';

import { formatBytes } from '../system.js';
import { parseDuration } from '../time.js';

export async function runAutocannon({ url, connections, duration, pipelining = 1, method = 'GET', body, headers }) {
  const { default: autocannon } = await import('autocannon');

  const opts = { url, connections, duration: parseDuration(duration), pipelining, method };
  if (body) opts.body = body;
  if (headers) opts.headers = headers;

  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve({
        rps: result.requests.average,
        requests: result.requests.total,
        transferPerSec: formatBytes(result.throughput.average) + '/s',
        latency: {
          avg: result.latency.average + 'ms',
          p50: result.latency.p50 + 'ms',
          p75: result.latency.p75 + 'ms',
          p90: result.latency.p90 + 'ms',
          p99: result.latency.p99 + 'ms',
          p999: (result.latency.p99_9 || result.latency.p99) + 'ms',
          max: result.latency.max + 'ms',
        },
        errors: {
          total: result.errors || 0,
          timeouts: result.timeouts || 0,
          nonOk: result.non2xx || 0,
        },
        raw: result,
      });
    });
  });
}

/** Read autocannon's real version from its installed package.json (not hardcoded). */
export function readAutocannonVersion() {
  try {
    const pkgUrl = new URL('../../../node_modules/autocannon/package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8'));
    return `autocannon ${pkg.version}`;
  } catch {
    return 'autocannon (version unknown)';
  }
}
