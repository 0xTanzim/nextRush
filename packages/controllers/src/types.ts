/**
 * @nextrush/controllers - Type Definitions
 *
 * Types for the controller registrar.
 */

import type { ControllerDefinition } from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { MetadataContribution, Middleware, RouteHandler } from '@nextrush/types';
import type { DiscoveryError } from './errors.js';

/**
 * Options for the controllers registrar
 *
 * Supports two modes:
 * 1. Auto-discovery (recommended): Scan directories for @Controller classes
 * 2. Manual: Explicitly provide controller classes
 */
export interface ControllersOptions {
  /**
   * Root directory to scan for controllers
   * When provided, enables auto-discovery mode
   * @example './src'
   */
  root?: string;

  /**
   * Glob patterns to include in auto-discovery.
   *
   * Defaults to the `*.controller.*` naming convention, so only files named
   * like `user.controller.ts` are imported. Non-controller modules (services,
   * guards, repositories) still load transitively via the controllers that
   * import them, so their `@Service`/`@Repository` side-effects still fire.
   *
   * To scan every source file instead (the pre-v3.2 behavior), pass the
   * scan-all escape hatch: `['**‍/*.ts', '**‍/*.js']`.
   *
   * Side-effect: each matched file is dynamically `import()`ed, which runs its
   * top-level module code.
   *
   * @default `['**‍/*.controller.ts', '**‍/*.controller.js']`
   */
  include?: string[];

  /**
   * Glob patterns to exclude from auto-discovery
   * @default `['**‍/*.test.ts', '**‍/*.spec.ts', '**‍/node_modules/**', '**‍/dist/**']`
   */
  exclude?: string[];

  /**
   * Array of controller classes (manual registration)
   * Use this when you want explicit control or for testing
   */
  controllers?: Function[];

  /**
   * Custom DI container to use.
   * If not provided, falls back to `app.container`, then the global container.
   */
  container?: Container;

  /**
   * Global middleware to apply to all controllers
   */
  middleware?: Middleware[];

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom route prefix to apply to all controllers
   * @example '/api' or '/api/v1'
   */
  prefix?: string;

  /**
   * Whether to throw on discovery errors
   * @default false - logs warnings instead
   */
  strict?: boolean;

  /**
   * Whether to eagerly resolve every registered controller once at the end of
   * registration, so unsatisfiable or circular constructor dependencies fail at
   * boot (throwing {@link ControllerResolutionError}) instead of surfacing as a
   * 500 on the first HTTP request.
   * @default true
   */
  validate?: boolean;
}

/**
 * Resolved options with defaults applied
 */
export interface ResolvedOptions {
  readonly root: string | null;
  readonly include: string[];
  readonly exclude: string[];
  readonly controllers: Function[];
  readonly container: Container;
  readonly middleware: Middleware[];
  readonly debug: boolean;
  readonly prefix: string;
  readonly strict: boolean;
  readonly validate: boolean;
}

/**
 * Built route ready for registration
 */
export interface BuiltRoute {
  /** HTTP method */
  readonly method: string;

  /** Full path including controller prefix */
  readonly path: string;

  /** Route handler function */
  readonly handler: RouteHandler;

  /** Combined middleware (controller + route level) */
  readonly middleware: Middleware[];

  /** Controller class constructor */
  readonly controller: Function;

  /** Method name on controller */
  readonly methodName: string;

  /**
   * Route metadata contributed from decorators (@Controller tags, @Get/@Post
   * description/deprecated). Consumed by the router's RouteDefinition so
   * class-based routes are documented by renderers like @nextrush/openapi.
   * Undefined when the route carries no documentation.
   */
  readonly metadata?: MetadataContribution;
}

/**
 * Registered controller info
 */
export interface RegisteredController {
  /** Controller class */
  readonly target: Function;

  /** Controller definition with metadata */
  readonly definition: ControllerDefinition;

  /** Built routes */
  readonly routes: BuiltRoute[];
}

/**
 * Discovery result from file scanning
 */
export interface DiscoveryResult {
  /** Path to the source file */
  readonly filePath: string;

  /** Discovered controller classes */
  readonly controllers: Function[];

  /** Any errors during discovery */
  readonly errors: DiscoveryError[];
}

/**
 * Options for the discoverControllers function
 */
export interface DiscoveryOptions {
  /** Root directory to scan */
  readonly root: string;

  /** Glob patterns to include */
  readonly include?: string[];

  /** Glob patterns to exclude */
  readonly exclude?: string[];

  /** Enable debug logging */
  readonly debug?: boolean;
}
