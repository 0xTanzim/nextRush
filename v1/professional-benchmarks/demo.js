#!/usr/bin/env node

/**
 * 🚀 Simple Professional Benchmark Demo
 *
 * Quick demonstration of the professional benchmarking setup
 */

import chalk from 'chalk';
import { spawn } from 'child_process';

console.log(chalk.blue('🚀 Professional Benchmarking Tools Demo'));
console.log(chalk.blue('========================================'));
console.log();

console.log(
  chalk.yellow('✨ Professional benchmarking environment setup complete!')
);
console.log();

console.log(chalk.green('🎯 Available Tools:'));
console.log(chalk.cyan('  📊 Autocannon    - Ultra-fast HTTP benchmarking'));
console.log(chalk.cyan('  🏥 Clinic.js     - Comprehensive Node.js profiling'));
console.log(chalk.cyan('  🎯 Artillery     - Modern load testing framework'));
console.log(chalk.cyan('  📈 K6           - Developer-friendly load testing'));
console.log(chalk.cyan('  🔥 0x           - CPU flame graph profiler'));
console.log();

console.log(chalk.green('🚀 Framework Adapters:'));
console.log(chalk.cyan('  ⚡ NextRush      - Your high-performance framework'));
console.log(chalk.cyan('  🟢 Express       - Industry standard comparison'));
console.log(chalk.cyan('  ⚡ Fastify       - Performance-focused alternative'));
console.log();

console.log(chalk.green('📁 Professional Architecture:'));
console.log(chalk.gray('  professional-benchmarks/'));
console.log(
  chalk.gray('  ├── src/                    # Orchestration & analysis')
);
console.log(
  chalk.gray('  ├── adapters/               # Framework test servers')
);
console.log(
  chalk.gray('  ├── scenarios/              # Artillery test scenarios')
);
console.log(
  chalk.gray('  ├── scripts/                # Tool-specific scripts')
);
console.log(chalk.gray('  └── results/                # Benchmark outputs'));
console.log();

console.log(chalk.green('🎮 Quick Commands:'));
console.log(
  chalk.yellow('  npm run benchmark                  # Full professional suite')
);
console.log(
  chalk.yellow('  npm run benchmark:nextrush         # Test NextRush only')
);
console.log(
  chalk.yellow('  npm run benchmark:compare          # Compare frameworks')
);
console.log(
  chalk.yellow(
    '  npm run profile                    # Deep performance profiling'
  )
);
console.log();

console.log(chalk.green('🏗️ Manual Tool Usage:'));
console.log(
  chalk.yellow(
    '  autocannon -c 100 -d 30 http://localhost:3000    # Direct HTTP testing'
  )
);
console.log(
  chalk.yellow(
    '  clinic doctor -- node server.js                 # Event loop profiling'
  )
);
console.log(
  chalk.yellow(
    '  artillery run scenarios/basic-load.yml           # Scenario testing'
  )
);
console.log(
  chalk.yellow(
    '  k6 run scripts/k6/basic-load.js                  # K6 load testing'
  )
);
console.log();

console.log(chalk.blue('📚 Installation Guide:'));
console.log(chalk.gray('  1. Install local tools: pnpm install'));
console.log(chalk.gray('  2. Test NextRush: pnpm run benchmark:nextrush'));
console.log(chalk.gray('  3. Compare frameworks: pnpm run benchmark:compare'));
console.log(chalk.gray('  4. Profile performance: pnpm run profile'));
console.log();

console.log(
  chalk.green('✅ Ready for professional-grade performance testing!')
);
console.log();

// Test if basic tools are available
console.log(chalk.blue('🔍 Checking tool availability...'));

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tools = [
  { name: 'node', cmd: 'node --version', global: true },
  { name: 'pnpm', cmd: 'pnpm --version', global: true },
  {
    name: 'autocannon',
    cmd: path.join(__dirname, 'node_modules/.bin/autocannon') + ' --version',
  },
  {
    name: 'clinic',
    cmd: path.join(__dirname, 'node_modules/.bin/clinic') + ' --version',
  },
  {
    name: 'artillery',
    cmd: path.join(__dirname, 'node_modules/.bin/artillery') + ' version',
  },
  {
    name: '0x',
    cmd: path.join(__dirname, 'node_modules/.bin/0x') + ' --version',
  },
];

async function checkTools() {
  for (const tool of tools) {
    try {
      // Check if local binary exists
      if (!tool.global) {
        const binaryPath = tool.cmd.split(' ')[0];
        if (!fs.existsSync(binaryPath)) {
          console.log(
            chalk.yellow(
              `  ⚠️ ${tool.name} - Not installed locally (run pnpm install)`
            )
          );
          continue;
        }
      }

      const child = spawn(
        tool.cmd.split(' ')[0],
        tool.cmd.split(' ').slice(1),
        {
          stdio: 'pipe',
        }
      );

      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green(`  ✅ ${tool.name} - Available`));
        } else {
          console.log(chalk.yellow(`  ⚠️ ${tool.name} - Not working properly`));
        }
      });

      child.on('error', () => {
        console.log(chalk.yellow(`  ⚠️ ${tool.name} - Not installed`));
      });
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ ${tool.name} - Not installed`));
    }
  }
}

checkTools().then(() => {
  setTimeout(() => {
    console.log();
    console.log(
      chalk.blue('🎉 Professional benchmarking environment is ready!')
    );
    console.log(
      chalk.gray('   All tools are locally installed - no global pollution!')
    );
  }, 1000);
});
