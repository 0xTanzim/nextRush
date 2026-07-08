/**
 * DiscoverySource: Abstraction for controller class discovery.
 *
 * Two implementations:
 * - FilesystemSource: Scans the filesystem for controller files (default)
 * - MemorySource: Uses an explicit list of controller classes (programmatic/test)
 */

/**
 * Discovers controller classes. Called by the discover stage.
 */
export interface DiscoverySource {
  discover(): ClassRef[] | Promise<ClassRef[]>;
}

/**
 * A controller class reference. Always a constructor function.
 */
export type ClassRef = Function;

/**
 * FilesystemSource: Wraps the existing filesystem discovery logic.
 *
 * Scans a directory tree for controller files matching include/exclude patterns,
 * imports them, and returns the discovered controller classes.
 */
export class FilesystemSource implements DiscoverySource {
  private _discoveryErrors: unknown[] = [];

  constructor(
    private root: string,
    private include: string[],
    private exclude: string[],
    private debug: boolean
  ) {}

  async discover(): Promise<ClassRef[]> {
    // Deferred import to avoid circular dependency — discovery.ts exports
    // the actual filesystem scanning logic.
    const { discoverControllers, getControllersFromResults, getErrorsFromResults } = await import(
      '../discovery.js'
    );

    const results = await discoverControllers({
      root: this.root,
      include: this.include,
      exclude: this.exclude,
      debug: this.debug,
    });

    const controllers = getControllersFromResults(results);
    // Collected for the validation stage to surface; scan errors are not fatal here.
    this._discoveryErrors = getErrorsFromResults(results);

    return controllers;
  }

  /**
   * Access discovery errors, if any, after discover() completes.
   * @internal
   */
  getDiscoveryErrors(): unknown[] {
    return this._discoveryErrors;
  }
}

/**
 * MemorySource: Uses an explicit list of controller classes.
 *
 * For programmatic/test use cases where controller classes are already known
 * and no filesystem scan is needed.
 */
export class MemorySource implements DiscoverySource {
  constructor(private controllers: ClassRef[]) {}

  discover(): ClassRef[] {
    return this.controllers;
  }
}
