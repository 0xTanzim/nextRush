/**
 * 📊 Metrics & Monitoring Plugin - NextRush Framework
 *
 * Built-in monitoring with request tracking, performance metrics,
 * and Prometheus-compatible endpoint.
 */

import * as os from 'os';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * Metrics configuration options
 */
export interface MetricsOptions {
  endpoint?: string; // Metrics endpoint path (default: /metrics)
  enableHealthCheck?: boolean; // Enable /health endpoint
  collectDefaultMetrics?: boolean; // Collect system metrics
  requestTracking?: boolean; // Track HTTP requests
  customMetrics?: Record<string, CustomMetric>; // Custom metrics
  authentication?: (req: NextRushRequest) => boolean; // Auth for metrics endpoint
  format?: 'prometheus' | 'json'; // Output format
  prefix?: string; // Metric name prefix
}

/**
 * Custom metric definition
 */
export interface CustomMetric {
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
  buckets?: number[]; // For histograms
  quantiles?: number[]; // For summaries
}

/**
 * Metric value interface
 */
export interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

/**
 * Request metrics
 */
export interface RequestMetrics {
  total: number;
  active: number;
  byMethod: Record<string, number>;
  byStatus: Record<number, number>;
  averageResponseTime: number;
  totalResponseTime: number;
  errors: number;
}

/**
 * System metrics
 */
export interface SystemMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    heap: NodeJS.MemoryUsage;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  process: {
    pid: number;
    version: string;
    arch: string;
    platform: string;
  };
}

/**
 * Health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  uptime: number;
  version?: string;
  checks: Record<
    string,
    {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
    }
  >;
}

/**
 * 📊 Metrics & Monitoring Plugin
 */
export class MetricsPlugin extends BasePlugin {
  name = 'Metrics';
  private options: MetricsOptions;
  private startTime: number;
  private requestMetrics: RequestMetrics;
  private customMetrics = new Map<string, Map<string, MetricValue>>();
  private healthChecks = new Map<
    string,
    () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>
  >();

  constructor(registry: PluginRegistry) {
    super(registry);
    this.startTime = Date.now();
    this.options = {
      endpoint: '/metrics',
      enableHealthCheck: true,
      collectDefaultMetrics: true,
      requestTracking: true,
      customMetrics: {},
      format: 'prometheus',
      prefix: 'nextrush_',
    };
    this.requestMetrics = {
      total: 0,
      active: 0,
      byMethod: {},
      byStatus: {},
      averageResponseTime: 0,
      totalResponseTime: 0,
      errors: 0,
    };
  }

  /**
   * Install metrics capabilities
   */
  install(app: Application): void {
    // Configure metrics
    (app as any).enableMetrics = (options: MetricsOptions = {}) => {
      this.options = { ...this.options, ...options };

      // Add request tracking middleware if enabled
      if (this.options.requestTracking) {
        (app as any).use(this.createRequestTrackingMiddleware());
      }

      // Add metrics endpoint
      (app as any).get(this.options.endpoint, this.createMetricsHandler());

      // Add health check endpoint
      if (this.options.enableHealthCheck) {
        (app as any).get('/health', this.createHealthHandler());
      }

      return app;
    };

    // Custom metrics methods
    (app as any).incrementCounter = (
      name: string,
      labels?: Record<string, string>,
      value: number = 1
    ) => {
      this.incrementCounter(name, labels, value);
      return app;
    };

    (app as any).setGauge = (
      name: string,
      value: number,
      labels?: Record<string, string>
    ) => {
      this.setGauge(name, value, labels);
      return app;
    };

    (app as any).observeHistogram = (
      name: string,
      value: number,
      labels?: Record<string, string>
    ) => {
      this.observeHistogram(name, value, labels);
      return app;
    };

    (app as any).addHealthCheck = (
      name: string,
      check: () => Promise<{
        status: 'pass' | 'fail' | 'warn';
        message?: string;
      }>
    ) => {
      this.healthChecks.set(name, check);
      return app;
    };

    (app as any).getMetrics = () => {
      return this.getMetrics();
    };

    (app as any).getHealth = () => {
      return this.getHealth();
    };

    this.emit('metrics:installed');
  }

  /**
   * Start the metrics plugin
   */
  start(): void {
    this.emit('metrics:started');
  }

  /**
   * Stop the metrics plugin
   */
  stop(): void {
    this.customMetrics.clear();
    this.healthChecks.clear();
    this.emit('metrics:stopped');
  }

  /**
   * Create request tracking middleware
   */
  private createRequestTrackingMiddleware() {
    const self = this; // Capture 'this' context

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const startTime = Date.now();
      const method = req.method || 'UNKNOWN';

      // Increment active requests
      self.requestMetrics.active++;
      self.requestMetrics.total++;
      self.requestMetrics.byMethod[method] =
        (self.requestMetrics.byMethod[method] || 0) + 1;

      // Track response
      const originalEnd = res.end.bind(res);
      res.end = (chunk?: any, encoding?: any, cb?: any) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const statusCode = res.statusCode;

        // Update metrics
        self.requestMetrics.active--;
        self.requestMetrics.byStatus[statusCode] =
          (self.requestMetrics.byStatus[statusCode] || 0) + 1;
        self.requestMetrics.totalResponseTime += duration;
        self.requestMetrics.averageResponseTime =
          self.requestMetrics.totalResponseTime / self.requestMetrics.total;

        if (statusCode >= 400) {
          self.requestMetrics.errors++;
        }

        // Call original end
        return originalEnd(chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Create metrics endpoint handler
   */
  private createMetricsHandler() {
    return async (req: NextRushRequest, res: NextRushResponse) => {
      try {
        // Check authentication if provided
        if (this.options.authentication && !this.options.authentication(req)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const metrics = await this.getMetrics();

        if (this.options.format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.json(metrics);
        } else {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.send(this.formatPrometheusMetrics(metrics));
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    };
  }

  /**
   * Create health check handler
   */
  private createHealthHandler() {
    return async (req: NextRushRequest, res: NextRushResponse) => {
      try {
        const health = await this.getHealth();
        const statusCode =
          health.status === 'healthy'
            ? 200
            : health.status === 'degraded'
            ? 206
            : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: Date.now(),
          error: 'Health check failed',
        });
      }
    };
  }

  /**
   * Get all metrics
   */
  private async getMetrics(): Promise<{
    request: RequestMetrics;
    system: SystemMetrics;
    custom: Record<string, MetricValue[]>;
  }> {
    return {
      request: this.requestMetrics,
      system: this.getSystemMetrics(),
      custom: this.getCustomMetrics(),
    };
  }

  /**
   * Get health status
   */
  private async getHealth(): Promise<HealthStatus> {
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Run all health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await check();
        const duration = Date.now() - startTime;

        checks[name] = {
          ...result,
          duration,
        };

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const memTotal = os.totalmem();
    const memUsed = memTotal - os.freemem();

    return {
      uptime: Date.now() - this.startTime,
      memory: {
        used: memUsed,
        total: memTotal,
        heap: memUsage,
      },
      cpu: {
        usage: this.getCpuUsage(),
        load: os.loadavg(),
      },
      process: {
        pid: process.pid,
        version: process.version,
        arch: process.arch,
        platform: process.platform,
      },
    };
  }

  /**
   * Get custom metrics
   */
  private getCustomMetrics(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {};

    for (const [name, values] of this.customMetrics) {
      result[name] = Array.from(values.values());
    }

    return result;
  }

  /**
   * Increment counter metric
   */
  private incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
  ): void {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.customMetrics.get(name) || new Map();
    const existing = metricMap.get(key) || {
      value: 0,
      labels,
      timestamp: Date.now(),
    };

    existing.value += value;
    existing.timestamp = Date.now();
    metricMap.set(key, existing);
    this.customMetrics.set(name, metricMap);
  }

  /**
   * Set gauge metric
   */
  private setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.customMetrics.get(name) || new Map();

    metricMap.set(key, {
      value,
      labels,
      timestamp: Date.now(),
    });

    this.customMetrics.set(name, metricMap);
  }

  /**
   * Observe histogram metric
   */
  private observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.createMetricKey(name, labels);
    const metricMap = this.customMetrics.get(name) || new Map();
    const existing = metricMap.get(key) || {
      value: 0,
      labels,
      timestamp: Date.now(),
    };

    // Simple histogram implementation (could be enhanced)
    existing.value = value; // For simplicity, store latest value
    existing.timestamp = Date.now();
    metricMap.set(key, existing);
    this.customMetrics.set(name, metricMap);
  }

  /**
   * Create metric key from name and labels
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

  /**
   * Format metrics in Prometheus format
   */
  private formatPrometheusMetrics(metrics: any): string {
    const lines: string[] = [];
    const prefix = this.options.prefix || '';

    // Request metrics
    lines.push(
      `# HELP ${prefix}http_requests_total Total number of HTTP requests`
    );
    lines.push(`# TYPE ${prefix}http_requests_total counter`);
    lines.push(`${prefix}http_requests_total ${metrics.request.total}`);

    lines.push(
      `# HELP ${prefix}http_requests_active Number of active HTTP requests`
    );
    lines.push(`# TYPE ${prefix}http_requests_active gauge`);
    lines.push(`${prefix}http_requests_active ${metrics.request.active}`);

    // Request methods
    for (const [method, count] of Object.entries(metrics.request.byMethod)) {
      lines.push(`${prefix}http_requests_total{method="${method}"} ${count}`);
    }

    // System metrics
    lines.push(`# HELP ${prefix}memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE ${prefix}memory_usage_bytes gauge`);
    lines.push(`${prefix}memory_usage_bytes ${metrics.system.memory.used}`);

    lines.push(`# HELP ${prefix}uptime_seconds Uptime in seconds`);
    lines.push(`# TYPE ${prefix}uptime_seconds counter`);
    lines.push(
      `${prefix}uptime_seconds ${Math.floor(metrics.system.uptime / 1000)}`
    );

    // Custom metrics
    for (const [name, values] of Object.entries(metrics.custom)) {
      lines.push(`# HELP ${prefix}${name} Custom metric`);
      lines.push(`# TYPE ${prefix}${name} gauge`);

      for (const value of values as MetricValue[]) {
        const labels = value.labels
          ? Object.entries(value.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')
          : '';
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${prefix}${name}${labelStr} ${value.value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Get CPU usage (simplified)
   */
  private getCpuUsage(): number {
    // This is a simplified implementation
    // In production, you might want to use a more sophisticated method
    return os.loadavg()[0] || 0;
  }
}
