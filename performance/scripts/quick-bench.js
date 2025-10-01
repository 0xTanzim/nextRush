#!/usr/bin/env node

/**
 * ⚡ Quick Benchmark - Fast Development Benchmarking
 *
 * Runs a quick benchmark (10s) of NextRush for rapid iteration.
 * Perfect for validating performance improvements during development.
 *
 * Usage:
 *   pnpm bench:quick
 *   pnpm bench:quick --duration 20
 *   pnpm bench:quick --test params
 *
 * @author NextRush Team
 * @version 2.0.0
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const performanceDir = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const durationIndex = args.indexOf('--duration');
const testIndex = args.indexOf('--test');

const duration =
  durationIndex >= 0 ? parseInt(args[durationIndex + 1]) || 10 : 10;
const testType = testIndex >= 0 ? args[testIndex + 1] || 'hello' : 'hello';

console.log('⚡ Quick Benchmark Configuration');
console.log('================================');
console.log(`Duration: ${duration}s`);
console.log(`Test: ${testType}`);
console.log('Framework: NextRush only');
console.log('');

// Start NextRush server
console.log('🚀 Starting NextRush server...');
const server = spawn('node', [join(performanceDir, 'servers', 'nextrush.js')], {
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'production' },
});

// Wait for server to start
let serverReady = false;
server.stdout.on('data', data => {
  const output = data.toString();
  if (
    output.includes('NextRush v2 server running') ||
    output.includes('listening on port 3000')
  ) {
    serverReady = true;
    runBenchmark();
  }
});

server.stderr.on('data', data => {
  console.error('Server error:', data.toString());
});

// Timeout check
setTimeout(() => {
  if (!serverReady) {
    console.error('❌ Server failed to start within 5 seconds');
    server.kill();
    process.exit(1);
  }
}, 5000);

// Run the benchmark
function runBenchmark() {
  console.log('');
  console.log('🔥 Running benchmark...');
  console.log('');

  const autocannon = spawn(
    'npx',
    [
      'autocannon',
      '-c',
      '100',
      '-d',
      duration.toString(),
      '-p',
      '10',
      '-m',
      'GET',
      'http://localhost:3000/',
    ],
    {
      stdio: 'inherit',
    }
  );

  autocannon.on('exit', code => {
    server.kill();

    console.log('');
    console.log('✅ Quick benchmark complete!');
    console.log('');
    console.log('💡 Tips:');
    console.log('  - Run again after code changes to see improvements');
    console.log('  - Target: 25,000+ RPS for production readiness');
    console.log('  - Use --duration 20 for more stable results');
    console.log('');

    process.exit(code || 0);
  });

  autocannon.on('error', error => {
    console.error('❌ Benchmark failed:', error.message);
    server.kill();
    process.exit(1);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏸️  Benchmark interrupted');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
