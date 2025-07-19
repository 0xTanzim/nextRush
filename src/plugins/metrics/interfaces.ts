/**
 * 📊 Metrics Plugin Interfaces - NextRush Framework
 *
 * Core type definitions for the metrics and monitoring system.
 */

import { NextRushRequest } from '../../types/express';

/**
 * Simple metrics configuration for end users
 */
export interface MetricsOptions {
  endpoint?: string; // Default: '/metrics'
  enableHealthCheck?: boolean; // Default: true
  collectDefaultMetrics?: boolean; // Default: true
  prefix?: string; // Default: 'nextrush_'
  defaultLabels?: Record<string, string>;
  customMetrics?: CustomMetric[];
  authentication?: (req: NextRushRequest) => boolean;
}

/**
 * Custom metric definition
 */
export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
  buckets?: number[]; // For histograms
  quantiles?: number[]; // For summaries
}

/**
 * Metric value with metadata
 */
export interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
  samples?: number;
  sum?: number;
}

/**
 * HTTP request metrics
 */
export interface RequestMetrics {
  total: number;
  active: number;
  byMethod: Record<string, number>;
  byStatus: Record<number, number>;
  averageResponseTime: number;
  errors: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

/**
 * System performance metrics
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
    uptime: number;
  };
}

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
  timestamp: number;
}

/**
 * Simple health check function
 */
export type HealthCheckFunction = () => Promise<{
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}>;
