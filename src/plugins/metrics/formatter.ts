/**
 * 📈 Prometheus Formatter - NextRush Framework
 *
 * Format metrics in Prometheus exposition format.
 */

import { RequestMetrics, SystemMetrics } from './interfaces';
import { MetricsStorage } from './storage';

/**
 * Prometheus metrics formatter
 */
export class PrometheusFormatter {
  constructor(private prefix: string = 'nextrush_') {}

  /**
   * Format all metrics in Prometheus format
   */
  format(
    storage: MetricsStorage,
    requestMetrics: RequestMetrics,
    systemMetrics: SystemMetrics
  ): string {
    const lines: string[] = [];

    // HTTP Request Metrics
    this.addRequestMetrics(lines, requestMetrics);

    // System Metrics
    this.addSystemMetrics(lines, systemMetrics);

    // Custom Metrics
    this.addCustomMetrics(lines, storage);

    return lines.join('\n') + '\n';
  }

  /**
   * Add HTTP request metrics
   */
  private addRequestMetrics(lines: string[], metrics: RequestMetrics): void {
    // Total requests
    lines.push(
      `# HELP ${this.prefix}http_requests_total Total number of HTTP requests`,
      `# TYPE ${this.prefix}http_requests_total counter`,
      `${this.prefix}http_requests_total ${metrics.total}`
    );

    // Active requests
    lines.push(
      `# HELP ${this.prefix}http_requests_active Number of active HTTP requests`,
      `# TYPE ${this.prefix}http_requests_active gauge`,
      `${this.prefix}http_requests_active ${metrics.active}`
    );

    // Requests by method
    lines.push(
      `# HELP ${this.prefix}http_requests_by_method_total HTTP requests by method`,
      `# TYPE ${this.prefix}http_requests_by_method_total counter`
    );
    for (const [method, count] of Object.entries(metrics.byMethod)) {
      lines.push(
        `${this.prefix}http_requests_by_method_total{method="${method}"} ${count}`
      );
    }

    // Requests by status
    lines.push(
      `# HELP ${this.prefix}http_requests_by_status_total HTTP requests by status code`,
      `# TYPE ${this.prefix}http_requests_by_status_total counter`
    );
    for (const [status, count] of Object.entries(metrics.byStatus)) {
      lines.push(
        `${this.prefix}http_requests_by_status_total{status="${status}"} ${count}`
      );
    }

    // Response time percentiles
    lines.push(
      `# HELP ${this.prefix}http_response_time_seconds HTTP response time percentiles`,
      `# TYPE ${this.prefix}http_response_time_seconds gauge`,
      `${this.prefix}http_response_time_seconds{quantile="0.95"} ${
        metrics.p95ResponseTime / 1000
      }`,
      `${this.prefix}http_response_time_seconds{quantile="0.99"} ${
        metrics.p99ResponseTime / 1000
      }`
    );

    // Error count
    lines.push(
      `# HELP ${this.prefix}http_errors_total Total number of HTTP errors`,
      `# TYPE ${this.prefix}http_errors_total counter`,
      `${this.prefix}http_errors_total ${metrics.errors}`
    );
  }

  /**
   * Add system metrics
   */
  private addSystemMetrics(lines: string[], metrics: SystemMetrics): void {
    // Uptime
    lines.push(
      `# HELP ${this.prefix}uptime_seconds Application uptime in seconds`,
      `# TYPE ${this.prefix}uptime_seconds counter`,
      `${this.prefix}uptime_seconds ${Math.floor(metrics.uptime / 1000)}`
    );

    // Memory usage
    lines.push(
      `# HELP ${this.prefix}memory_usage_bytes Memory usage in bytes`,
      `# TYPE ${this.prefix}memory_usage_bytes gauge`,
      `${this.prefix}memory_usage_bytes{type="used"} ${metrics.memory.used}`,
      `${this.prefix}memory_usage_bytes{type="total"} ${metrics.memory.total}`,
      `${this.prefix}memory_usage_bytes{type="heap_used"} ${metrics.memory.heap.heapUsed}`,
      `${this.prefix}memory_usage_bytes{type="heap_total"} ${metrics.memory.heap.heapTotal}`
    );

    // CPU usage
    lines.push(
      `# HELP ${this.prefix}cpu_usage_percent CPU usage percentage`,
      `# TYPE ${this.prefix}cpu_usage_percent gauge`,
      `${this.prefix}cpu_usage_percent ${metrics.cpu.usage}`
    );

    // Load average
    if (metrics.cpu.load.length > 0) {
      lines.push(
        `# HELP ${this.prefix}load_average System load average`,
        `# TYPE ${this.prefix}load_average gauge`
      );
      metrics.cpu.load.forEach((load, index) => {
        const period = index === 0 ? '1m' : index === 1 ? '5m' : '15m';
        lines.push(`${this.prefix}load_average{period="${period}"} ${load}`);
      });
    }

    // Process info
    lines.push(
      `# HELP ${this.prefix}process_uptime_seconds Process uptime in seconds`,
      `# TYPE ${this.prefix}process_uptime_seconds counter`,
      `${this.prefix}process_uptime_seconds ${metrics.process.uptime}`
    );
  }

  /**
   * Add custom metrics
   */
  private addCustomMetrics(lines: string[], storage: MetricsStorage): void {
    const metricNames = storage.getMetricNames();

    for (const name of metricNames) {
      // Skip internal metrics
      if (name.startsWith('_internal_')) continue;

      const metrics = storage.getMetrics(name);
      if (metrics.length === 0) continue;

      // Add help and type (simplified)
      lines.push(
        `# HELP ${this.prefix}${name} Custom metric: ${name}`,
        `# TYPE ${this.prefix}${name} gauge`
      );

      // Add metric values
      for (const metric of metrics) {
        const labels = this.formatLabels(metric.labels);
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${this.prefix}${name}${labelStr} ${metric.value}`);
      }
    }
  }

  /**
   * Format labels for Prometheus
   */
  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${this.escapeValue(value)}"`)
      .join(',');
  }

  /**
   * Escape label values for Prometheus
   */
  private escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}
