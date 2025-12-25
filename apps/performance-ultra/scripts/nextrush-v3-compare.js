#!/usr/bin/env node

/**
 * 📈 NextRush v3 Benchmark Comparison Tool
 *
 * Compare benchmark results over time to track performance improvements
 * and regressions for NextRush v3.
 *
 * Features:
 * - List all benchmark history with dates and labels
 * - Compare any two benchmark runs side by side
 * - Show performance trends over time
 * - Highlight improvements and regressions
 *
 * Usage:
 *   pnpm bench:v3:history           # List all runs
 *   pnpm bench:v3:compare           # Compare latest with previous
 *   pnpm bench:v3:compare <id1> <id2>  # Compare specific runs
 *   pnpm bench:v3:compare --trend   # Show trend over last 5 runs
 *
 * @author NextRush Team
 * @version 3.0.0
 */

import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PERFORMANCE_DIR = path.join(__dirname, '..');
const RESULTS_BASE = path.join(PERFORMANCE_DIR, 'results', 'nextrush-v3');

// Colors for terminal output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

/**
 * Get all benchmark runs sorted by date (newest first)
 */
function getAllRuns() {
  if (!fs.existsSync(RESULTS_BASE)) {
    return [];
  }

  return fs
    .readdirSync(RESULTS_BASE)
    .filter((d) => {
      const fullPath = path.join(RESULTS_BASE, d);
      return fs.statSync(fullPath).isDirectory() && d.match(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    })
    .sort()
    .reverse()
    .map((timestamp, index) => {
      const resultsPath = path.join(RESULTS_BASE, timestamp, 'results.json');
      if (!fs.existsSync(resultsPath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      return {
        id: index + 1,
        timestamp,
        displayDate: formatDisplayDate(timestamp),
        label: data.label || '',
        avgRps: data.summary?.avgRps || 0,
        avgLatency: data.summary?.avgLatencyP50 || 0,
        testCount: data.tests?.length || 0,
        data,
      };
    })
    .filter(Boolean);
}

/**
 * Format timestamp for display
 */
function formatDisplayDate(timestamp) {
  const [date, time] = timestamp.split('_');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split('-');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
  const [date, time] = timestamp.split('_');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split('-');

  const benchDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );

  const now = new Date();
  const diffMs = now - benchDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Calculate percentage change
 */
function calcChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format change with color
 */
function formatChange(change, higherIsBetter = true) {
  if (change === null) return `${c.dim}--${c.reset}`;

  const isGood = higherIsBetter ? change > 0 : change < 0;
  const color = Math.abs(change) < 1 ? c.dim : isGood ? c.green : c.red;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const sign = change > 0 ? '+' : '';

  return `${color}${arrow}${sign}${change.toFixed(1)}%${c.reset}`;
}

/**
 * Show benchmark history
 */
function showHistory() {
  const runs = getAllRuns();

  if (runs.length === 0) {
    console.log(`${c.yellow}No benchmark results found for NextRush v3.${c.reset}`);
    console.log(`Run ${c.cyan}pnpm bench:v3${c.reset} to create your first benchmark.`);
    return;
  }

  console.log('');
  console.log(`${c.magenta}╔══════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.magenta}║${c.reset}                        ${c.bold}📊 NextRush v3 Benchmark History${c.reset}                            ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}╚══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  console.log(`${c.yellow}┌────┬─────────────────────┬──────────┬──────────────┬───────────────┬──────────────────────┐${c.reset}`);
  console.log(`${c.yellow}│${c.reset} ${c.bold}ID${c.reset} ${c.yellow}│${c.reset} ${c.bold}Date & Time${c.reset}         ${c.yellow}│${c.reset} ${c.bold}Age${c.reset}      ${c.yellow}│${c.reset} ${c.bold}Avg RPS${c.reset}      ${c.yellow}│${c.reset} ${c.bold}Latency (p50)${c.reset} ${c.yellow}│${c.reset} ${c.bold}Label${c.reset}                ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}├────┼─────────────────────┼──────────┼──────────────┼───────────────┼──────────────────────┤${c.reset}`);

  let prevRps = null;
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i];
    const age = formatRelativeTime(run.timestamp).padEnd(8);
    const rps = run.avgRps.toLocaleString().padStart(10);
    const latency = `${run.avgLatency.toFixed(2)}ms`.padStart(11);
    const label = (run.label || '-').substring(0, 20).padEnd(20);

    // Calculate change from previous run
    let changeStr = '     ';
    if (prevRps !== null) {
      const change = calcChange(run.avgRps, prevRps);
      if (change !== null) {
        const color = change > 1 ? c.green : change < -1 ? c.red : c.dim;
        const sign = change > 0 ? '+' : '';
        changeStr = `${color}${sign}${change.toFixed(0)}%${c.reset}`;
      }
    }

    const idStr = run.id.toString().padStart(2);
    console.log(`${c.yellow}│${c.reset} ${idStr} ${c.yellow}│${c.reset} ${run.displayDate} ${c.yellow}│${c.reset} ${age} ${c.yellow}│${c.reset} ${rps} ${c.yellow}│${c.reset} ${latency} ${c.yellow}│${c.reset} ${label} ${c.yellow}│${c.reset}`);

    prevRps = run.avgRps;
  }

  console.log(`${c.yellow}└────┴─────────────────────┴──────────┴──────────────┴───────────────┴──────────────────────┘${c.reset}`);
  console.log('');
  console.log(`${c.dim}Total: ${runs.length} benchmark run(s)${c.reset}`);
  console.log('');
  console.log(`${c.yellow}💡 Commands:${c.reset}`);
  console.log(`   ${c.cyan}pnpm bench:v3:compare${c.reset}         Compare latest with previous`);
  console.log(`   ${c.cyan}pnpm bench:v3:compare 1 3${c.reset}     Compare run #1 with run #3`);
  console.log(`   ${c.cyan}pnpm bench:v3:trend${c.reset}           Show performance trend`);
  console.log('');
}

/**
 * Compare two benchmark runs
 */
function compareRuns(id1, id2) {
  const runs = getAllRuns();

  if (runs.length < 2) {
    console.log(`${c.yellow}Need at least 2 benchmark runs to compare.${c.reset}`);
    console.log(`Run ${c.cyan}pnpm bench:v3${c.reset} to create more benchmarks.`);
    return;
  }

  // Default: compare latest with previous
  let run1, run2;

  if (id1 && id2) {
    run1 = runs.find((r) => r.id === parseInt(id1, 10));
    run2 = runs.find((r) => r.id === parseInt(id2, 10));

    if (!run1 || !run2) {
      console.log(`${c.red}Invalid run ID(s). Use ${c.cyan}pnpm bench:v3:history${c.red} to see available runs.${c.reset}`);
      return;
    }
  } else {
    run1 = runs[0]; // Latest
    run2 = runs[1]; // Previous
  }

  console.log('');
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}                        ${c.bold}📈 NextRush v3 Benchmark Comparison${c.reset}                                   ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  // Run info
  console.log(`${c.green}▶ Run #${run1.id} (${run1.displayDate})${c.reset}${run1.label ? ` - ${run1.label}` : ''}`);
  console.log(`${c.blue}▷ Run #${run2.id} (${run2.displayDate})${c.reset}${run2.label ? ` - ${run2.label}` : ''}`);
  console.log('');

  // Comparison table
  console.log(`${c.yellow}┌────────────────────┬───────────────┬───────────────┬───────────────┬───────────────┐${c.reset}`);
  console.log(`${c.yellow}│${c.reset} ${c.bold}Test${c.reset}               ${c.yellow}│${c.reset} ${c.bold}#${run1.id} RPS${c.reset}       ${c.yellow}│${c.reset} ${c.bold}#${run2.id} RPS${c.reset}       ${c.yellow}│${c.reset} ${c.bold}Change${c.reset}        ${c.yellow}│${c.reset} ${c.bold}Latency Δ${c.reset}     ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}├────────────────────┼───────────────┼───────────────┼───────────────┼───────────────┤${c.reset}`);

  const tests1 = run1.data.tests;
  const tests2 = run2.data.tests;

  let totalImprovement = 0;
  let testCount = 0;

  for (const test1 of tests1) {
    const test2 = tests2.find((t) => t.test === test1.test);
    if (!test2) continue;

    const rps1 = Math.round(test1.requests.average);
    const rps2 = Math.round(test2.requests.average);
    const rpsChange = calcChange(rps1, rps2);

    const lat1 = test1.latency.p50;
    const lat2 = test2.latency.p50;
    const latChange = calcChange(lat1, lat2);

    const testName = test1.title.padEnd(18);
    const rps1Str = rps1.toLocaleString().padStart(11);
    const rps2Str = rps2.toLocaleString().padStart(11);
    const rpsChangeStr = formatChange(rpsChange, true);
    const latChangeStr = formatChange(latChange, false);

    console.log(`${c.yellow}│${c.reset} ${testName} ${c.yellow}│${c.reset} ${rps1Str} ${c.yellow}│${c.reset} ${rps2Str} ${c.yellow}│${c.reset} ${rpsChangeStr.padEnd(22)} ${c.yellow}│${c.reset} ${latChangeStr.padEnd(22)} ${c.yellow}│${c.reset}`);

    if (rpsChange !== null) {
      totalImprovement += rpsChange;
      testCount++;
    }
  }

  console.log(`${c.yellow}└────────────────────┴───────────────┴───────────────┴───────────────┴───────────────┘${c.reset}`);
  console.log('');

  // Summary
  const avgImprovement = testCount > 0 ? totalImprovement / testCount : 0;
  const summaryColor = avgImprovement > 1 ? c.green : avgImprovement < -1 ? c.red : c.yellow;
  const summaryText = avgImprovement > 1 ? 'IMPROVEMENT' : avgImprovement < -1 ? 'REGRESSION' : 'NO SIGNIFICANT CHANGE';

  console.log(`${c.yellow}┌───────────────────────────────────────────────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.yellow}│${c.reset}                                 ${c.bold}Summary${c.reset}                                            ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}├───────────────────────────────────────────────────────────────────────────────────────┤${c.reset}`);
  console.log(`${c.yellow}│${c.reset}                                                                                       ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}   ${summaryColor}${c.bold}${summaryText}${c.reset}                                                                    ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}                                                                                       ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}   Average RPS Change: ${formatChange(avgImprovement, true)}                                                    ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}   Run #${run1.id} Avg RPS: ${run1.avgRps.toLocaleString()}                                                       ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}   Run #${run2.id} Avg RPS: ${run2.avgRps.toLocaleString()}                                                       ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}│${c.reset}                                                                                       ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}└───────────────────────────────────────────────────────────────────────────────────────┘${c.reset}`);
  console.log('');
}

/**
 * Show performance trend
 */
function showTrend() {
  const runs = getAllRuns();

  if (runs.length < 2) {
    console.log(`${c.yellow}Need at least 2 benchmark runs to show trend.${c.reset}`);
    return;
  }

  // Take last 10 runs (reversed to chronological order)
  const trendRuns = runs.slice(0, 10).reverse();

  console.log('');
  console.log(`${c.magenta}╔══════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.magenta}║${c.reset}                        ${c.bold}📈 Performance Trend (Last ${trendRuns.length} Runs)${c.reset}                         ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}╚══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  // Find min/max for scaling
  const rpsValues = trendRuns.map((r) => r.avgRps);
  const maxRps = Math.max(...rpsValues);
  const minRps = Math.min(...rpsValues);
  const range = maxRps - minRps || 1;

  // ASCII chart
  const chartWidth = 50;
  const chartHeight = 10;

  console.log(`${c.dim}RPS${c.reset}`);
  console.log(`${c.dim}${maxRps.toLocaleString().padStart(8)}${c.reset} ┤`);

  for (let row = chartHeight - 1; row >= 0; row--) {
    const threshold = minRps + (range * row) / (chartHeight - 1);
    let line = '';

    for (let i = 0; i < trendRuns.length; i++) {
      const run = trendRuns[i];
      const normalizedValue = ((run.avgRps - minRps) / range) * (chartHeight - 1);
      const barHeight = Math.round(normalizedValue);

      if (row === barHeight) {
        line += `${c.green}●${c.reset}`;
      } else if (row < barHeight) {
        line += `${c.green}│${c.reset}`;
      } else {
        line += ' ';
      }

      // Spacing
      if (i < trendRuns.length - 1) {
        if (row === barHeight && Math.round(((trendRuns[i + 1].avgRps - minRps) / range) * (chartHeight - 1)) === row) {
          line += `${c.green}──${c.reset}`;
        } else {
          line += '  ';
        }
      }
    }

    if (row === Math.floor(chartHeight / 2)) {
      console.log(`${c.dim}${Math.round(minRps + range / 2).toLocaleString().padStart(8)}${c.reset} ┤ ${line}`);
    } else {
      console.log(`         ┤ ${line}`);
    }
  }

  console.log(`${c.dim}${minRps.toLocaleString().padStart(8)}${c.reset} ┤`);
  console.log('         └' + '─'.repeat(trendRuns.length * 3));

  // Labels
  let labelLine = '          ';
  for (let i = 0; i < trendRuns.length; i++) {
    labelLine += `${i + 1}  `;
  }
  console.log(`${c.dim}${labelLine}${c.reset}`);
  console.log(`${c.dim}          Run #${c.reset}`);
  console.log('');

  // Stats
  const firstRps = trendRuns[0].avgRps;
  const lastRps = trendRuns[trendRuns.length - 1].avgRps;
  const overallChange = calcChange(lastRps, firstRps);

  console.log(`${c.yellow}Trend Summary:${c.reset}`);
  console.log(`  First run: ${firstRps.toLocaleString()} RPS`);
  console.log(`  Latest run: ${lastRps.toLocaleString()} RPS`);
  console.log(`  Overall change: ${formatChange(overallChange, true)}`);
  console.log(`  Max: ${maxRps.toLocaleString()} RPS`);
  console.log(`  Min: ${minRps.toLocaleString()} RPS`);
  console.log('');
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('');
    console.log(`${c.bold}NextRush v3 Benchmark Comparison Tool${c.reset}`);
    console.log('');
    console.log('Usage:');
    console.log(`  ${c.cyan}pnpm bench:v3:history${c.reset}         List all benchmark runs`);
    console.log(`  ${c.cyan}pnpm bench:v3:compare${c.reset}         Compare latest with previous`);
    console.log(`  ${c.cyan}pnpm bench:v3:compare 1 3${c.reset}     Compare run #1 with run #3`);
    console.log(`  ${c.cyan}pnpm bench:v3:trend${c.reset}           Show performance trend`);
    console.log('');
    return;
  }

  if (args.includes('--trend') || args.includes('trend')) {
    showTrend();
    return;
  }

  if (args.includes('--history') || args.includes('history') || args.length === 0) {
    // Check if this is called as 'history' command
    const scriptName = process.argv[1];
    if (scriptName && scriptName.includes('history')) {
      showHistory();
      return;
    }
  }

  // Default: compare mode
  const numericArgs = args.filter((a) => /^\d+$/.test(a));
  if (numericArgs.length >= 2) {
    compareRuns(numericArgs[0], numericArgs[1]);
  } else if (args.length === 0 || args.includes('--compare') || args.includes('compare')) {
    compareRuns();
  } else {
    showHistory();
  }
}

// Export for different entry points
export { compareRuns, showHistory, showTrend };

// Run if main
main();
