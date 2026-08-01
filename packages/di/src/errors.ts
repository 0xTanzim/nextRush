/**
 * @nextrush/di - Errors
 *
 * Production-grade error classes with actionable messages.
 */

const V8Error = Error as ErrorConstructor & {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
};

/**
 * Base error class for all DI-related errors.
 */
export class DIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DIError';
    V8Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a dependency cannot be resolved.
 *
 * Provides clear guidance on how to fix the issue.
 */
export class DependencyResolutionError extends DIError {
  public readonly chain: string[];
  public readonly missingDependency: string;

  constructor(chain: string[], missing: string) {
    const chainStr = chain.length > 0 ? chain.join(' → ') + ' → ' : '';

    super(`
❌ Dependency Resolution Failed

${chainStr}${missing}

"${missing}" is not registered in the container.

Possible fixes:
  • Add @Service(), @Repository(), or @Config() decorator to ${missing}
  • Ensure ${missing} is imported before container.resolve() is called
  • Register manually: container.register(${missing}, { useClass: ${missing} })
  • Check for typos in the class name or import path
`);

    this.name = 'DependencyResolutionError';
    this.chain = chain;
    this.missingDependency = missing;
  }
}

/**
 * Error thrown when a circular dependency is detected.
 *
 * Provides strategies to break the cycle.
 */
export class CircularDependencyError extends DIError {
  public readonly cycle: string[];

  constructor(cycle: string[]) {
    const cycleStr = cycle.join(' → ') + ' → ' + cycle[0];

    super(`
❌ Circular Dependency Detected

${cycleStr}

This creates an infinite loop during resolution.

Strategies to break the cycle:
  1. Extract shared logic into a third service
  2. Use @inject(delay(() => ServiceClass)) for lazy resolution
  3. Refactor to use event-driven communication
  4. Consider if the circular dependency indicates a design issue
`);

    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when an invalid provider configuration is given.
 */
export class InvalidProviderError extends DIError {
  public readonly token: string;

  constructor(token: string) {
    super(`
❌ Invalid Provider Configuration

Token: "${token}"

A provider must have one of:
  • useClass: Constructor function
  • useValue: Any value
  • useFactory: Factory function

Example:
  container.register(MyService, { useClass: MyService });
  container.register('CONFIG', { useValue: { port: 8080 } });
  container.register(Logger, { useFactory: () => new Logger() });
`);

    this.name = 'InvalidProviderError';
    this.token = token;
  }
}
