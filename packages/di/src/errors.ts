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
 * Error thrown when TypeScript cannot infer constructor parameter types.
 *
 * Usually caused by missing type annotations or incorrect tsconfig.
 */
export class TypeInferenceError extends DIError {
  public readonly className: string;
  public readonly parameterIndex: number;

  constructor(className: string, parameterIndex: number) {
    super(`
❌ Cannot Resolve Constructor Parameter

${className} constructor parameter at index ${parameterIndex} has no type information.

This usually means:
  1. Missing type annotation on the parameter
  2. emitDecoratorMetadata is not enabled in tsconfig.json

Fix option 1 - Add explicit type annotation:
  constructor(private service: ServiceClass) {}
                              ^^^^^^^^^^^^

Fix option 2 - Update tsconfig.json:
  {
    "compilerOptions": {
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true
    }
  }

Fix option 3 - Use explicit @inject():
  constructor(@inject(ServiceClass) private service: ServiceClass) {}
`);

    this.name = 'TypeInferenceError';
    this.className = className;
    this.parameterIndex = parameterIndex;
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
  container.register('CONFIG', { useValue: { port: 3000 } });
  container.register(Logger, { useFactory: () => new Logger() });
`);

    this.name = 'InvalidProviderError';
    this.token = token;
  }
}

/**
 * Error thrown when trying to resolve from a disposed container.
 */
export class ContainerDisposedError extends DIError {
  constructor() {
    super(`
❌ Container Has Been Disposed

The container has been reset or disposed and cannot resolve dependencies.

If you're in a test environment, ensure you're creating a fresh container
for each test or using container.clearInstances() between tests.
`);

    this.name = 'ContainerDisposedError';
  }
}

/**
 * Error thrown when a required dependency is not found.
 *
 * @deprecated Use {@link DependencyResolutionError} instead — it provides
 * the same information plus the resolution chain context.
 */
export class MissingDependencyError extends DIError {
  public readonly token: string;

  constructor(token: string) {
    super(`
❌ Missing Required Dependency

Token: "${token}"

The requested dependency is not registered in the container.

Make sure to:
  1. Register the dependency before resolving
  2. Check spelling of the token
  3. Verify the service has @Service() or @Repository() decorator
`);

    this.name = 'MissingDependencyError';
    this.token = token;
  }
}
