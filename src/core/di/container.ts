/**
 * Lightweight Dependency Injection Container for NextRush v2
 *
 * Custom DI implementation that provides:
 * - Zero external dependencies
 * - Type-safe service registration and resolution
 * - Singleton and transient lifecycles
 * - Performance-optimized for framework use
 *
 * @packageDocumentation
 */

/**
 * Service lifecycle options
 */
export enum ServiceLifetime {
  /** New instance created on each resolution */
  TRANSIENT = 'transient',
  /** Single instance shared across all resolutions */
  SINGLETON = 'singleton',
  /** Instance created once per request scope */
  SCOPED = 'scoped',
}

/**
 * Service descriptor for registration
 */
export interface ServiceDescriptor<T = any> {
  /** Service identifier token */
  token: string | symbol;
  /** Factory function to create the service */
  factory: (...args: any[]) => T;
  /** Service lifetime */
  lifetime: ServiceLifetime;
  /** Dependencies to inject into factory */
  dependencies?: (string | symbol)[];
}

/**
 * Container interface for dependency injection
 */
export interface DIContainer {
  /** Register a service with the container */
  register<T>(descriptor: ServiceDescriptor<T>): void;

  /** Register a singleton service */
  singleton<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies?: (string | symbol)[]
  ): void;

  /** Register a transient service */
  transient<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies?: (string | symbol)[]
  ): void;

  /** Resolve a service from the container */
  resolve<T>(token: string | symbol): T;

  /** Check if a service is registered */
  isRegistered(token: string | symbol): boolean;

  /** Clear all services */
  clear(): void;

  /** Get container statistics */
  getStats(): ContainerStats;
}

/**
 * Container statistics for monitoring
 */
export interface ContainerStats {
  /** Total number of registered services */
  totalServices: number;
  /** Number of singleton instances created */
  singletonInstances: number;
  /** Number of resolutions performed */
  resolutions: number;
  /** Cache hit rate for singletons */
  cacheHitRate: number;
}

/**
 * Circular dependency detection
 */
class CircularDependencyDetector {
  private resolutionStack: (string | symbol)[] = [];

  enterResolution(token: string | symbol): void {
    if (this.resolutionStack.includes(token)) {
      const cycle = [...this.resolutionStack, token].join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    this.resolutionStack.push(token);
  }

  exitResolution(): void {
    this.resolutionStack.pop();
  }

  reset(): void {
    this.resolutionStack.length = 0;
  }
}

/**
 * High-performance DI Container implementation
 */
export class NextRushContainer implements DIContainer {
  private services = new Map<string | symbol, ServiceDescriptor>();
  private singletonInstances = new Map<string | symbol, any>();
  private circularDetector = new CircularDependencyDetector();
  private stats = {
    resolutions: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    if (this.services.has(descriptor.token)) {
      throw new Error(
        `Service with token '${String(descriptor.token)}' is already registered`
      );
    }

    this.services.set(descriptor.token, descriptor);
  }

  /**
   * Register a singleton service
   */
  singleton<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies,
    });
  }

  /**
   * Register a transient service
   */
  transient<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.TRANSIENT,
      dependencies,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T {
    this.stats.resolutions++;

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(
        `Service with token '${String(token)}' is not registered`
      );
    }

    // Check for singleton instance
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      if (this.singletonInstances.has(token)) {
        this.stats.cacheHits++;
        return this.singletonInstances.get(token);
      }
      this.stats.cacheMisses++;
    }

    // Resolve with circular dependency detection
    this.circularDetector.enterResolution(token);

    try {
      // Resolve dependencies
      const resolvedDependencies = (descriptor.dependencies || []).map(dep =>
        this.resolve(dep)
      );

      // Create instance
      const instance = descriptor.factory(...resolvedDependencies);

      // Cache singleton
      if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
        this.singletonInstances.set(token, instance);
      }

      return instance;
    } finally {
      this.circularDetector.exitResolution();
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | symbol): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.circularDetector.reset();
    this.stats = {
      resolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Get container statistics
   */
  getStats(): ContainerStats {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      totalServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      resolutions: this.stats.resolutions,
      cacheHitRate: total === 0 ? 0 : this.stats.cacheHits / total,
    };
  }

  /**
   * Advanced: Register a class constructor with automatic dependency injection
   */
  registerClass<T>(
    token: string | symbol,
    constructor: new (...args: any[]) => T,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory: (...args: any[]) => new constructor(...args),
      lifetime,
      dependencies,
    });
  }

  /**
   * Advanced: Register a value directly (useful for configuration)
   */
  registerValue<T>(token: string | symbol, value: T): void {
    this.register({
      token,
      factory: () => value,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies: [],
    });
  }
}

/**
 * Service tokens for built-in framework services
 */
export const SERVICE_TOKENS = {
  // Core services
  LOGGER: Symbol('LOGGER'),
  ROUTER: Symbol('ROUTER'),
  CONTEXT_FACTORY: Symbol('CONTEXT_FACTORY'),

  // Middleware services
  CORS_MIDDLEWARE: Symbol('CORS_MIDDLEWARE'),
  HELMET_MIDDLEWARE: Symbol('HELMET_MIDDLEWARE'),
  BODY_PARSER_MIDDLEWARE: Symbol('BODY_PARSER_MIDDLEWARE'),
  COMPRESSION_MIDDLEWARE: Symbol('COMPRESSION_MIDDLEWARE'),
  RATE_LIMITER_MIDDLEWARE: Symbol('RATE_LIMITER_MIDDLEWARE'),

  // Configuration
  APPLICATION_CONFIG: Symbol('APPLICATION_CONFIG'),
  MIDDLEWARE_CONFIG: Symbol('MIDDLEWARE_CONFIG'),
} as const;

/**
 * Create a new DI container instance
 */
export function createContainer(): DIContainer {
  return new NextRushContainer();
}

/**
 * Default global container instance
 */
export const globalContainer = createContainer();
