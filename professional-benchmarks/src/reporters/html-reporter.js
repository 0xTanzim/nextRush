#!/usr/bin/env node

/**
 * HTML Report Generator for Professional Benchmarks
 * Creates beautiful, interactive HTML reports from benchmark results
 */

import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';

export class HTMLReporter {
  constructor(resultsDir) {
    this.resultsDir = resultsDir;
  }

  async generateReport() {
    console.log(chalk.cyan('📊 Generating Beautiful HTML Report...'));

    const results = await this.loadAllResults();
    const html = await this.createHTML(results);

    const reportPath = path.join(this.resultsDir, 'benchmark-report.html');
    await fs.writeFile(reportPath, html);

    console.log(chalk.green(`✅ HTML Report generated: ${reportPath}`));
    return reportPath;
  }

  async loadAllResults() {
    const results = {
      frameworks: {},
      summary: {},
      timestamp: new Date().toISOString(),
    };

    // Load Autocannon results
    try {
      const autocannonDir = path.join(this.resultsDir, 'autocannon');
      const files = await fs.readdir(autocannonDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const framework = file.replace('.json', '');
          const data = JSON.parse(
            await fs.readFile(path.join(autocannonDir, file), 'utf8')
          );

          if (!results.frameworks[framework]) {
            results.frameworks[framework] = {};
          }

          results.frameworks[framework].autocannon = {
            rps: Math.round(data.requests?.average || 0),
            latency: parseFloat((data.latency?.average || 0).toFixed(2)),
            throughput: Math.round(data.throughput?.average || 0),
            errors: data.errors || 0,
            duration: data.duration || 0,
          };
        }
      }
    } catch (error) {
      console.warn('Could not load Autocannon results:', error.message);
    }

    // Load Artillery results
    try {
      const artilleryDir = path.join(this.resultsDir, 'artillery');
      const files = await fs.readdir(artilleryDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const framework = file.replace('-artillery-report.json', '');
          const data = JSON.parse(
            await fs.readFile(path.join(artilleryDir, file), 'utf8')
          );

          if (!results.frameworks[framework]) {
            results.frameworks[framework] = {};
          }

          results.frameworks[framework].artillery = {
            scenarios: data.aggregate?.scenariosCompleted || 0,
            requests: data.aggregate?.requestsCompleted || 0,
            errors: data.aggregate?.errors || 0,
            p95: data.aggregate?.latency?.p95 || 0,
            p99: data.aggregate?.latency?.p99 || 0,
          };
        }
      }
    } catch (error) {
      console.warn('Could not load Artillery results:', error.message);
    }

    return results;
  }

  async createHTML(results) {
    const frameworks = Object.keys(results.frameworks);
    const autocannonData = frameworks
      .map((f) => results.frameworks[f].autocannon)
      .filter(Boolean);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NextRush Professional Benchmark Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header h1 {
            font-size: 3rem;
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .header p { color: #666; font-size: 1.2rem; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-5px); }
        .metric-card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        .framework-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .framework-row:last-child { border-bottom: none; }
        .framework-name {
            font-weight: bold;
            text-transform: uppercase;
            color: #333;
        }
        .framework-value {
            font-size: 1.1rem;
            font-weight: 600;
        }
        .chart-container {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .chart-title {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: #667eea;
            text-align: center;
        }
        .winner { color: #4CAF50; font-weight: bold; }
        .footer {
            text-align: center;
            color: rgba(255,255,255,0.8);
            margin-top: 30px;
            font-size: 0.9rem;
        }
        .performance-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge-excellent { background: #4CAF50; color: white; }
        .badge-good { background: #FF9800; color: white; }
        .badge-average { background: #F44336; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 NextRush Professional Benchmark Report</h1>
            <p>Generated on ${new Date(results.timestamp).toLocaleString()}</p>
            <p>Comprehensive performance analysis across multiple frameworks and tools</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>📈 Requests per Second (RPS)</h3>
                ${frameworks
                  .map((framework) => {
                    const rps =
                      results.frameworks[framework].autocannon?.rps || 0;
                    const badge =
                      rps > 1000 ? 'excellent' : rps > 500 ? 'good' : 'average';
                    return `<div class="framework-row">
                    <span class="framework-name">${framework}</span>
                    <span class="framework-value">${rps.toLocaleString()} RPS
                      <span class="performance-badge badge-${badge}">${
                      rps > 1000 ? 'EXCELLENT' : rps > 500 ? 'GOOD' : 'AVERAGE'
                    }</span>
                    </span>
                  </div>`;
                  })
                  .join('')}
            </div>

            <div class="metric-card">
                <h3>⚡ Average Latency (ms)</h3>
                ${frameworks
                  .map((framework) => {
                    const latency =
                      results.frameworks[framework].autocannon?.latency || 0;
                    const badge =
                      latency < 10
                        ? 'excellent'
                        : latency < 50
                        ? 'good'
                        : 'average';
                    return `<div class="framework-row">
                    <span class="framework-name">${framework}</span>
                    <span class="framework-value">${latency}ms
                      <span class="performance-badge badge-${badge}">${
                      latency < 10
                        ? 'EXCELLENT'
                        : latency < 50
                        ? 'GOOD'
                        : 'SLOW'
                    }</span>
                    </span>
                  </div>`;
                  })
                  .join('')}
            </div>

            <div class="metric-card">
                <h3>🎯 Artillery Scenarios</h3>
                ${frameworks
                  .map((framework) => {
                    const scenarios =
                      results.frameworks[framework].artillery?.scenarios || 0;
                    const requests =
                      results.frameworks[framework].artillery?.requests || 0;
                    return `<div class="framework-row">
                    <span class="framework-name">${framework}</span>
                    <span class="framework-value">${scenarios} scenarios, ${requests.toLocaleString()} requests</span>
                  </div>`;
                  })
                  .join('')}
            </div>
        </div>

        <div class="chart-container">
            <div class="chart-title">Performance Comparison</div>
            <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
            <div class="chart-title">Latency Distribution</div>
            <canvas id="latencyChart" width="400" height="200"></canvas>
        </div>

        <div class="footer">
            <p>🏆 Generated by NextRush Professional Benchmarking Suite</p>
            <p>Tools used: Autocannon, Artillery, Clinic.js, K6</p>
        </div>
    </div>

    <script>
        // Performance Chart
        const ctx1 = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(frameworks)},
                datasets: [{
                    label: 'Requests per Second',
                    data: ${JSON.stringify(
                      autocannonData.map((d) => d?.rps || 0)
                    )},
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Latency Chart
        const ctx2 = document.getElementById('latencyChart').getContext('2d');
        new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(frameworks)},
                datasets: [{
                    label: 'Average Latency (ms)',
                    data: ${JSON.stringify(
                      autocannonData.map((d) => d?.latency || 0)
                    )},
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    </script>
</body>
</html>`;
  }
}

export default HTMLReporter;
