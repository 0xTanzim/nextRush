/**
 * 🔥 CORS Metrics Collector - Performance Monitoring
 * Zero-overhead metrics collection for CORS operations
 */

import { CorsMetrics } from './types';

export class CorsMetricsCollector {
  private metrics: CorsMetrics = {
    totalRequests: 0,
    preflightRequests: 0,
    allowedOrigins: 0,
    blockedOrigins: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    lastRequestTime: 0,
  };

  private responseTimeSum = 0;
  private responseTimeCount = 0;

  /**
   * 🚀 Record CORS request
   */
  recordRequest(
    type: 'simple' | 'preflight',
    allowed: boolean,
    cacheHit: boolean,
    responseTime: number
  ): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = Date.now();

    if (type === 'preflight') {
      this.metrics.preflightRequests++;
    }

    if (allowed) {
      this.metrics.allowedOrigins++;
    } else {
      this.metrics.blockedOrigins++;
    }

    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update average response time using running average
    this.responseTimeSum += responseTime;
    this.responseTimeCount++;
    this.metrics.averageResponseTime =
      this.responseTimeSum / this.responseTimeCount;

    // Prevent memory bloat by resetting counters periodically
    if (this.responseTimeCount > 10000) {
      this.responseTimeSum = this.metrics.averageResponseTime * 1000;
      this.responseTimeCount = 1000;
    }
  }

  /**
   * 🚀 Get current metrics snapshot
   */
  getMetrics(): Readonly<CorsMetrics> {
    return { ...this.metrics };
  }

  /**
   * 🚀 Get metrics summary for monitoring dashboards
   */
  getMetricsSummary(): {
    requestRate: number;
    allowanceRate: number;
    cacheEfficiency: number;
    averageResponseTime: number;
    uptime: number;
  } {
    const total = this.metrics.totalRequests;

    return {
      requestRate:
        total / Math.max(1, (Date.now() - this.metrics.lastRequestTime) / 1000),
      allowanceRate: total > 0 ? this.metrics.allowedOrigins / total : 0,
      cacheEfficiency:
        this.metrics.cacheHits + this.metrics.cacheMisses > 0
          ? this.metrics.cacheHits /
            (this.metrics.cacheHits + this.metrics.cacheMisses)
          : 0,
      averageResponseTime: this.metrics.averageResponseTime,
      uptime: Date.now() - this.metrics.lastRequestTime,
    };
  }

  /**
   * 🚀 Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      preflightRequests: 0,
      allowedOrigins: 0,
      blockedOrigins: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastRequestTime: Date.now(),
    };
    this.responseTimeSum = 0;
    this.responseTimeCount = 0;
  }

  /**
   * 🚀 Get formatted metrics for logging
   */
  getFormattedMetrics(): string {
    const summary = this.getMetricsSummary();
    return [
      `CORS Metrics Summary:`,
      `  Total Requests: ${this.metrics.totalRequests}`,
      `  Preflight Requests: ${this.metrics.preflightRequests}`,
      `  Allowed Origins: ${this.metrics.allowedOrigins}`,
      `  Blocked Origins: ${this.metrics.blockedOrigins}`,
      `  Cache Hits: ${this.metrics.cacheHits}`,
      `  Cache Misses: ${this.metrics.cacheMisses}`,
      `  Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`,
      `  Allowance Rate: ${(summary.allowanceRate * 100).toFixed(1)}%`,
      `  Cache Efficiency: ${(summary.cacheEfficiency * 100).toFixed(1)}%`,
    ].join('\n');
  }
}
