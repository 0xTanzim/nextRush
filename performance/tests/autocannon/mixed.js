#!/usr/bin/env node

/**
 * Autocannon Benchmark: Mixed Workload
 * Simulates realistic traffic with multiple request types
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FRAMEWORK = process.env.FRAMEWORK || 'unknown';

// Weighted random requests (60% GET, 40% mixed params/query/post)
const requests = [
  // 30% - Hello World
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/' },

  // 20% - Route params
  { method: 'GET', path: '/users/123' },
  { method: 'GET', path: '/users/456' },

  // 20% - Query params
  { method: 'GET', path: '/search?q=nodejs&page=1' },
  { method: 'GET', path: '/search?q=typescript&page=2' },

  // 20% - More Hello (high traffic endpoint)
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/' },

  // 10% - POST requests
  {
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
  },
];

console.log(`\n🔀 Running MIXED WORKLOAD test for ${FRAMEWORK}...`);
console.log(`📍 Target: http://localhost:${PORT}`);
console.log(`📊 Mix: 60% GET /, 20% params, 20% query, 10% POST\n`);

autocannon(
  {
    url: `http://localhost:${PORT}`,
    connections: 100,
    duration: 40,
    pipelining: 10,
    requests,
  },
  (err, result) => {
    if (err) {
      console.error('❌ Benchmark failed:', err);
      process.exit(1);
    }

    // Save results
    const resultsDir = path.join(__dirname, '../../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `${FRAMEWORK}-mixed-autocannon.json`;
    const filepath = path.join(resultsDir, filename);

    // Extract key metrics
    const summary = {
      framework: FRAMEWORK,
      test: 'mixed-workload',
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

    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));

    console.log(`\n✅ Results saved to: ${filename}`);
    console.log(`📊 Average RPS: ${Math.round(summary.rps)}`);
    console.log(`⏱️  Latency p95: ${summary.latency.p95}ms\n`);
  }
);

autocannon(
  {
    url: `http://localhost:${PORT}`,
    connections: 100,
    duration: 40,
    pipelining: 10,
    requests,
  },
  (err, result) => {
    if (err) {
      console.error('❌ Benchmark failed:', err);
      process.exit(1);
    }

    // Save results
    const resultsDir = path.join(__dirname, '../../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `${FRAMEWORK}-mixed-autocannon.json`;
    const filepath = path.join(resultsDir, filename);

    // Extract key metrics
    const summary = {
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

    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));

    console.log(`\n✅ Results saved to: ${filename}`);
    console.log(`📊 Average RPS: ${Math.round(summary.rps)}`);
    console.log(`⏱️  Latency p95: ${summary.latency.p95}ms\n`);
  }
);
