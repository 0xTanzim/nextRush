/**
 * @nextrush/controllers - Type Definitions
 *
 * Types for the controller registrar.
 */

import type { ControllerDefinition } from './metadata.js';
import type { Container } from '@nextrush/di';
import type { MetadataContribution, Middleware, RouteHandler } from '@nextrush/types';
import type { DiscoveryError } from './errors.js';
import type { DiscoverySource } from './discovery/source.js';

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
   * Explicit list of controller classes to register.
   *
   * A first-class alternative to `root`-based auto-discovery — not deprecated.
   * Prefer it when explicit wiring reads better than convention: greppable
   * registration, a deterministic registration order, or no filesystem scan at
   * all (tests, bundled or serverless builds where dynamically `import()`ing a
   * source tree is unavailable). Merged with any `root`-discovered controllers.
   */
  controllers?: Function[];

  /**
   * Custom discovery source for controller discovery.
   *
   * For programmatic/test use: supply a `DiscoverySource` that returns
   * controller classes instead of using filesystem scanning or the `controllers`
   * list. Advanced option; typically used with `MemorySource` in tests.
   *
   * Takes precedence over `root` and is incompatible with `controllers`.
   */
  source?: DiscoverySource;

  /**
   * Custom DI container to use.
   * If not provided, falls back to `app.container`, then the global container.
   */
  container?: Container;

  /**
   * Give this registration call its **own** isolated DI container so two apps in
   * the same process do not share service singletons.
   *
   * `@Service`/`@Repository`/`@Config` register their classes into the global
   * `@nextrush/di` container at import time, so by default every app that falls
   * back to the global container shares one instance of each service. With
   * `isolate: true`, `registerControllers` creates a fresh container via
   * `createContainer()` and re-registers the reachable service graph (each
   * controller's constructor dependency classes, transitively) into it with each
   * class's declared scope. Each isolated app then owns its own service
   * singletons; the controllers, their handlers, and boot-time validation all
   * resolve from this container.
   *
   * When `options.container` is provided it always wins — even under
   * `isolate: true` — because the caller has taken explicit ownership; the
   * service graph is registered into that container instead of a fresh one.
   *
   * String/symbol `@inject('TOKEN')` dependencies and any value/factory providers
   * carry no class metadata, so the graph walk cannot auto-register them. Register
   * them on the container you pass **before** calling `registerControllers` (see
   * the README). `@Optional()` dependencies that stay unregistered resolve to
   * `undefined` as usual.
   *
   * Non-breaking: defaults to `false`, preserving the current shared-container
   * behavior for every existing caller.
   *
   * @default false
   */
  isolate?: boolean;

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
  readonly isolate: boolean;
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
