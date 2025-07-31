/**
 * 📊 Metrics Plugin - NextRush Framework
 *
 * Modular metrics and monitoring system.
 */

// Main plugin
export { MetricsPlugin } from './metrics.plugin';

// Core interfaces
export type {
  CustomMetric,
  HealthCheckFunction,
  HealthCheckResult,
  HealthStatus,
  MetricValue,
  MetricsOptions,
  RequestMetrics,
  SystemMetrics,
} from './interfaces';

// Modular components (for advanced users)
export { PrometheusFormatter } from './formatter';
export { HealthCheckManager } from './health';
export { SystemMonitor } from './monitor';
export { MetricsStorage } from './storage';
