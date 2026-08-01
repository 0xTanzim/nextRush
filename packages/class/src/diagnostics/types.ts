/**
 * Diagnostics Report Types
 *
 * Opt-in diagnostics for @nextrush/class that capture ApplicationGraph IR
 * metadata (routes, providers, duplicates, cycles, timings) for introspection
 * and debugging.
 *
 * Zero-cost when disabled: no timing measurement, no report collection,
 * no WeakMap storage when diagnostics: false (default).
 */

/**
 * A single timing measurement from a bootstrap stage.
 */
export interface TimingEntry {
  /** Bootstrap stage name */
  readonly stage: string;

  /** Duration in milliseconds */
  readonly ms: number;
}

/**
 * A single route entry in the diagnostics report.
 */
export interface RouteEntry {
  /** HTTP method (GET, POST, etc.) */
  readonly method: string;

  /** Route path (with prefix applied) */
  readonly path: string;

  /** Controller class constructor */
  readonly controller: Function;
}

/**
 * A single provider entry in the diagnostics report.
 */
export interface ProviderEntry {
  /** Provider token (class constructor or symbol) */
  readonly token: Function | Symbol;

  /** Dependency tokens this provider depends on */
  readonly dependencies: (Function | Symbol)[];
}

/**
 * A duplicate route flagged during detection.
 */
export interface DuplicateRoute {
  /** HTTP method */
  readonly method: string;

  /** Route path */
  readonly path: string;

  /** Number of controllers registering this route */
  readonly count: number;
}

/**
 * A circular dependency cycle detected in the provider graph.
 */
export interface CircularDependency {
  /** Cycle path as array of provider tokens */
  readonly cycle: ReadonlyArray<Function | Symbol>;
}

/**
 * Diagnostics Report
 *
 * Captures ApplicationGraph IR state (routes, providers, duplicates, cycles)
 * and bootstrap timings. Populated by collectDiagnostics() when
 * options.diagnostics === true.
 */
export interface DiagnosticsReport {
  /** All registered routes */
  readonly routes: ReadonlyArray<RouteEntry>;

  /** All providers in the DI graph */
  readonly providers: ReadonlyArray<ProviderEntry>;

  /** Routes registered more than once (method + path collision) */
  readonly duplicateRoutes: ReadonlyArray<DuplicateRoute>;

  /** Circular dependencies detected in provider graph */
  readonly circularDependencies: ReadonlyArray<CircularDependency>;

  /** Bootstrap stage timings */
  readonly timings: ReadonlyArray<TimingEntry>;
}
