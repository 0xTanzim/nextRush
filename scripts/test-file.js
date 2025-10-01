#!/usr/bin/env node

/**
 * 🧪 Smart Test Runner - Run Specific Test Files
 *
 * Runs individual test files without executing the entire suite.
 * Saves development time by providing fast feedback loops.
 *
 * Usage:
 *   pnpm test:file application.test.ts
 *   pnpm test:file optimized-router.test.ts
 *   pnpm test:file logger
 *
 * @author NextRush Team
 * @version 2.0.0
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Get test file pattern from command line
const testPattern = process.argv[2];

if (!testPattern) {
  console.error('❌ Error: Please provide a test file pattern');
  console.log('');
  console.log('Usage:');
  console.log('  pnpm test:file <pattern>');
  console.log('');
  console.log('Examples:');
  console.log('  pnpm test:file application.test.ts');
  console.log('  pnpm test:file optimized-router');
  console.log('  pnpm test:file logger');
  console.log('  pnpm test:file integration/app');
  process.exit(1);
}

console.log('🧪 Running tests matching:', testPattern);
console.log('');

// Build the file pattern for vitest - match from src/tests directory
const filePattern =
  testPattern.endsWith('.test.ts') || testPattern.endsWith('.spec.ts')
    ? `src/tests/**/${testPattern}`
    : `src/tests/**/*${testPattern}*.test.ts`;

console.log('📁 File pattern:', filePattern);
console.log('');

// Run vitest with the specific file pattern
const vitest = spawn('npx', ['vitest', 'run', filePattern], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
});

vitest.on('exit', code => {
  process.exit(code || 0);
});

vitest.on('error', error => {
  console.error('❌ Failed to run tests:', error.message);
  process.exit(1);
});
