#!/usr/bin/env node

/**
 * Quick Results Viewer
 * Shows current benchmark results with comparison
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../results');
const FRAMEWORKS = ['nextrush', 'express', 'koa', 'fastify'];
const TESTS = ['hello', 'params', 'query', 'post', 'mixed'];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║          📊 Quick Benchmark Results View 📊             ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Check what results we have
const results = {};
let totalTests = 0;
let completedTests = 0;

for (const framework of FRAMEWORKS) {
  results[framework] = {};

  for (const test of TESTS) {
    totalTests++;
    const filename = `${framework}-${test}-autocannon.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    if (fs.existsSync(filepath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        results[framework][test] = data;
        completedTests++;
      } catch (err) {
        // Ignore parse errors
      }
    }
  }
}

// Progress
const progress = Math.round((completedTests / totalTests) * 100);
console.log(`Progress: ${completedTests}/${totalTests} tests (${progress}%)\n`);

// Show what we have
console.log('Completed Tests:\n');

const table = [];
for (const framework of FRAMEWORKS) {
  const completed = Object.keys(results[framework]).filter(
    test => results[framework][test]
  );

  if (completed.length > 0) {
    const avgRps =
      completed.reduce((sum, test) => {
        return sum + (results[framework][test]?.rps || 0);
      }, 0) / completed.length;

    console.log(
      `  ${framework.toUpperCase()}: ${completed.length}/5 tests - Avg RPS: ${Math.round(avgRps).toLocaleString()}`
    );
    table.push({
      framework,
      count: completed.length,
      avgRps: Math.round(avgRps),
    });
  } else {
    console.log(`  ${framework.toUpperCase()}: 0/5 tests - Waiting...`);
  }
}

if (completedTests === totalTests) {
  console.log('\n✅ All tests complete!');
  console.log('\nRun comparison:');
  console.log('  pnpm compare\n');

  // Quick comparison
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('            QUICK COMPARISON (Average RPS)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  table.sort((a, b) => b.avgRps - a.avgRps);

  for (let i = 0; i < table.length; i++) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const { framework, avgRps } = table[i];
    console.log(
      `  ${medal} ${framework.padEnd(10)} ${avgRps.toLocaleString().padStart(10)} RPS`
    );
  }

  console.log('\n');
} else {
  console.log(
    `\n⏳ Benchmarks still running... (${totalTests - completedTests} tests remaining)\n`
  );
}
