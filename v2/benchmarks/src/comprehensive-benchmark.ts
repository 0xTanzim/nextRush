#!/usr/bin/env tsx

/**
 * 🚀 Comprehensive NextRush v2 Benchmark
 *
 * Complete benchmark suite with report generation
 */

import autocannon from 'autocannon';
import { createApp } from 'nextrush-v2';
import { ExpressAdapter } from './adapters/express.js';
import { FastifyAdapter } from './adapters/fastify.js';
import { KoaAdapter } from './adapters/koa.js';
import { ReportGenerator } from './report-generator.js';
import type { FrameworkResult } from './types.js';

interface BenchmarkConfig {
  duration?: number;
  concurrent?: number;
  requests?: number;
  profile?: boolean;
  memory?: boolean;
  cpu?: boolean;
  output?: string;
}

async function runComprehensiveBenchmark(config: BenchmarkConfig = {}) {
  console.log('🚀 NextRush v2 Comprehensive Benchmark');
  console.log('=======================================\n');

  const results: FrameworkResult[] = [];
  const benchmarkConfig = {
    duration: config.duration || 10,
    concurrent: config.concurrent || 10,
    requests: config.requests || 1000,
  };

  // Test all frameworks
  const frameworks = [
    { name: 'NextRush v2', adapter: null, testFn: testNextRushV2 },
    {
      name: 'Express.js',
      adapter: new ExpressAdapter(),
      testFn: testFramework,
    },
    { name: 'Fastify', adapter: new FastifyAdapter(), testFn: testFramework },
    { name: 'Koa.js', adapter: new KoaAdapter(), testFn: testFramework },
  ];

  for (const framework of frameworks) {
    console.log(`\n🔍 Testing ${framework.name}...`);
    try {
      const result = await framework.testFn(framework.adapter, benchmarkConfig);
      results.push(result);
      console.log(`✅ ${framework.name} completed successfully`);
    } catch (error) {
      console.error(`❌ ${framework.name} failed:`, error);
    }
  }

  // Generate comprehensive report
  console.log('\n📊 Generating comprehensive report...');
  const reportGenerator = new ReportGenerator();

  if (results.length === 0) {
    console.log('❌ No results to generate report from');
    return;
  }

  const winner = results.reduce((prev, current) =>
    prev.summary.requests.average > current.summary.requests.average
      ? prev
      : current
  );

  const reportPath = await reportGenerator.generateReport({
    results,
    config: benchmarkConfig,
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
        performance: 100, // Will be calculated relative to winner
        latency: result.summary.latency.average,
        throughput: result.summary.throughput.average,
      })),
    },
  });

  console.log('✅ Comprehensive benchmark completed!');
  console.log(`📄 Report saved to: ${reportPath}`);

  // Display summary
  console.log('\n📊 Summary:');
  console.log('===========');

  const sortedResults = results.sort(
    (a, b) => b.summary.requests.average - a.summary.requests.average
  );
  const winnerResult = sortedResults[0];

  if (winnerResult) {
    console.log(`🏆 Winner: ${winnerResult.framework} ${winnerResult.version}`);
    console.log(
      `📈 Requests/sec: ${winnerResult.summary.requests.average.toFixed(2)}`
    );
    console.log(
      `⏱️  Latency (ms): ${winnerResult.summary.latency.average.toFixed(2)}`
    );
    console.log(
      `📊 Throughput: ${winnerResult.summary.throughput.average.toFixed(2)} MB/s`
    );
    console.log(`❌ Errors: ${winnerResult.summary.errors}`);
    console.log(`⏰ Timeouts: ${winnerResult.summary.timeouts}`);

    console.log('\n📋 Framework Rankings:');
    console.log('=====================');
    sortedResults.forEach((result, index) => {
      const performance = (
        (result.summary.requests.average /
          winnerResult.summary.requests.average) *
        100
      ).toFixed(1);
      console.log(`${index + 1}. ${result.framework} ${result.version}`);
      console.log(
        `   📈 ${result.summary.requests.average.toFixed(2)} req/s (${performance}% of winner)`
      );
      console.log(
        `   ⏱️  ${result.summary.latency.average.toFixed(2)}ms latency`
      );
      console.log(
        `   📊 ${result.summary.throughput.average.toFixed(2)} MB/s throughput`
      );
      console.log('');
    });
  }

  console.log('✔ Benchmarks completed');
}

async function testNextRushV2(config: any): Promise<FrameworkResult> {
  const app = createApp();

  // Setup comprehensive middleware
  app.use(app.cors());
  app.use(app.helmet());
  app.use(app.requestId());
  app.use(app.timer());
  app.use(app.compression());
  app.use(app.smartBodyParser());
  app.use(app.logger());
  app.use(app.rateLimit());

  // Basic API
  app.get('/', ctx => {
    ctx.res.json({
      message: 'NextRush v2 API',
      version: '2.0.0-alpha.1',
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

  app.put('/api/users/:id', ctx => {
    const id = parseInt(ctx.params['id'] || '0');
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      ctx.res.status(404).json({ error: 'User not found' });
      return;
    }
    const body = ctx.body as { name?: string; email?: string };
    const { name, email } = body || {};
    users[userIndex] = {
      ...users[userIndex],
      name: name || users[userIndex].name,
      email: email || users[userIndex].email,
    };
    ctx.res.json(users[userIndex]);
  });

  app.get('/api/search', ctx => {
    const query = ctx.query as { q?: string; page?: string; limit?: string };
    const { q = '', page = '1', limit = '20' } = query;
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

  app.post('/api/upload', ctx => {
    const data = ctx.body;
    ctx.res.json({
      message: 'Data received',
      size: JSON.stringify(data).length,
      items: Array.isArray(data) ? data.length : 1,
      timestamp: Date.now(),
    });
  });

  app.get('/api/middleware-test', ctx => {
    ctx.res.json({
      headers: ctx.headers,
      ip: ctx.ip,
      method: ctx.method,
      url: ctx.url,
      timestamp: Date.now(),
    });
  });

  // Start server
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
          console.log(`📡 NextRush server started on port ${port}`);
          resolve();
        } else {
          setTimeout(checkServer, 100);
        }
      };
      checkServer();
    });

    // Run comprehensive scenarios
    const scenarios = [
      { name: 'Basic API', path: '/', weight: 0.15 },
      { name: 'Health Check', path: '/api/health', weight: 0.1 },
      { name: 'CRUD - List Users', path: '/api/users', weight: 0.2 },
      { name: 'CRUD - Get User', path: '/api/users/1', weight: 0.15 },
      {
        name: 'CRUD - Create User',
        path: '/api/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
        weight: 0.15,
      },
      {
        name: 'CRUD - Update User',
        path: '/api/users/1',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated User',
          email: 'updated@example.com',
        }),
        weight: 0.1,
      },
      {
        name: 'Complex Query',
        path: '/api/search?q=test&page=1&limit=20',
        weight: 0.1,
      },
      {
        name: 'Large Payload',
        path: '/api/upload',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array(50).fill({ data: 'large payload test' })),
        weight: 0.05,
      },
    ];

    const scenarioResults = [];

    for (const scenario of scenarios) {
      console.log(`  🔄 Running scenario: ${scenario.name}`);

      const result = await new Promise<any>((resolve, reject) => {
        autocannon(
          {
            url: `http://localhost:${port}${scenario.path}`,
            connections: config.concurrent,
            duration: config.duration,
            pipelining: 1,
            method: scenario.method || 'GET',
            headers: scenario.headers || {},
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

    // Calculate weighted average
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
      console.log('🧹 NextRush server shutdown complete');
    }
  }
}

async function testFramework(
  adapter: any,
  config: any
): Promise<FrameworkResult> {
  const { port, server } = await adapter.setup();

  try {
    // Run comprehensive scenarios
    const scenarios = [
      { name: 'Basic API', path: '/', weight: 0.15 },
      { name: 'Health Check', path: '/api/health', weight: 0.1 },
      { name: 'CRUD - List Users', path: '/api/users', weight: 0.2 },
      { name: 'CRUD - Get User', path: '/api/users/1', weight: 0.15 },
      {
        name: 'CRUD - Create User',
        path: '/api/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
        weight: 0.15,
      },
      {
        name: 'CRUD - Update User',
        path: '/api/users/1',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated User',
          email: 'updated@example.com',
        }),
        weight: 0.1,
      },
      {
        name: 'Complex Query',
        path: '/api/search?q=test&page=1&limit=20',
        weight: 0.1,
      },
      {
        name: 'Large Payload',
        path: '/api/upload',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array(50).fill({ data: 'large payload test' })),
        weight: 0.05,
      },
    ];

    const scenarioResults = [];

    for (const scenario of scenarios) {
      console.log(`  🔄 Running scenario: ${scenario.name}`);

      const result = await new Promise<any>((resolve, reject) => {
        autocannon(
          {
            url: `http://localhost:${port}${scenario.path}`,
            connections: config.concurrent,
            duration: config.duration,
            pipelining: 1,
            method: scenario.method || 'GET',
            headers: scenario.headers || {},
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

    // Calculate weighted average
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
  }
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
    // Convert throughput from bytes/s to MB/s (1 MB = 1024 * 1024 bytes)
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

export { runComprehensiveBenchmark };
