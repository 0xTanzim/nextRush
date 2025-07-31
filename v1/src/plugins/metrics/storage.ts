/**
 * 📊 Metrics Storage - NextRush Framework
 *
 * High-performance storage for metrics with memory management.
 */

import { MetricValue } from './interfaces';

/**
 * High-performance metrics storage
 */
export class MetricsStorage {
  private metrics = new Map<string, Map<string, MetricValue>>();
  private responseTimes: number[] = [];
  private responseTimeIndex = 0;
  private readonly maxResponseTimes = 1000;
  private lastCleanup = Date.now();

  /**
   * Store a metric value
   */
  setMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.metrics.get(name) || new Map();

    metricMap.set(key, {
      value,
      labels,
      timestamp: Date.now(),
    });

    this.metrics.set(name, metricMap);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
  ): void {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.metrics.get(name) || new Map();
    const existing = metricMap.get(key) || {
      value: 0,
      labels,
      timestamp: Date.now(),
    };

    existing.value += value;
    existing.timestamp = Date.now();
    metricMap.set(key, existing);
    this.metrics.set(name, metricMap);
  }

  /**
   * Get metric value
   */
  getMetric(
    name: string,
    labels?: Record<string, string>
  ): MetricValue | undefined {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.metrics.get(name);
    return metricMap?.get(key);
  }

  /**
   * Get all metrics for a name
   */
  getMetrics(name: string): MetricValue[] {
    const metricMap = this.metrics.get(name);
    return metricMap ? Array.from(metricMap.values()) : [];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Add response time for percentile calculation
   */
  addResponseTime(time: number): void {
    this.responseTimes[this.responseTimeIndex] = time;
    this.responseTimeIndex =
      (this.responseTimeIndex + 1) % this.maxResponseTimes;
  }

  /**
   * Calculate response time percentiles
   */
  getPercentiles(): { p95: number; p99: number } {
    const times = this.responseTimes.filter((t) => t > 0).sort((a, b) => a - b);
    if (times.length === 0) return { p95: 0, p99: 0 };

    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);

    return {
      p95: times[p95Index] || 0,
      p99: times[p99Index] || 0,
    };
  }

  /**
   * Clean up old metrics
   */
  cleanup(maxAge: number = 5 * 60 * 1000): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60000) return; // Clean at most once per minute

    for (const [metricName, metricMap] of this.metrics.entries()) {
      for (const [key, metric] of metricMap.entries()) {
        if (now - metric.timestamp > maxAge) {
          metricMap.delete(key);
        }
      }

      if (metricMap.size === 0) {
        this.metrics.delete(metricName);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Get storage statistics
   */
  getStats(): { metricCount: number; memoryUsage: number } {
    let metricCount = 0;
    for (const metricMap of this.metrics.values()) {
      metricCount += metricMap.size;
    }

    // Rough memory estimation
    const memoryUsage = metricCount * 200; // ~200 bytes per metric

    return { metricCount, memoryUsage };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.responseTimes.fill(0);
    this.responseTimeIndex = 0;
  }

  /**
   * Create unique metric key from name and labels
   */
  private createMetricKey(
    name: string,
    labels?: Record<string, string>
  ): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }
}
