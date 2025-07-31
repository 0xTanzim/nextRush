#!/usr/bin/env node

/**
 * System Metrics Collector for Professional Benchmarks
 * Monitors memory, CPU, network, and system performance
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemMetricsCollector {
  constructor(framework, outputDir) {
    this.framework = framework;
    this.outputDir = outputDir;
    this.metrics = [];
    this.collecting = false;
    this.interval = null;
  }

  async startCollection() {
    this.collecting = true;
    console.log(
      `📊 Starting system metrics collection for ${this.framework}...`
    );

    this.interval = setInterval(async () => {
      if (this.collecting) {
        await this.collectMetrics();
      }
    }, 1000); // Collect every second
  }

  async stopCollection() {
    this.collecting = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    await this.saveMetrics();
    console.log(`✅ System metrics collection stopped for ${this.framework}`);
  }

  async collectMetrics() {
    try {
      const timestamp = Date.now();
      const nodeProcess = process;

      // Memory metrics
      const memoryUsage = nodeProcess.memoryUsage();

      // CPU usage (requires calculation over time)
      const cpuUsage = nodeProcess.cpuUsage();

      // System memory from /proc/meminfo (Linux only)
      let systemMemory = {};
      try {
        const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
        const lines = meminfo.split('\n');
        for (const line of lines) {
          const [key, value] = line.split(':');
          if (key && value) {
            const numValue = parseInt(value.trim().split(' ')[0]);
            systemMemory[key.trim()] = numValue * 1024; // Convert KB to bytes
          }
        }
      } catch (e) {
        // Not Linux or permission denied
        systemMemory = { error: 'Unable to read system memory' };
      }

      // Load average (Linux/macOS)
      let loadAverage = [];
      try {
        const uptime = await fs.readFile('/proc/loadavg', 'utf8');
        loadAverage = uptime.trim().split(' ').slice(0, 3).map(parseFloat);
      } catch (e) {
        // Fallback to Node.js os module
        const os = await import('os');
        loadAverage = os.loadavg();
      }

      // Network statistics (Linux only)
      let networkStats = {};
      try {
        const netdev = await fs.readFile('/proc/net/dev', 'utf8');
        const lines = netdev.split('\n');
        for (const line of lines) {
          if (line.includes(':')) {
            const [iface, stats] = line.split(':');
            const ifaceName = iface.trim();
            const values = stats.trim().split(/\s+/).map(Number);
            if (values.length >= 16) {
              networkStats[ifaceName] = {
                rx_bytes: values[0],
                rx_packets: values[1],
                rx_errors: values[2],
                tx_bytes: values[8],
                tx_packets: values[9],
                tx_errors: values[10],
              };
            }
          }
        }
      } catch (e) {
        networkStats = { error: 'Unable to read network stats' };
      }

      // File descriptor count
      let fdCount = 0;
      try {
        const fdDir = await fs.readdir(`/proc/${nodeProcess.pid}/fd`);
        fdCount = fdDir.length;
      } catch (e) {
        fdCount = -1;
      }

      // TCP connection count
      let tcpConnections = 0;
      try {
        const tcpFile = await fs.readFile('/proc/net/tcp', 'utf8');
        tcpConnections = tcpFile.split('\n').length - 2; // Exclude header and empty line
      } catch (e) {
        tcpConnections = -1;
      }

      const metric = {
        timestamp,
        framework: this.framework,
        process: {
          pid: nodeProcess.pid,
          uptime: nodeProcess.uptime(),
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          fileDescriptors: fdCount,
        },
        system: {
          loadAverage,
          memory: systemMemory,
          network: networkStats,
          tcpConnections,
        },
      };

      this.metrics.push(metric);

      // Keep only last 300 metrics (5 minutes at 1s intervals)
      if (this.metrics.length > 300) {
        this.metrics = this.metrics.slice(-300);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to collect metrics: ${error.message}`);
    }
  }

  async saveMetrics() {
    if (this.metrics.length === 0) {
      return;
    }

    const outputFile = path.join(
      this.outputDir,
      `${this.framework}-metrics.json`
    );

    // Calculate summary statistics
    const summary = this.calculateSummary();

    const output = {
      framework: this.framework,
      collection: {
        startTime: this.metrics[0]?.timestamp,
        endTime: this.metrics[this.metrics.length - 1]?.timestamp,
        duration:
          this.metrics.length > 0
            ? (this.metrics[this.metrics.length - 1].timestamp -
                this.metrics[0].timestamp) /
              1000
            : 0,
        sampleCount: this.metrics.length,
      },
      summary,
      metrics: this.metrics,
    };

    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
    console.log(`📊 Metrics saved: ${outputFile}`);
  }

  calculateSummary() {
    if (this.metrics.length === 0) return {};

    const heapUsed = this.metrics.map((m) => m.process.memory.heapUsed);
    const rss = this.metrics.map((m) => m.process.memory.rss);
    const loadAvg = this.metrics
      .map((m) => m.system.loadAverage[0])
      .filter((v) => !isNaN(v));

    return {
      memory: {
        heapUsed: {
          min: Math.min(...heapUsed),
          max: Math.max(...heapUsed),
          avg: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length,
        },
        rss: {
          min: Math.min(...rss),
          max: Math.max(...rss),
          avg: rss.reduce((a, b) => a + b, 0) / rss.length,
        },
      },
      cpu: {
        loadAverage: {
          min: loadAvg.length > 0 ? Math.min(...loadAvg) : 0,
          max: loadAvg.length > 0 ? Math.max(...loadAvg) : 0,
          avg:
            loadAvg.length > 0
              ? loadAvg.reduce((a, b) => a + b, 0) / loadAvg.length
              : 0,
        },
      },
      fileDescriptors: {
        max: Math.max(
          ...this.metrics
            .map((m) => m.process.fileDescriptors)
            .filter((v) => v > 0)
        ),
      },
    };
  }

  // Static method to generate metrics report
  static async generateMetricsReport(outputDir) {
    try {
      const files = await fs.readdir(outputDir);
      const metricsFiles = files.filter((f) => f.endsWith('-metrics.json'));

      const report = {
        generatedAt: new Date().toISOString(),
        frameworks: {},
      };

      for (const file of metricsFiles) {
        const framework = file.replace('-metrics.json', '');
        const data = JSON.parse(
          await fs.readFile(path.join(outputDir, file), 'utf8')
        );
        report.frameworks[framework] = data.summary;
      }

      const reportFile = path.join(outputDir, 'system-metrics-report.json');
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      console.log(`📊 System metrics report generated: ${reportFile}`);
      return report;
    } catch (error) {
      console.warn(`⚠️ Failed to generate metrics report: ${error.message}`);
      return null;
    }
  }
}

export default SystemMetricsCollector;
