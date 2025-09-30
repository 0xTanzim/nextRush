#!/usr/bin/env node

/**
 * Autocannon Test Runner - Query Strings
 * Tests query string parsing performance
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

async function runTest(framework, port = 3000) {
  console.log(`\n🚀 Running Query Strings test for ${framework}...`);

  const result = await autocannon({
    url: `http://localhost:${port}`,
    connections: 100,
    duration: 40,
    pipelining: 10,
    requests: [
      {
        method: 'GET',
        path: '/search?q=nodejs&page=1',
      },
      {
        method: 'GET',
        path: '/search?q=typescript&page=2',
      },
      {
        method: 'GET',
        path: '/search?q=express&page=3',
      },
      {
        method: 'GET',
        path: '/search?q=fastify&page=1',
      },
      {
        method: 'GET',
        path: '/search?q=koa&page=2',
      },
    ],
  });

  return {
    framework,
    test: 'query-strings',
    rps: result.requests.average,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
      mean: result.latency.mean,
    },
    throughput: result.throughput.average,
    errors: result.errors,
    timeouts: result.timeouts,
    duration: result.duration,
  };
}

if (require.main === module) {
  const framework = process.argv[2] || 'nextrush';
  const port = process.argv[3] || 3000;

  runTest(framework, port)
    .then(result => {
      const resultsDir = path.join(__dirname, '../../results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      const filename = path.join(
        resultsDir,
        `${framework}-query-autocannon.json`
      );
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));

      console.log('\n📊 Results:');
      console.log(JSON.stringify(result, null, 2));
      console.log(`\n✅ Saved to: ${filename}`);
    })
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}

module.exports = runTest;
