/**
 * 🖥️ System Monitor - NextRush Framework
 *
 * Monitor system performance metrics.
 */

import * as os from 'os';
import { SystemMetrics } from './interfaces';

/**
 * System metrics collector
 */
export class SystemMonitor {
  private startTime = Date.now();
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    return {
      uptime: Date.now() - this.startTime,
      memory: this.getMemoryMetrics(),
      cpu: this.getCpuMetrics(),
      process: this.getProcessMetrics(),
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      used: usedMem,
      total: totalMem,
      heap: memUsage,
    };
  }

  /**
   * Get CPU metrics
   */
  private getCpuMetrics() {
    const usage = this.calculateCpuUsage();
    const load = os.loadavg();

    return {
      usage,
      load,
    };
  }

  /**
   * Get process metrics
   */
  private getProcessMetrics() {
    return {
      pid: process.pid,
      uptime: process.uptime(),
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(): number {
    const currentUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastCpuTime;

    if (timeDiff === 0) return 0;

    // Convert microseconds to milliseconds
    const totalCpuTime = (currentUsage.user + currentUsage.system) / 1000;
    const usage = (totalCpuTime / timeDiff) * 100;

    // Update for next calculation
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;

    return Math.min(Math.max(usage, 0), 100); // Clamp between 0-100
  }

  /**
   * Reset monitoring
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = Date.now();
  }
}
