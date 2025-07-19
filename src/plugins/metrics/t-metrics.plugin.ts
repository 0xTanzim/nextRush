/**
 * 📊 Metrics & Monitoring Plugin - NextRush Framework
 *
 * Simple, powerful metrics and monitoring with enterprise features.
 *
 * Features:
 * - Easy-to-use API for end users
 * - High-performance metrics collection
 * - Prometheus compatibility
 * - Built-in health checks
 * - System monitoring
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

// Import modular components
import { PrometheusFormatter } from './formatter';
import { HealthCheckManager } from './health';
import {
  HealthCheckFunction,
  MetricsOptions,
  RequestMetrics,
} from './interfaces';
import { SystemMonitor } from './monitor';
import { MetricsStorage } from './storage';

/**
 * 📊 Simple & Powerful Metrics Plugin
 *
 * Easy to use, yet enterprise-grade monitoring solution.
 */
export class MetricsPlugin extends BasePlugin {
  name = 'Metrics';

  // Core components
  private storage = new MetricsStorage();
  private healthManager = new HealthCheckManager();
  private formatter!: PrometheusFormatter;
  private monitor = new SystemMonitor();

  // Simple state tracking
  private requestMetrics: RequestMetrics = {
    total: 0,
    active: 0,
    byMethod: {},
    byStatus: {},
    averageResponseTime: 0,
    errors: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
  };

  // Options with defaults
  private options: Required<MetricsOptions> = {
    endpoint: '/metrics',
    enableHealthCheck: true,
    collectDefaultMetrics: true,
    prefix: 'nextrush_',
    defaultLabels: {},
    customMetrics: [],
    authentication: undefined as any,
  };

  constructor(registry: PluginRegistry) {
    super(registry);
    this.formatter = new PrometheusFormatter(this.options.prefix);
  }

  /**
   * Install metrics capabilities on the app
   */
  install(app: Application): void {
    // 🎯 Main API: Enable metrics
    (app as any).enableMetrics = (options: MetricsOptions = {}) => {
      this.configureMetrics(app, options);
      return app;
    };

    // 📊 Simple metric methods
    (app as any).incrementCounter = (
      name: string,
      labels?: Record<string, string>,
      value?: number
    ) => {
      this.storage.incrementCounter(name, labels, value);
    };

    (app as any).setGauge = (
      name: string,
      value: number,
      labels?: Record<string, string>
    ) => {
      this.storage.setMetric(name, value, labels);
    };

    (app as any).observeHistogram = (
      name: string,
      value: number,
      labels?: Record<string, string>
    ) => {
      this.storage.setMetric(name, value, labels);
    };

    // 🏥 Health check methods
    (app as any).addHealthCheck = (
      name: string,
      check: HealthCheckFunction
    ) => {
      this.healthManager.register(name, check);
    };

    (app as any).removeHealthCheck = (name: string) => {
      this.healthManager.remove(name);
    };

    // 📈 Get metrics
    (app as any).getMetrics = () => {
      return this.formatter.format(
        this.storage,
        this.requestMetrics,
        this.monitor.getMetrics()
      );
    };

    (app as any).getHealth = () => {
      return this.healthManager.getStatus();
    };

    this.emit('metrics:installed');
  }

  /**
   * Configure metrics with user options
   */
  private configureMetrics(app: Application, options: MetricsOptions): void {
    // Merge options with defaults
    this.options = { ...this.options, ...options };
    this.formatter = new PrometheusFormatter(this.options.prefix);

    // Register custom metrics
    for (const metric of this.options.customMetrics) {
      // Initialize metric in storage
      this.storage.setMetric(metric.name, 0, {});
    }

    // Set up endpoints
    this.setupEndpoints(app);

    // Set up request tracking middleware
    if (this.options.collectDefaultMetrics) {
      this.setupRequestTracking(app);
    }

    // Add basic health checks
    this.setupBasicHealthChecks();
  }

  /**
   * Set up metrics and health endpoints
   */
  private setupEndpoints(app: Application): void {
    // Metrics endpoint
    (app as any).get(
      this.options.endpoint,
      (req: NextRushRequest, res: NextRushResponse) => {
        // Authentication check
        if (this.options.authentication && !this.options.authentication(req)) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const metrics = this.formatter.format(
          this.storage,
          this.requestMetrics,
          this.monitor.getMetrics()
        );

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
      }
    );

    // Health endpoint
    if (this.options.enableHealthCheck) {
      (app as any).get(
        '/health',
        async (req: NextRushRequest, res: NextRushResponse) => {
          try {
            const health = await this.healthManager.getStatus();
            const statusCode =
              health.status === 'healthy'
                ? 200
                : health.status === 'degraded'
                ? 200
                : 503;

            res.status(statusCode).json(health);
          } catch (error) {
            res.status(503).json({
              status: 'unhealthy',
              error:
                error instanceof Error ? error.message : 'Health check failed',
              timestamp: Date.now(),
            });
          }
        }
      );
    }
  }

  /**
   * Set up request tracking middleware
   */
  private setupRequestTracking(app: Application): void {
    const self = this; // Capture context

    (app as any).use(
      (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
        const startTime = Date.now();

        // Track active requests
        self.requestMetrics.active++;
        self.requestMetrics.total++;

        // Track by method
        const method = req.method || 'UNKNOWN';
        self.requestMetrics.byMethod[method] =
          (self.requestMetrics.byMethod[method] || 0) + 1;

        // Handle response
        const originalEnd = res.end;
        res.end = function (...args: any[]) {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;

          // Update metrics
          self.requestMetrics.active--;
          self.requestMetrics.byStatus[statusCode] =
            (self.requestMetrics.byStatus[statusCode] || 0) + 1;

          // Track errors (4xx, 5xx)
          if (statusCode >= 400) {
            self.requestMetrics.errors++;
          }

          // Update response time tracking
          self.storage.addResponseTime(duration);
          const percentiles = self.storage.getPercentiles();
          self.requestMetrics.p95ResponseTime = percentiles.p95;
          self.requestMetrics.p99ResponseTime = percentiles.p99;

          // Update average response time
          const totalRequests = self.requestMetrics.total;
          self.requestMetrics.averageResponseTime =
            (self.requestMetrics.averageResponseTime * (totalRequests - 1) +
              duration) /
            totalRequests;

          // Call original end method
          return originalEnd.apply(this, args as any);
        };

        next();
      }
    );
  }

  /**
   * Set up basic health checks
   */
  private setupBasicHealthChecks(): void {
    // Memory health check
    this.healthManager.register('memory', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;

      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: `High memory usage: ${usagePercent.toFixed(1)}%`,
        };
      } else if (usagePercent > 75) {
        return {
          status: 'warn',
          message: `Memory usage: ${usagePercent.toFixed(1)}%`,
        };
      }

      return {
        status: 'pass',
        message: `Memory usage: ${usagePercent.toFixed(1)}%`,
      };
    });

    // Process health check
    this.healthManager.register('process', async () => {
      const uptime = process.uptime();
      return {
        status: 'pass',
        message: `Process healthy, uptime: ${Math.floor(uptime)}s`,
      };
    });
  }

  /**
   * Start the plugin
   */
  start(): void {
    // Start cleanup timer
    setInterval(() => {
      this.storage.cleanup();
    }, 60000); // Clean up every minute

    this.emit('metrics:started');
  }

  /**
   * Stop the plugin
   */
  stop(): void {
    this.storage.clear();
    this.healthManager.clear();
    this.monitor.reset();
    this.emit('metrics:stopped');
  }
}
