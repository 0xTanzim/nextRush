import autocannon from 'autocannon';
import chalk from 'chalk';
import { spawn } from 'child_process';
import Table from 'cli-table3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  connections: 100,
  duration: 10,
  pipelining: 10,
};

const ROUTES = [
  { name: 'Hello World', path: '/', method: 'GET' },
  { name: 'Route Params', path: '/users/123', method: 'GET' },
  { name: 'POST JSON', path: '/users', method: 'POST', body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }), headers: { 'content-type': 'application/json' } },
];

async function runBenchmark(name, port, serverPath) {
  console.log(chalk.blue(`\n🚀 Starting ${name} benchmark on port ${port}...`));

  const server = spawn('node', [serverPath], {
    stdio: 'ignore',
    env: { ...process.env, PORT: port }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = {};

  for (const route of ROUTES) {
    console.log(chalk.gray(`  Testing ${route.name} (${route.method} ${route.path})...`));

    try {
      const result = await autocannon({
        url: `http://localhost:${port}${route.path}`,
        connections: CONFIG.connections,
        duration: CONFIG.duration,
        pipelining: CONFIG.pipelining,
        method: route.method,
        body: route.body,
        headers: route.headers,
      });

      results[route.name] = result;
      console.log(chalk.green(`    Done: ${formatNumber(result.requests.average)} req/sec`));
    } catch (err) {
      console.error(chalk.red(`    Error testing ${route.name}:`), err.message);
    }
  }

  server.kill();
  return results;
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(Math.round(num));
}

async function main() {
  console.log(chalk.bold.magenta('\n🔥 NextRush Performance Comparison: v2 vs v3 🔥'));
  console.log(chalk.gray('--------------------------------------------------'));

  const v2Results = await runBenchmark('NextRush v2', 3001, join(__dirname, '../server/nextrush-v2/server.js'));
  const v3Results = await runBenchmark('NextRush v3', 3002, join(__dirname, '../server/nextrush-v3/server.js'));

  const honoResults = await runBenchmark(
  'Hono',
  3003,
  join(__dirname, '../server/hono/server.js')
);

  const table = new Table({
    head: [
      chalk.cyan('Route'),
      chalk.cyan('Metric'),
      chalk.yellow('NextRush v2'),
      chalk.green('NextRush v3'),
      chalk.blue('Hono'),
      chalk.magenta('Improvement')
    ],
    style: { head: [], border: [] }
  });

  for (const route of ROUTES) {
    const v2 = v2Results[route.name];
    const v3 = v3Results[route.name];
    const hono = honoResults[route.name];

    const rpsDiff = ((v3.requests.average - v2.requests.average) / v2.requests.average) * 100;
    const latDiff = ((v2.latency.average - v3.latency.average) / v2.latency.average) * 100;

    table.push(
      [
        { rowSpan: 2, content: chalk.bold(route.name) },
        'Req/sec',
        formatNumber(v2.requests.average),
        formatNumber(v3.requests.average),
        formatNumber(hono.requests.average),
        chalk.bold(rpsDiff > 0 ? `+${rpsDiff.toFixed(2)}%` : `${rpsDiff.toFixed(2)}%`)
      ],
      [
        'Latency (ms)',
        v2.latency.average.toFixed(2),
        v3.latency.average.toFixed(2),
        hono.latency.average.toFixed(2),
        chalk.bold(latDiff > 0 ? `+${latDiff.toFixed(2)}%` : `${latDiff.toFixed(2)}%`)
      ]
    );
  }

  console.log('\n' + table.toString());

  console.log(chalk.bold.green('\n✅ Benchmark completed successfully!'));
  console.log(chalk.gray('Note: v3 (nextrushx) is optimized for minimal overhead and faster routing.\n'));
}

main().catch(err => {
  console.error(chalk.red('\n❌ Benchmark failed:'), err);
  process.exit(1);
});
