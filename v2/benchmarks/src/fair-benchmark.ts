#!/usr/bin/env tsx

/**
 * 🏆 Fair Framework Benchmark
 *
 * Identical test conditions for NextRush, Express, Fastify, and Koa
 * Based on industry standards and official benchmarking practices
 */

import autocannon from 'autocannon';
import { createApp } from 'nextrush-v2';
import { ExpressAdapter } from './adapters/express.js';
import { FastifyAdapter } from './adapters/fastify.js';
import { KoaAdapter } from './adapters/koa.js';
import { ReportGenerator } from './report-generator.js';
import type { FrameworkResult } from './types.js';

// Benchmark Configuration - Identical for all frameworks
const BENCHMARK_CONFIG = {
  duration: 10, // 10 seconds per test
  connections: 100, // 100 concurrent connections
  pipelining: 1, // No HTTP pipelining
  timeout: 10, // 10 second timeout
  headers: {
    Connection: 'keep-alive',
    'User-Agent': 'autocannon/8.0.0',
  },
};

// Test Scenarios - Identical endpoints for all frameworks
const TEST_SCENARIOS = [
  {
    name: 'GET /',
    path: '/',
    method: 'GET',
    weight: 0.2,
    description: 'Basic root endpoint',
  },
  {
    name: 'GET /api/health',
    path: '/api/health',
    method: 'GET',
    weight: 0.15,
    description: 'Health check endpoint',
  },
  {
    name: 'GET /api/users',
    path: '/api/users',
    method: 'GET',
    weight: 0.25,
    description: 'List users endpoint',
  },
  {
    name: 'GET /api/users/1',
    path: '/api/users/1',
    method: 'GET',
    weight: 0.2,
    description: 'Get single user endpoint',
  },
  {
    name: 'POST /api/users',
    path: '/api/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
    weight: 0.1,
    description: 'Create user endpoint',
  },
  {
    name: 'GET /api/search',
    path: '/api/search?q=test&page=1&limit=10',
    method: 'GET',
    weight: 0.1,
    description: 'Search endpoint with query parameters',
  },
];

interface FrameworkTest {
  name: string;
  version: string;
  adapter: any;
  testFunction: (config: any) => Promise<FrameworkResult>;
}

const FRAMEWORKS: FrameworkTest[] = [
  {
    name: 'NextRush v2',
    version: '2.0.0-alpha.1',
    adapter: null,
    testFunction: testNextRushV2,
  },
  {
    name: 'Express.js',
    version: '4.18.2',
    adapter: new ExpressAdapter(),
    testFunction: testFramework,
  },
  {
    name: 'Fastify',
    version: '4.24.3',
    adapter: new FastifyAdapter(),
    testFunction: testFramework,
  },
  {
    name: 'Koa.js',
    version: '2.14.2',
    adapter: new KoaAdapter(),
    testFunction: testFramework,
  },
];

export async function runFairBenchmark() {
  console.log('🏆 Fair Framework Benchmark');
  console.log('==========================');
  console.log('');
  console.log('📋 Test Configuration:');
  console.log(`   Duration: ${BENCHMARK_CONFIG.duration}s`);
  console.log(`   Connections: ${BENCHMARK_CONFIG.connections}`);
  console.log(`   Pipelining: ${BENCHMARK_CONFIG.pipelining}`);
  console.log(`   Timeout: ${BENCHMARK_CONFIG.timeout}s`);
  console.log('');
  console.log('🔍 Frameworks to test:');
  FRAMEWORKS.forEach(fw => {
    console.log(`   • ${fw.name} ${fw.version}`);
  });
  console.log('');

  const results: FrameworkResult[] = [];

  // Test each framework
  for (const framework of FRAMEWORKS) {
    console.log(`\n🚀 Testing ${framework.name} ${framework.version}...`);
    console.log('─'.repeat(50));

    try {
      const startTime = Date.now();
      const result = await framework.testFunction(framework.adapter);
      const endTime = Date.now();

      console.log(`✅ ${framework.name} completed in ${endTime - startTime}ms`);
      console.log(
        `   📈 Requests/sec: ${result.summary.requests.average.toFixed(2)}`
      );
      console.log(
        `   ⏱️  Latency: ${result.summary.latency.average.toFixed(2)}ms`
      );
      console.log(
        `   📊 Throughput: ${result.summary.throughput.average.toFixed(2)} MB/s`
      );
      console.log(`   ❌ Errors: ${result.summary.errors}`);
      console.log(`   ⏰ Timeouts: ${result.summary.timeouts}`);

      results.push(result);
    } catch (error) {
      console.error(`❌ ${framework.name} failed:`, error);
    }
  }

  if (results.length === 0) {
    console.log('\n❌ No results to generate report from');
    return;
  }

  // Generate comprehensive report
  console.log('\n📊 Generating fair benchmark report...');
  const reportGenerator = new ReportGenerator();

  const winner = results.reduce((prev, current) =>
    prev.summary.requests.average > current.summary.requests.average
      ? prev
      : current
  );

  const reportPath = await reportGenerator.generateReport({
    results,
    config: BENCHMARK_CONFIG,
    summary: {
      winner,
      rankings: results
        .map(result => ({
          framework: result.framework,
          requests: result.summary.requests.average,
          latency: result.summary.latency.average,
          throughput: result.summary.throughput.average,
        }))
        .sort((a, b) => b.requests - a.requests),
      comparison: results.map(result => ({
        framework: result.framework,
        performance: 100,
        latency: result.summary.latency.average,
        throughput: result.summary.throughput.average,
      })),
    },
  });

  // Display final rankings
  console.log('\n🏆 Final Rankings:');
  console.log('==================');

  const sortedResults = results.sort(
    (a, b) => b.summary.requests.average - a.summary.requests.average
  );
  const winnerResult = sortedResults[0];

  if (winnerResult) {
    console.log(
      `\n🥇 Winner: ${winnerResult.framework} ${winnerResult.version}`
    );
    console.log(
      `   📈 ${winnerResult.summary.requests.average.toFixed(2)} requests/sec`
    );
    console.log(
      `   ⏱️  ${winnerResult.summary.latency.average.toFixed(2)}ms average latency`
    );
    console.log(
      `   📊 ${winnerResult.summary.throughput.average.toFixed(2)} MB/s throughput`
    );

    console.log('\n📋 Complete Rankings:');
    console.log('=====================');
    sortedResults.forEach((result, index) => {
      const performance = (
        (result.summary.requests.average /
          winnerResult.summary.requests.average) *
        100
      ).toFixed(1);
      const latencyDiff = (
        (result.summary.latency.average /
          winnerResult.summary.latency.average) *
        100
      ).toFixed(1);

      console.log(`${index + 1}. ${result.framework} ${result.version}`);
      console.log(
        `   📈 ${result.summary.requests.average.toFixed(2)} req/s (${performance}% of winner)`
      );
      console.log(
        `   ⏱️  ${result.summary.latency.average.toFixed(2)}ms latency (${latencyDiff}% of winner)`
      );
      console.log(
        `   📊 ${result.summary.throughput.average.toFixed(2)} MB/s throughput`
      );
      console.log(
        `   ❌ ${result.summary.errors} errors, ⏰ ${result.summary.timeouts} timeouts`
      );
      console.log('');
    });
  }

  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  console.log('✅ Fair benchmark completed!');

  return results;
}

async function testNextRushV2(): Promise<FrameworkResult> {
  const app = createApp();

  // Setup identical middleware stack
  app.use(app.cors());
  app.use(app.helmet());
  app.use(app.requestId());
  app.use(app.timer());
  app.use(app.compression());
  app.use(app.smartBodyParser());
  app.use(app.logger());
  app.use(app.rateLimit());

  // Identical routes for all frameworks
  setupIdenticalRoutes(app);

  let server: any;
  let port: number;

  try {
    server = await app.listen();

    // Wait for server to be ready
    await new Promise<void>(resolve => {
      const checkServer = () => {
        const address = server.address();
        if (address) {
          port = (address as any).port;
          console.log(`   📡 Server started on port ${port}`);
          resolve();
        } else {
          setTimeout(checkServer, 100);
        }
      };
      checkServer();
    });

    const scenarioResults = await runScenarios(port);
    const weightedResults = calculateWeightedResults(scenarioResults);

    return {
      framework: 'NextRush v2',
      version: '2.0.0-alpha.1',
      port,
      scenarios: scenarioResults,
      summary: weightedResults,
    };
  } finally {
    if (server) {
      await app.shutdown();
      console.log('   🧹 Server shutdown complete');
    }
  }
}

async function testFramework(adapter: any): Promise<FrameworkResult> {
  const { port, server } = await adapter.setup();
  console.log(`   📡 Server started on port ${port}`);

  try {
    const scenarioResults = await runScenarios(port);
    const weightedResults = calculateWeightedResults(scenarioResults);

    return {
      framework: adapter.getName(),
      version: adapter.getVersion(),
      port,
      scenarios: scenarioResults,
      summary: weightedResults,
    };
  } finally {
    await adapter.teardown();
    console.log('   🧹 Server shutdown complete');
  }
}

function setupIdenticalRoutes(app: any) {
  // Basic API
  app.get('/', ctx => {
    ctx.res.json({
      message: 'API Server',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // Health check
  app.get('/api/health', ctx => {
    ctx.res.json({
      status: 'healthy',
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  });

  // CRUD operations
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
  ];

  app.get('/api/users', ctx => {
    ctx.res.json({
      users,
      total: users.length,
      page: 1,
      limit: 10,
    });
  });

  app.get('/api/users/:id', ctx => {
    const id = parseInt(ctx.params['id'] || '0');
    const user = users.find(u => u.id === id);
    if (!user) {
      ctx.res.status(404).json({ error: 'User not found' });
      return;
    }
    ctx.res.json(user);
  });

  app.post('/api/users', ctx => {
    const body = ctx.body as { name?: string; email?: string };
    const { name, email } = body || {};
    if (!name || !email) {
      ctx.res.status(400).json({ error: 'Name and email are required' });
      return;
    }
    const newUser = {
      id: users.length + 1,
      name,
      email,
    };
    users.push(newUser);
    ctx.res.status(201).json(newUser);
  });

  app.get('/api/search', ctx => {
    const query = ctx.query as { q?: string; page?: string; limit?: string };
    const { q = '', page = '1', limit = '10' } = query;
    const results = users.filter(
      user =>
        user.name.toLowerCase().includes((q || '').toLowerCase()) ||
        user.email.toLowerCase().includes((q || '').toLowerCase())
    );
    ctx.res.json({
      results,
      total: results.length,
      page: parseInt(page),
      limit: parseInt(limit),
      query: q,
    });
  });
}

async function runScenarios(port: number) {
  const scenarioResults = [];

  for (const scenario of TEST_SCENARIOS) {
    console.log(`   🔄 Running: ${scenario.name} (${scenario.description})`);

    const result = await new Promise<any>((resolve, reject) => {
      autocannon(
        {
          url: `http://localhost:${port}${scenario.path}`,
          connections: BENCHMARK_CONFIG.connections,
          duration: BENCHMARK_CONFIG.duration,
          pipelining: BENCHMARK_CONFIG.pipelining,
          timeout: BENCHMARK_CONFIG.timeout,
          method: scenario.method,
          headers: { ...BENCHMARK_CONFIG.headers, ...scenario.headers },
          body: scenario.body,
        },
        (err: any, result: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        }
      );
    });

    scenarioResults.push({
      name: scenario.name,
      weight: scenario.weight,
      ...result,
    });
  }

  return scenarioResults;
}

function calculateWeightedResults(scenarioResults: any[]) {
  let totalWeight = 0;
  let weightedRequests = 0;
  let weightedLatency = 0;
  let weightedThroughput = 0;
  let totalErrors = 0;
  let totalTimeouts = 0;

  for (const result of scenarioResults) {
    totalWeight += result.weight;
    weightedRequests += result.requests.average * result.weight;
    weightedLatency += result.latency.average * result.weight;
    // Convert throughput from bytes/s to MB/s
    const throughputMBps = result.throughput.average / (1024 * 1024);
    weightedThroughput += throughputMBps * result.weight;
    totalErrors += result.errors;
    totalTimeouts += result.timeouts;
  }

  return {
    requests: {
      average: weightedRequests / totalWeight,
    },
    latency: {
      average: weightedLatency / totalWeight,
    },
    throughput: {
      average: weightedThroughput / totalWeight,
    },
    errors: totalErrors,
    timeouts: totalTimeouts,
  };
}
