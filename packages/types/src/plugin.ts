/**
 * @nextrush/types - Plugin Type Definitions
 *
 * Plugins are the extension mechanism for NextRush.
 * They allow adding functionality without bloating the core.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from './context';

// ============================================================================
// Application Interface (minimal for plugin use)
// ============================================================================

/**
 * Minimal Application interface for plugin registration
 * The full Application class is in @nextrush/core
 */
export interface ApplicationLike {
  /**
   * Register middleware
   */
  use(middleware: Middleware): this;

  /**
   * Get installed plugin by name
   */
  getPlugin<T extends Plugin>(name: string): T | undefined;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Plugin interface for extending NextRush
 *
 * Plugins are installed via app.plugin() and can:
 * - Add middleware
 * - Extend context
 * - Add lifecycle hooks
 *
 * @example
 * ```typescript
 * class LoggerPlugin implements Plugin {
 *   readonly name = 'logger';
 *   readonly version = '1.0.0';
 *
 *   install(app: ApplicationLike) {
 *     app.use(async (ctx, next) => {
 *       const start = Date.now();
 *       await next();
 *       console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
 *     });
 *   }
 * }
 * ```
 */
export interface Plugin {
  /**
   * Unique plugin name
   * Used for identification and getPlugin() lookup
   */
  readonly name: string;

  /**
   * Plugin version (optional)
   * Follows semver format
   */
  readonly version?: string;

  /**
   * Install plugin into application
   * Called when app.plugin() is invoked
   *
   * @param app - Application instance
   */
  install(app: ApplicationLike): void | Promise<void>;

  /**
   * Cleanup when application shuts down (optional)
   * Called during graceful shutdown
   */
  destroy?(): void | Promise<void>;
}

// ============================================================================
// Plugin Extension Points (for advanced plugins)
// ============================================================================

/**
 * Extended plugin interface with lifecycle hooks
 * For advanced plugins that need deeper integration
 */
export interface PluginWithHooks extends Plugin {
  /**
   * Called before each request
   */
  onRequest?(ctx: Context): void | Promise<void>;

  /**
   * Called after each response
   */
  onResponse?(ctx: Context): void | Promise<void>;

  /**
   * Called when an error occurs
   */
  onError?(error: Error, ctx: Context): void | Promise<void>;

  /**
   * Extend the context object
   * Add custom properties or methods
   */
  extendContext?(ctx: Context): void;
}

// ============================================================================
// Plugin Factory Pattern
// ============================================================================

/**
 * Plugin factory function type
 * Allows creating plugins with options
 *
 * @example
 * ```typescript
 * const logger = createLoggerPlugin({ level: 'info' });
 * app.plugin(logger);
 * ```
 */
export type PluginFactory<TOptions = unknown> = (options?: TOptions) => Plugin;

// ============================================================================
// Plugin Metadata
// ============================================================================

/**
 * Plugin metadata for registration and discovery
 */
export interface PluginMeta {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin repository URL */
  repository?: string;
  /** Plugin dependencies (other plugin names) */
  dependencies?: string[];
}
