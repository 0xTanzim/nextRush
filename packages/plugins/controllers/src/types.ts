/**
 * @nextrush/controllers - Type Definitions
 *
 * Types for the controller plugin system.
 */

import type { ControllerDefinition } from '@nextrush/decorators';
import type { ContainerInterface } from '@nextrush/di';
import type { Middleware, RouteHandler } from '@nextrush/types';
import type { DiscoveryError } from './errors.js';

/**
 * Options for the controllers plugin
 *
 * Supports two modes:
 * 1. Auto-discovery (recommended): Scan directories for @Controller classes
 * 2. Manual: Explicitly provide controller classes
 */
export interface ControllersPluginOptions {
  /**
   * Root directory to scan for controllers
   * When provided, enables auto-discovery mode
   * @example './src'
   */
  root?: string;

  /**
   * Glob patterns to include in auto-discovery.
   * Defaults to all .ts/.js files — no naming convention required.
   * Any file exporting a @Controller class will be discovered.
   * @default `['**‍/*.ts', '**‍/*.js']`
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
   * @deprecated Prefer auto-discovery with `root` option
   */
  controllers?: Function[];

  /**
   * Custom DI container to use
   * If not provided, creates a new container
   */
  container?: ContainerInterface;

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
}

/**
 * Resolved options with defaults applied
 */
export interface ResolvedOptions {
  readonly root: string | null;
  readonly include: string[];
  readonly exclude: string[];
  readonly controllers: Function[];
  readonly container: ContainerInterface;
  readonly middleware: Middleware[];
  readonly debug: boolean;
  readonly prefix: string;
  readonly strict: boolean;
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

/**
 * Plugin state for runtime access
 */
export interface ControllersPluginState {
  /** All registered controllers */
  readonly controllers: RegisteredController[];

  /** Total routes registered */
  readonly routeCount: number;

  /** Whether the plugin is initialized */
  readonly initialized: boolean;
}
