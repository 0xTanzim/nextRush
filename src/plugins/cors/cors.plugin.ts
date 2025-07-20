/**
 * 🔥 CORS Plugin - NextRush Framework (Optimized & Modular)
 *
 * High-performance, memory-optimized CORS handling with:
 * - Smart origin caching for performance
 * - Zero memory leaks with cleanup hooks
 * - Enterprise-grade security features
 * - Comprehensive metrics collection
 * - Modular architecture following OCP principles
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';
import { CorsMetricsCollector } from './metrics-collector';
import { OriginValidator } from './origin-validator';
import { CorsPresets } from './presets';
import { SecurityHeadersManager, SecurityPresets } from './security-headers';
import { CorsConfig, CorsOptions, SecurityHeadersConfig } from './types';

/**
 * 🔥 High-Performance CORS Plugin
 */
export class CorsPlugin extends BasePlugin {
  name = 'CORS';

  private originValidator: OriginValidator | null = null;
  private metricsCollector: CorsMetricsCollector | null = null;
  private securityHeaders: SecurityHeadersManager | null = null;

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * 🚀 Install CORS capabilities with performance optimization
   */
  install(app: Application): void {
    // Initialize security headers manager
    this.securityHeaders = new SecurityHeadersManager();

    // Add optimized CORS middleware method
    (app as any).cors = this.createCorsMiddleware.bind(this);

    // Add global CORS enabler
    (app as any).enableCors = (options: CorsOptions = {}) => {
      (app as any).use((app as any).cors(options));
      return app;
    };

    // Add security headers method
    (app as any).enableSecurityHeaders = (config?: SecurityHeadersConfig) => {
      if (config) {
        this.securityHeaders!.updateConfig(config);
      }
      return this.securityHeaders!.middleware();
    };

    // Add comprehensive web security method
    (app as any).enableWebSecurity = (
      corsOptions: CorsOptions = {},
      securityConfig?: SecurityHeadersConfig
    ) => {
      (app as any).use((app as any).enableSecurityHeaders(securityConfig));
      (app as any).use((app as any).cors(corsOptions));
      return app;
    };

    // Add CORS presets access
    (app as any).CorsPresets = CorsPresets;
    (app as any).SecurityPresets = SecurityPresets;

    this.emit('cors:installed');
  }

  /**
   * 🚀 Create optimized CORS middleware
   */
  private createCorsMiddleware(options: CorsOptions = {}) {
    const config = this.buildCorsConfig(options);

    // Initialize components if metrics enabled
    if (config.enableMetrics && !this.metricsCollector) {
      this.metricsCollector = new CorsMetricsCollector();
    }

    // Initialize origin validator with caching
    if (!this.originValidator) {
      this.originValidator = new OriginValidator(
        config.cacheTtl,
        config.cacheOrigins
      );
    }

    return async (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => {
      const startTime = process.hrtime.bigint();
      let allowed = false;
      let cacheHit = false;

      try {
        const origin = req.headers.origin;
        const method = req.method?.toUpperCase();

        // Validate origin with caching
        allowed = await this.originValidator!.validateOrigin(
          origin,
          config.origin
        );

        // Set CORS headers for allowed origins
        if (allowed) {
          this.setCorsHeaders(req, res, config, origin);
        }

        // Handle preflight requests
        if (config.preflight && method === 'OPTIONS') {
          await this.handlePreflightRequest(req, res, config, allowed);

          // Record metrics
          if (this.metricsCollector) {
            const endTime = process.hrtime.bigint();
            const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            this.metricsCollector.recordRequest(
              'preflight',
              allowed,
              cacheHit,
              responseTime
            );
          }

          if (!config.preflightContinue) {
            res.status(config.optionsSuccessStatus).end();
            return;
          }
        }

        // Record metrics for simple requests
        if (this.metricsCollector && method !== 'OPTIONS') {
          const endTime = process.hrtime.bigint();
          const responseTime = Number(endTime - startTime) / 1000000;
          this.metricsCollector.recordRequest(
            'simple',
            allowed,
            cacheHit,
            responseTime
          );
        }

        next();
      } catch (error) {
        console.error('CORS middleware error:', error);

        // Record error in metrics
        if (this.metricsCollector) {
          const endTime = process.hrtime.bigint();
          const responseTime = Number(endTime - startTime) / 1000000;
          this.metricsCollector.recordRequest(
            'simple',
            false,
            false,
            responseTime
          );
        }

        next(); // Continue on error to avoid breaking the request
      }
    };
  }

  /**
   * 🚀 Set CORS headers efficiently
   */
  private setCorsHeaders(
    req: NextRushRequest,
    res: NextRushResponse,
    config: CorsConfig,
    origin?: string
  ): void {
    // Set origin header
    res.setHeader('Access-Control-Allow-Origin', origin || '*');

    // Set credentials header
    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Set exposed headers
    if (config.exposedHeaders.length > 0) {
      res.setHeader(
        'Access-Control-Expose-Headers',
        config.exposedHeaders.join(', ')
      );
    }

    // Add Vary header for proper caching
    this.addVaryHeader(res, 'Origin');
  }

  /**
   * 🚀 Handle preflight requests optimally
   */
  private async handlePreflightRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    config: CorsConfig,
    allowed: boolean
  ): Promise<void> {
    if (!allowed) {
      return; // Don't set preflight headers for disallowed origins
    }

    // Set allowed methods
    res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));

    // Handle requested headers efficiently
    const requestedHeaders = req.headers['access-control-request-headers'];
    if (requestedHeaders) {
      this.setAllowedHeaders(res, config, requestedHeaders);
    } else if (config.allowedHeaders.length > 0) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        config.allowedHeaders.join(', ')
      );
    }

    // Set max age for caching
    if (config.maxAge !== undefined) {
      res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
    }

    // Add Vary headers for proper caching
    this.addVaryHeader(
      res,
      'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
    );
  }

  /**
   * 🚀 Set allowed headers with smart filtering
   */
  private setAllowedHeaders(
    res: NextRushResponse,
    config: CorsConfig,
    requestedHeaders: string
  ): void {
    if (config.allowedHeaders.includes('*')) {
      res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
      return;
    }

    const requested = requestedHeaders
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h.length > 0);

    const allowed = requested.filter((header) =>
      config.allowedHeaders.some(
        (allowedHeader) =>
          allowedHeader.toLowerCase() === header || allowedHeader === '*'
      )
    );

    if (allowed.length > 0) {
      res.setHeader('Access-Control-Allow-Headers', allowed.join(', '));
    }
  }

  /**
   * 🚀 Add Vary header efficiently
   */
  private addVaryHeader(res: NextRushResponse, varyValue: string): void {
    const existingVary = res.getHeader('Vary');
    if (existingVary) {
      const varyHeaders = Array.isArray(existingVary)
        ? existingVary.join(', ')
        : existingVary.toString();

      if (!varyHeaders.includes(varyValue)) {
        res.setHeader('Vary', `${varyHeaders}, ${varyValue}`);
      }
    } else {
      res.setHeader('Vary', varyValue);
    }
  }

  /**
   * 🚀 Build optimized CORS configuration
   */
  private buildCorsConfig(options: CorsOptions): CorsConfig {
    const config: CorsConfig = {
      origin: options.origin || false,
      methods: this.normalizeStringArray(
        options.methods || [
          'GET',
          'HEAD',
          'PUT',
          'PATCH',
          'POST',
          'DELETE',
          'OPTIONS',
        ]
      ),
      allowedHeaders: this.normalizeStringArray(
        options.allowedHeaders || ['*']
      ),
      exposedHeaders: this.normalizeStringArray(options.exposedHeaders || []),
      credentials: options.credentials === true,
      preflightContinue: options.preflightContinue === true,
      optionsSuccessStatus: options.optionsSuccessStatus || 204,
      preflight: options.preflight !== false,
      cacheOrigins: options.cacheOrigins !== false,
      cacheTtl: options.cacheTtl || 300000, // 5 minutes default
      enableMetrics: options.enableMetrics !== false,
    };

    if (options.maxAge !== undefined) {
      config.maxAge = options.maxAge;
    }

    return config;
  }

  /**
   * 🚀 Normalize string or array to array efficiently
   */
  private normalizeStringArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  }

  /**
   * 🚀 Get CORS metrics (if enabled)
   */
  getMetrics() {
    return this.metricsCollector?.getMetrics() || null;
  }

  /**
   * 🚀 Get cache statistics
   */
  getCacheStats() {
    return this.originValidator?.getCacheStats() || null;
  }

  /**
   * 🚀 Start the CORS plugin
   */
  start(): void {
    this.emit('cors:started');
  }

  /**
   * 🚀 Stop the CORS plugin with cleanup
   */
  stop(): void {
    this.cleanup();
    this.emit('cors:stopped');
  }

  /**
   * 🚀 Cleanup resources to prevent memory leaks
   */
  private cleanup(): void {
    if (this.originValidator) {
      this.originValidator.cleanup();
      this.originValidator = null;
    }

    if (this.metricsCollector) {
      this.metricsCollector.reset();
      this.metricsCollector = null;
    }
  }

  /**
   * 🚀 Plugin cleanup hook
   */
  onCleanup(): void {
    this.cleanup();
  }
}

// Export presets for easy access
export { CorsPresets } from './presets';
export { SecurityPresets } from './security-headers';
export * from './types';
