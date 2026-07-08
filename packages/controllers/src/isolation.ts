/**
 * @nextrush/controllers - Per-app DI isolation
 *
 * Re-registers the reachable `@Service`/`@Repository`/`@Config` graph of a set
 * of controllers into a specific container, so an app that opts into isolation
 * (`registerControllers(app, { isolate: true })`) owns its own service
 * singletons instead of sharing the process-global ones registered at import
 * time.
 *
 * Why re-register at all: a `createContainer()` child delegates any unregistered
 * token to the global container, so a service `@Service` put on the global root
 * would still resolve to the shared global singleton. Registering the class on
 * the child shadows that delegation, giving the child its own instance.
 */

import {
  getOptionalParams,
  getServiceScope,
  hasServiceMetadata,
  type Constructor,
  type Container,
  type Scope,
  type Token,
} from '@nextrush/di';

/**
 * tsyringe stores `@inject(token)` descriptors under this reflect-metadata key,
 * one entry per decorated constructor parameter index. This is the only source
 * of a controller's dependency classes when the toolchain does not emit
 * `design:paramtypes` (esbuild, tsx, swc without the metadata plugin) — implicit
 * constructor injection is invisible there, but explicit `@inject(Class)` is not.
 * `@nextrush/di`'s own `@Optional()` decorator reads and writes the same key.
 */
const TSYRINGE_INJECTION_TOKENS = 'injectionTokens';

/** The design-time constructor parameter types emitted by `emitDecoratorMetadata`. */
const DESIGN_PARAMTYPES = 'design:paramtypes';

/**
 * A single `@inject` descriptor may be either the raw token or a
 * `{ token, multiple }` wrapper depending on the tsyringe version. Normalize.
 */
function tokenOf(descriptor: unknown): unknown {
  if (descriptor !== null && typeof descriptor === 'object' && 'token' in descriptor) {
    return (descriptor as { token: unknown }).token;
  }
  return descriptor;
}

/**
 * Collect the constructor dependency **classes** of a target, unioning implicit
 * `design:paramtypes` (present in a full TypeScript build) with explicit
 * `@inject(...)` descriptors (present everywhere, including under esbuild).
 *
 * Only class (function) tokens are returned. String/symbol `@inject` tokens and
 * `@Optional()` parameters are intentionally excluded: the former carry no class
 * metadata to walk (the caller registers them), and the latter must be allowed
 * to resolve to `undefined` rather than forcing a registration.
 */
function collectDependencyClasses(target: Function): Function[] {
  const paramTypes =
    (Reflect.getMetadata(DESIGN_PARAMTYPES, target) as unknown[] | undefined) ?? [];
  const injectionTokens =
    (Reflect.getOwnMetadata(TSYRINGE_INJECTION_TOKENS, target) as
      | Record<number, unknown>
      | undefined) ?? {};
  const optional = getOptionalParams(target);

  const indices = new Set<number>();
  for (let i = 0; i < paramTypes.length; i++) {
    indices.add(i);
  }
  for (const key of Object.keys(injectionTokens)) {
    indices.add(Number(key));
  }

  const deps: Function[] = [];
  for (const index of indices) {
    if (optional.has(index)) {
      continue;
    }
    const explicit = injectionTokens[index];
    const token = explicit !== undefined ? tokenOf(explicit) : paramTypes[index];
    if (typeof token === 'function') {
      deps.push(token);
    }
  }
  return deps;
}

/**
 * Walk the constructor dependency graph of `controllers` and return the distinct
 * `@Service`/`@Repository`/`@Config` classes reachable from it, in breadth-first
 * order (a controller's direct service deps first, then their transitive deps).
 *
 * The walk only traverses *through* service classes: a non-service dependency is
 * a leaf (its own deps are not followed), matching {@link registerServiceGraph}'s
 * original inline behavior. Callers that need dependency-first ordering (service
 * lifecycle hooks) reverse the returned list.
 */
export function collectServiceGraph(controllers: Function[]): Function[] {
  const visited = new Set<Function>();
  const result: Function[] = [];
  // FIFO queue with a moving head pointer — avoids repeated O(n) Array.shift().
  const queue: Function[] = [];
  for (const controller of controllers) {
    for (const dep of collectDependencyClasses(controller)) {
      queue.push(dep);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const dep = queue[head]!;
    if (visited.has(dep)) {
      continue;
    }
    visited.add(dep);

    if (!hasServiceMetadata(dep)) {
      continue;
    }

    result.push(dep);

    for (const sub of collectDependencyClasses(dep)) {
      queue.push(sub);
    }
  }
  return result;
}

/**
 * Transitively register every `@Service`/`@Repository`/`@Config` class reachable
 * from `controllers`' constructor dependency graph into `container`, each with
 * its declared scope (`getServiceScope(dep) ?? 'singleton'`).
 *
 * Each class is registered at most once (the graph walk dedupes). A class already
 * registered on the container is left untouched, so a provider the caller
 * registered explicitly (e.g. a mock or a pre-bound instance) always wins.
 * Non-service classes and non-class tokens are skipped — they fall back to the
 * container's parent/global chain or must be registered by the caller.
 */
export function registerServiceGraph(controllers: Function[], container: Container): void {
  for (const dep of collectServiceGraph(controllers)) {
    const scope: Scope = getServiceScope(dep) ?? 'singleton';
    const token = dep as Token;
    if (!container.isRegistered(token)) {
      container.register(token, { useClass: dep as Constructor }, { scope });
    }
  }
}
