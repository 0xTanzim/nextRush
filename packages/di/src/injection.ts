/**
 * @nextrush/di - Injection Decorators & Adapters
 *
 * Parameter decorators for injection, and adapters to tsyringe's internals.
 */

import {
  delay as tsyDelay,
  inject as tsyInject,
  injectable as tsyInjectable,
} from 'tsyringe';

import { METADATA_KEYS, type Constructor } from './types.js';

/** Decorator-compatible constructor type. Uses `never[]` so any class is structurally assignable. */
type DecoratorTarget = new (...args: never[]) => unknown;

/**
 * Explicitly inject a dependency by token.
 *
 * Use this when:
 * - Injecting an interface (TypeScript can't infer interface types at runtime)
 * - Using string or symbol tokens
 * - The automatic type inference doesn't work
 *
 * @param token - The token to inject (class, string, or symbol)
 *
 * @example
 * ```typescript
 * @Service()
 * export class UserService {
 *   constructor(
 *     // Inject by interface token
 *     @inject('IUserRepository') private repo: IUserRepository,
 *
 *     // Inject by string token
 *     @inject('DATABASE_URL') private dbUrl: string
 *   ) {}
 * }
 * ```
 */
export function inject(token: unknown): ParameterDecorator {
  return tsyInject(token as never);
}

/**
 * Delay resolution of a dependency.
 *
 * Use this to break circular dependencies by lazily resolving the dependency.
 *
 * @param token - Factory function returning the class to inject
 *
 * @example
 * ```typescript
 * @Service()
 * class UserService {
 *   constructor(
 *     @inject(delay(() => OrderService)) private orderService: OrderService
 *   ) {}
 * }
 *
 * @Service()
 * class OrderService {
 *   constructor(
 *     @inject(delay(() => UserService)) private userService: UserService
 *   ) {}
 * }
 * ```
 */
export function delay(tokenFactory: () => Constructor): unknown {
  return tsyDelay(tokenFactory);
}

/**
 * Make a class injectable without singleton scope.
 *
 * Unlike @Service() which defaults to singleton, @Injectable() creates
 * a transient registration that can be resolved from the container.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class FeatureService {
 *   constructor(private logger: Logger) {}
 * }
 *
 * // Resolve from container
 * const service = container.resolve(FeatureService);
 * ```
 */
export function Injectable() {
  return (target: DecoratorTarget): void => {
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_TYPE, 'service', target);
    tsyInjectable()(target as unknown as Constructor);
  };
}

/**
 * Make a class resolvable by the DI container without adding service metadata.
 *
 * Used internally by `@Controller()` to enable constructor injection
 * without marking the class as a service. This is the abstraction boundary
 * that prevents `@nextrush/decorators` from depending directly on tsyringe.
 *
 * @param target - The class constructor to make injectable
 *
 * @internal
 */
export function markInjectable(target: Constructor): void {
  tsyInjectable()(target);
}

/**
 * Deliberate, isolated coupling to tsyringe internals.
 *
 * tsyringe stores per-parameter `@inject()` descriptors under the private
 * `'injectionTokens'` metadata key and honours an `isOptional` flag on each descriptor
 * to return `undefined` (instead of throwing) for an unregistered optional dependency.
 * There is no public tsyringe API for "optional inject", so {@link Optional} sets that
 * flag directly. This adapter is the ONE place that touches tsyringe's descriptor shape.
 *
 * It is defensive by design: if a future tsyringe upgrade changes the descriptor shape,
 * this is a no-op rather than a throw, and the end-to-end `@Optional()` resolution test
 * (`decorators.test.ts`) fails loudly so the breakage is caught at CI time.
 *
 * @param target - The class constructor the parameter belongs to
 * @param parameterIndex - Zero-based index of the constructor parameter
 * @internal
 */
function markTsyringeParamOptional(target: object, parameterIndex: number): void {
  const TSYRINGE_INJECTION_KEY = 'injectionTokens';
  try {
    const descriptors =
      (Reflect.getOwnMetadata(TSYRINGE_INJECTION_KEY, target) as
        | Record<number, unknown>
        | undefined) ?? {};
    const descriptor = descriptors[parameterIndex];

    // @inject() (which runs before @Optional() in right-to-left param-decorator order)
    // must already have created the descriptor with a `token` field.
    if (descriptor && typeof descriptor === 'object' && 'token' in descriptor) {
      (descriptor as Record<string, unknown>).isOptional = true;
      Reflect.defineMetadata(TSYRINGE_INJECTION_KEY, descriptors, target);
    }
  } catch {
    // Descriptor shape changed across a tsyringe version — degrade gracefully. Our own
    // OPTIONAL_PARAMS metadata is still recorded; the e2e resolution test guards the flag.
  }
}

/**
 * Mark a constructor parameter as optional.
 *
 * When a dependency marked `@Optional()` cannot be resolved, the container
 * injects `undefined` instead of throwing a `DependencyResolutionError`.
 *
 * @example
 * ```typescript
 * // Optional dependency - if 'MAILER' is not registered, `mailer` will be undefined
 * @Service()
 * class NotificationService {
 *   constructor(
 *     @Optional() @inject('MAILER') private mailer?: MailerService,
 *   ) {}
 *
 *   send(message: string) {
 *     if (this.mailer) {
 *       this.mailer.send(message);
 *     } else {
 *       console.log('No mailer configured, skipping:', message);
 *     }
 *   }
 * }
 * ```
 */
export function Optional(): ParameterDecorator {
  return (target: object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Store in our own metadata for introspection via getOptionalParams / isParameterOptional
    const existing =
      (Reflect.getOwnMetadata(METADATA_KEYS.OPTIONAL_PARAMS, target) as Set<number> | undefined) ??
      new Set<number>();
    existing.add(parameterIndex);
    Reflect.defineMetadata(METADATA_KEYS.OPTIONAL_PARAMS, existing, target);

    // Flip tsyringe's native `isOptional` flag so unregistered optional deps resolve to
    // undefined instead of throwing. Isolated behind a single guarded adapter.
    markTsyringeParamOptional(target, parameterIndex);
  };
}

/**
 * Check whether a specific constructor parameter is marked `@Optional()`.
 */
export function isParameterOptional(target: object, parameterIndex: number): boolean {
  const optional = Reflect.getOwnMetadata(METADATA_KEYS.OPTIONAL_PARAMS, target) as
    | Set<number>
    | undefined;
  return optional?.has(parameterIndex) ?? false;
}

/**
 * Get the set of optional parameter indices for a class constructor.
 */
export function getOptionalParams(target: object): ReadonlySet<number> {
  return (
    (Reflect.getOwnMetadata(METADATA_KEYS.OPTIONAL_PARAMS, target) as Set<number> | undefined) ??
    new Set<number>()
  );
}
