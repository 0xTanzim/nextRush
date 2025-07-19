/**
 * 🏥 Health Check System - NextRush Framework
 *
 * Simple and reliable health monitoring.
 */

import {
  HealthCheckFunction,
  HealthCheckResult,
  HealthStatus,
} from './interfaces';

/**
 * Health check manager
 */
export class HealthCheckManager {
  private healthChecks = new Map<string, HealthCheckFunction>();
  private startTime = Date.now();

  /**
   * Register a health check
   */
  register(name: string, check: HealthCheckFunction): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Remove a health check
   */
  remove(name: string): void {
    this.healthChecks.delete(name);
  }

  /**
   * Run all health checks and get status
   */
  async getStatus(): Promise<HealthStatus> {
    const checks: Record<string, HealthCheckResult> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, check]) => {
        const startTime = Date.now();
        try {
          const result = await Promise.race([
            check(),
            this.timeout(5000), // 5 second timeout
          ]);

          const checkResult: HealthCheckResult = {
            status: result.status,
            duration: Date.now() - startTime,
            timestamp: Date.now(),
            ...(result.message && { message: result.message }),
          };

          checks[name] = checkResult;

          // Update overall status
          if (result.status === 'fail') {
            overallStatus = 'unhealthy';
          } else if (result.status === 'warn' && overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        } catch (error) {
          checks[name] = {
            status: 'fail',
            message:
              error instanceof Error ? error.message : 'Health check failed',
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          };
          overallStatus = 'unhealthy';
        }
      }
    );

    await Promise.all(checkPromises);

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
    };
  }

  /**
   * Get registered health check names
   */
  getCheckNames(): string[] {
    return Array.from(this.healthChecks.keys());
  }

  /**
   * Check if a health check exists
   */
  hasCheck(name: string): boolean {
    return this.healthChecks.has(name);
  }

  /**
   * Clear all health checks
   */
  clear(): void {
    this.healthChecks.clear();
  }

  /**
   * Create timeout promise for health checks
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Health check timed out after ${ms}ms`)),
        ms
      );
    });
  }
}
