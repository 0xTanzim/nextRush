/**
 * @nextrush/controllers - Request-scope bubbling
 *
 * Computes each reachable class's **effective** DI scope and binds
 * request-effective classes to the container's request (ContainerScoped)
 * lifecycle. See RFC-NEXTRUSH-REQUEST-SCOPE.
 *
 * Scope bubbling: a node is effectively `'request'` if its declared `di:scope`
 * is `'request'` OR any of its transitive dependency classes is effectively
 * `'request'`; otherwise it keeps its declared scope. Bubbling is mandatory —
 * a singleton controller depending on a request-scoped service would otherwise
 * cache one request's instances forever.
 */

import {
  getServiceScope,
  hasServiceMetadata,
  type Constructor,
  type Container,
  type Scope,
  type Token,
} from '@nextrush/di';
import { collectDependencyClasses, collectServiceGraph, registerServiceGraph } from './isolation.js';

/**
 * True when `cls` is effectively request-scoped: declared `'request'`, or it
 * transitively depends on a `@Service`/`@Repository`/`@Config` class that is.
 *
 * `visiting` guards against dependency cycles: a back-edge to an in-progress
 * node contributes `false` (that node resolves its own scope from its declared
 * value plus its other dependencies), so a cycle cannot spuriously flip a node
 * to request. Results are memoized in `cache`.
 */
function isEffectivelyRequest(
  cls: Function,
  cache: Map<Function, boolean>,
  visiting: Set<Function>
): boolean {
  const cached = cache.get(cls);
  if (cached !== undefined) {
    return cached;
  }
  if (visiting.has(cls)) {
    return false;
  }
  visiting.add(cls);

  let request = getServiceScope(cls) === 'request';
  if (!request) {
    for (const dep of collectDependencyClasses(cls)) {
      if (hasServiceMetadata(dep) && isEffectivelyRequest(dep, cache, visiting)) {
        request = true;
        break;
      }
    }
  }

  visiting.delete(cls);
  cache.set(cls, request);
  return request;
}

/**
 * Compute the effective scope of every class reachable from `controllers` —
 * the controllers themselves plus their transitive `@Service` graph. A
 * request-effective class maps to `'request'`; every other class keeps its
 * declared scope (`'singleton'` for undecorated controllers).
 */
export function computeEffectiveScopes(controllers: Function[]): Map<Function, Scope> {
  const requestCache = new Map<Function, boolean>();
  const scopes = new Map<Function, Scope>();

  const reachable = new Set<Function>(controllers);
  for (const service of collectServiceGraph(controllers)) {
    reachable.add(service);
  }

  for (const cls of reachable) {
    const request = isEffectivelyRequest(cls, requestCache, new Set());
    scopes.set(cls, request ? 'request' : getServiceScope(cls));
  }
  return scopes;
}

/** The set of classes whose effective scope is `'request'`. */
export function requestScopedClasses(scopes: Map<Function, Scope>): Set<Function> {
  const set = new Set<Function>();
  for (const [cls, scope] of scopes) {
    if (scope === 'request') {
      set.add(cls);
    }
  }
  return set;
}

/**
 * Register the request-effective **service** nodes with the container's request
 * (ContainerScoped) lifecycle.
 *
 * A request-effective service declared `singleton` is already registered as a
 * tsyringe singleton by its decorator at import time; we re-register it so the
 * request lifecycle wins (tsyringe returns the last registration on resolve).
 * Controllers are registered separately by the registry with their effective
 * scope, so they are skipped here.
 */
export function registerRequestScopedServices(
  container: Container,
  scopes: Map<Function, Scope>
): void {
  for (const [cls, scope] of scopes) {
    if (scope !== 'request' || !hasServiceMetadata(cls)) {
      continue;
    }
    container.register(cls as Token, { useClass: cls as Constructor }, { scope: 'request' });
  }
}

/**
 * Compute effective scopes for `controllers`, bind request-effective classes to
 * the container's request lifecycle, and return the request-scoped class set.
 *
 * - **Isolated container**: register the whole reachable service graph with its
 *   effective scope, so a per-app container owns its instances.
 * - **Shared container**: singleton/transient services keep their decorator-time
 *   registration (zero behavior change); only request-effective services are
 *   (re-)bound to the request (ContainerScoped) lifecycle.
 *
 * The returned set drives per-controller registration and the per-request-child
 * resolution decision in the route handler.
 */
export function bindRequestScopes(
  controllers: Function[],
  container: Container,
  isolate: boolean
): Set<Function> {
  const scopes = computeEffectiveScopes(controllers);
  const requestScoped = requestScopedClasses(scopes);

  if (isolate) {
    registerServiceGraph(controllers, container, scopes);
  } else if (requestScoped.size > 0) {
    registerRequestScopedServices(container, scopes);
  }

  return requestScoped;
}
