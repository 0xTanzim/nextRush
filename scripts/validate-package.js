#!/usr/bin/env node

/**
 * Package validation script
 * Tests that the built package exports work correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating NextRush package...\n');

// Check if dist directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist directory not found. Run npm run build first.');
  process.exit(1);
}

// Check main files
const requiredFiles = [
  'dist/index.js',
  'dist/index.d.ts',
  'README.md',
  'package.json',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(__dirname, '..', file))) {
    console.error(`❌ Required file missing: ${file}`);
    process.exit(1);
  }
}

console.log('✅ All required files present');

// Test package.json
try {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  console.log(`✅ Package: ${pkg.name}@${pkg.version}`);
  console.log(`✅ Main: ${pkg.main}`);
  console.log(`✅ Types: ${pkg.types}`);
  console.log(`✅ License: ${pkg.license}`);
  console.log(`✅ Node engines: ${pkg.engines.node}`);
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
  process.exit(1);
}

// Test import (basic syntax check)
try {
  const nextrush = require(path.join(__dirname, '..', 'dist/index.js'));

  const expectedExports = [
    'Application',
    'createApp',
    'createRouter',
    'Router',
    'ResponseHandler',
    'RequestHandler',
    'BodyParser',
    'ErrorHandler',
  ];

  for (const exportName of expectedExports) {
    if (!(exportName in nextrush)) {
      console.error(`❌ Missing export: ${exportName}`);
      process.exit(1);
    }
  }

  console.log('✅ All expected exports available');
} catch (error) {
  console.error('❌ Error importing package:', error.message);
  process.exit(1);
}

console.log('\n🎉 Package validation successful!');
console.log('\n📦 Ready for npm publish');
console.log('\nNext steps:');
console.log('  npm publish --dry-run  # Test publish');
console.log('  npm publish            # Actual publish');
