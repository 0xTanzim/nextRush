#!/usr/bin/env node

/**
 * Autocannon Test Runner - Route Parameters
 * Tests router performance with dynamic parameters
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

async function runTest(framework, port = 3000) {
  console.log(`\n🚀 Running Route Parameters test for ${framework}...`);

  const result = await autocannon({
    url: `http://localhost:${port}`,
    connections: 100,
    duration: 40,
    pipelining: 10,
    requests: [
      {
        method: 'GET',
        path: '/users/123',
      },
      {
        method: 'GET',
        path: '/users/456',
      },
      {
        method: 'GET',
        path: '/users/789',
      },
      {
        method: 'GET',
        path: '/users/1001',
      },
      {
        method: 'GET',
        path: '/users/2002',
      },
    ],
  });

  return {
    framework,
    test: 'route-parameters',
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
        `${framework}-params-autocannon.json`
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
