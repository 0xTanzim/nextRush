/**
 * Shared utilities for benchmark scripts.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(__dirname, '..');
export const SERVERS_DIR = join(ROOT_DIR, 'servers');
export const RESULTS_DIR = join(ROOT_DIR, 'results');
export const WRK_DIR = join(ROOT_DIR, 'wrk');

// ─── CLI Argument Parsing ───

export function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ─── Logging ───

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

export function log(msg, style) {
  if (style === 'dim') {
    console.log(`${DIM}${msg}${RESET}`);
  } else {
    console.log(msg);
  }
}

export function logError(msg) {
  console.error(`${RED}✖ ERROR:${RESET} ${msg}`);
}

export function logWarn(msg) {
  console.warn(`${YELLOW}⚠ WARN:${RESET} ${msg}`);
}

export function logStep(msg) {
  console.log(`${CYAN}→${RESET} ${msg}`);
}

export function logResult(key, value, extra) {
  const pad = 20;
  const line = `  ${String(key).padEnd(pad)} ${value}`;
  console.log(extra ? `${line}  ${DIM}${extra}${RESET}` : line);
}

export function logHeader(title) {
  const width = 60;
  const border = '═'.repeat(width);
  console.log('');
  console.log(`${BOLD}${GREEN}╔${border}╗${RESET}`);
  console.log(`${BOLD}${GREEN}║${RESET} ${title.padEnd(width - 1)}${BOLD}${GREEN}║${RESET}`);
  console.log(`${BOLD}${GREEN}╚${border}╝${RESET}`);
  console.log('');
}

// ─── File System ───

export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function saveResults(dir, filename, data) {
  ensureDir(dir);
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

export function saveReport(dir, filename, content) {
  ensureDir(dir);
  writeFileSync(join(dir, filename), content, 'utf-8');
}

// ─── Time Helpers ───

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${str}`);
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return val;
  if (unit === 'm') return val * 60;
  return val * 3600;
}

// ─── System Info ───

export function getSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCores: os.cpus().length,
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    kernelVersion: os.release(),
    uptime: `${Math.floor(os.uptime() / 3600)}h`,
    timestamp: new Date().toISOString(),
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// ─── Server Lifecycle ───

export async function startServer(serverFile, port = 3000, { traceGc = false } = {}) {
  const serverPath = join(SERVERS_DIR, serverFile);
  if (!existsSync(serverPath)) {
    throw new Error(`Server file not found: ${serverPath}`);
  }

  const nodeArgs = ['--expose-gc', '--max-old-space-size=512'];
  if (traceGc) nodeArgs.push('--trace-gc');
  nodeArgs.push(serverPath);

  const child = spawn('node', nodeArgs, {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const gcEvents = [];
  let stderr = '';

  child.stderr.on('data', (data) => {
    const line = data.toString();
    stderr += line;

    // Parse --trace-gc output (not enabled by default, but ready if needed)
    const gcMatch = line.match(
      /\[(\d+):.*\]\s+(\d+)\s+ms:\s+(Scavenge|Mark-Compact|MinorGC|MajorGC)\s+[\d.]+\s+\([\d.]+\)\s+->\s+[\d.]+\s+\([\d.]+\)\s+MB,\s+([\d.]+)\s+\/\s+([\d.]+)\s+ms/
    );
    if (gcMatch) {
      gcEvents.push({
        timestamp: parseInt(gcMatch[2], 10),
        type: gcMatch[3],
        pauseMs: parseFloat(gcMatch[4]),
        totalMs: parseFloat(gcMatch[5]),
      });
    }
  });

  // Wait for server to be ready
  const ready = await waitForServer(`http://localhost:${port}/`, 20000);
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error(`Server ${serverFile} failed to start.\nStderr: ${stderr}`);
  }

  return { child, port, gcEvents };
}

export async function stopServer(handle) {
  if (!handle?.child) return;

  return new Promise((resolve) => {
    handle.child.once('exit', () => {
      setTimeout(resolve, 200); // socket cleanup delay
    });

    handle.child.kill('SIGTERM');

    // Force kill after 5s
    setTimeout(() => {
      try {
        handle.child.kill('SIGKILL');
      } catch {
        // already dead
      }
      resolve();
    }, 5000);
  });
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      // Any response (even 404/500) means the server is up
      return true;
    } catch {
      // not ready yet
    }
    await sleep(250);
  }
  return false;
}

// ─── Metrics Sampling ───

export function startMetricsSampling(pid, intervalMs = 1000) {
  if (process.platform !== 'linux') {
    logWarn(
      'Memory/CPU sampling requires Linux (/proc filesystem). Skipping on ' + process.platform + '.'
    );
    return { stop: () => [] };
  }

  const samples = [];
  const timer = setInterval(() => {
    try {
      const stat = readFileSync(`/proc/${pid}/status`, 'utf-8');
      const rssMatch = stat.match(/VmRSS:\s+(\d+)\s+kB/);
      const rss = rssMatch ? parseInt(rssMatch[1], 10) * 1024 : 0;

      // CPU from /proc/[pid]/stat
      const procStat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
      const fields = procStat.split(' ');
      const utime = parseInt(fields[13], 10);
      const stime = parseInt(fields[14], 10);

      samples.push({
        timestamp: Date.now(),
        rss,
        cpuTicks: utime + stime,
      });
    } catch {
      // Process may have died
    }
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
      return samples;
    },
    getSamples() {
      return [...samples];
    },
  };
}

export function analyzeMemorySamples(samples) {
  if (samples.length === 0) return { rssMin: 0, rssMax: 0, rssAvg: 0, rssPeak: 0 };

  const rssValues = samples.map((s) => s.rss);
  return {
    rssMin: formatBytes(Math.min(...rssValues)),
    rssMax: formatBytes(Math.max(...rssValues)),
    rssAvg: formatBytes(rssValues.reduce((a, b) => a + b, 0) / rssValues.length),
    rssPeak: formatBytes(Math.max(...rssValues)),
    samples: samples.length,
  };
}

export function analyzeGcEvents(events) {
  if (events.length === 0) return { count: 0, totalPauseMs: 0, maxPauseMs: 0, avgPauseMs: 0 };

  const pauses = events.map((e) => e.pauseMs);
  return {
    count: events.length,
    totalPauseMs: pauses.reduce((a, b) => a + b, 0).toFixed(2),
    maxPauseMs: Math.max(...pauses).toFixed(2),
    avgPauseMs: (pauses.reduce((a, b) => a + b, 0) / pauses.length).toFixed(2),
    scavenges: events.filter((e) => e.type === 'Scavenge' || e.type === 'MinorGC').length,
    markCompacts: events.filter((e) => e.type === 'Mark-Compact' || e.type === 'MajorGC').length,
  };
}

// ─── wrk Runner ───

export function runWrk({ url, connections, threads, duration, script, latency = true }) {
  const args = [
    '-c',
    String(connections),
    '-t',
    String(Math.min(threads, connections)),
    '-d',
    duration,
  ];

  if (latency) args.push('--latency');
  if (script) args.push('-s', join(WRK_DIR, script));
  args.push(url);

  const result = execSync(`wrk ${args.join(' ')}`, {
    encoding: 'utf-8',
    timeout: parseDuration(duration) * 1000 + 30000,
  });

  return parseWrkOutput(result);
}

export function parseWrkOutput(output) {
  const result = {
    raw: output,
    requests: 0,
    rps: 0,
    transferPerSec: '',
    latency: {},
    errors: {},
  };

  // Requests/sec
  const rpsMatch = output.match(/Requests\/sec:\s+([\d.]+)/);
  if (rpsMatch) result.rps = parseFloat(rpsMatch[1]);

  // Total requests
  const reqMatch = output.match(/(\d+)\s+requests\s+in/);
  if (reqMatch) result.requests = parseInt(reqMatch[1], 10);

  // Transfer/sec
  const transferMatch = output.match(/Transfer\/sec:\s+([\d.]+\w+)/);
  if (transferMatch) result.transferPerSec = transferMatch[1];

  // Latency stats
  const latencyLine = output.match(/Latency\s+([\d.]+\w+)\s+([\d.]+\w+)\s+([\d.]+\w+)/);
  if (latencyLine) {
    result.latency.avg = latencyLine[1];
    result.latency.stdev = latencyLine[2];
    result.latency.max = latencyLine[3];
  }

  // Latency percentiles
  const p50 = output.match(/50%\s+([\d.]+\w+)/);
  const p75 = output.match(/75%\s+([\d.]+\w+)/);
  const p90 = output.match(/90%\s+([\d.]+\w+)/);
  const p99 = output.match(/99%\s+([\d.]+\w+)/);

  if (p50) result.latency.p50 = p50[1];
  if (p75) result.latency.p75 = p75[1];
  if (p90) result.latency.p90 = p90[1];
  if (p99) result.latency.p99 = p99[1];

  // Errors
  const socketErrors = output.match(
    /Socket errors:\s+connect\s+(\d+),\s+read\s+(\d+),\s+write\s+(\d+),\s+timeout\s+(\d+)/
  );
  if (socketErrors) {
    result.errors = {
      connect: parseInt(socketErrors[1], 10),
      read: parseInt(socketErrors[2], 10),
      write: parseInt(socketErrors[3], 10),
      timeout: parseInt(socketErrors[4], 10),
    };
  }

  // Non-2xx/3xx responses
  const nonOk = output.match(/Non-2xx or 3xx responses:\s+(\d+)/);
  if (nonOk) result.errors.nonOk = parseInt(nonOk[1], 10);

  return result;
}

// ─── autocannon Runner ───

export async function runAutocannon({
  url,
  connections,
  duration,
  pipelining = 1,
  method = 'GET',
  body,
  headers,
}) {
  const { default: autocannon } = await import('autocannon');

  const opts = {
    url,
    connections,
    duration: parseDuration(duration),
    pipelining,
    method,
  };

  if (body) opts.body = body;
  if (headers) opts.headers = headers;

  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
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
        },
        raw: result,
      });
    });
  });
}

// ─── Statistics ───

export function computeStats(values) {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0, cv: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // Use sample stddev (N-1) for small sample sizes, population stddev for N=1
  const divisor = values.length > 1 ? values.length - 1 : 1;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / divisor;
  const stddev = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    cv: mean > 0 ? Math.round((stddev / mean) * 100 * 100) / 100 : 0, // coefficient of variation %
    values,
  };
}
