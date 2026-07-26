/**
 * @nextrush/class - ApplicationGraph IR (Immutable Intermediate Representation)
 *
 * RFC-NEXTRUSH-CLASS-CONSOLIDATION P3.4: Immutable IR that documents the
 * bootstrap read-once, freeze-then-execute pattern.
 *
 * CRITICAL PROPERTY: All metadata is read ONCE at bootstrap time via Reflect
 * and baked into the ApplicationGraph. The request-time handler execution path
 * performs ZERO Reflect metadata reads — metadata is captured in the handler
 * closure and precomputed data structures at build time.
 *
 * The graph captures per-controller:
 * - Route metadata (method/path/params/guards/filters/interceptors/httpCode/headers)
 * - Effective scope (singleton vs request-scoped) after dependency bubbling
 * - Middleware and provider graph nodes
 */

import type { BuiltRoute } from '../registrar/registrar-types.js';

/**
 * Assemble the immutable {@link ApplicationGraph} from the boot artifacts and
 * deep-freeze it. Called once by the bootstrap pipeline after routes are built
 * and the request-scope set is known; the router stage then registers from the
 * frozen graph. Freezes the SHAPE (routes/providers/scopes), never live
 * controller instances — request-scoped controllers still instantiate per
 * request from the child-container path.
 */
export function buildApplicationGraph(
  routes: ReadonlyArray<BuiltRoute>,
  providers: ReadonlyMap<Function, ReadonlyArray<Function>>,
  requestScopedTokens: ReadonlySet<Function>
): ApplicationGraph {
  return deepFreeze<ApplicationGraph>({
    routes: [...routes],
    providers,
    requestScopedTokens,
  });
}

/**
 * ApplicationGraph IR: The immutable plan built once at bootstrap by reading
 * Reflect metadata. Request-time execution reads ONLY from this graph.
 *
 * The graph is deep-frozen to enforce immutability and prevent accidental
 * mutations that would break the boot-once guarantee.
 *
 * Structure:
 * - routes: All BuiltRoute objects with precomputed handler closures
 * - providers: DI provider metadata for request-scope bubble detection
 * - requestScopedTokens: Set of provider tokens with request scope
 */
export interface ApplicationGraph {
  /** All built routes (precomputed at bootstrap, frozen) */
  readonly routes: ReadonlyArray<BuiltRoute>;

  /** Provider dependency map (Function → Function[]) */
  readonly providers: ReadonlyMap<Function, ReadonlyArray<Function>>;

  /** Tokens marked as request-scoped (require child container per request) */
  readonly requestScopedTokens: ReadonlySet<Function>;
}

/**
 * Deep freeze a value (recursively freeze objects, arrays, Maps, Sets).
 * Used to enforce immutability of the ApplicationGraph and prevent accidental
 * mutations after bootstrap completes.
 *
 * @internal
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
    return Object.freeze(obj) as T;
  }

  if (obj instanceof Map) {
    obj.forEach((value) => {
      deepFreeze(value);
    });
    return Object.freeze(obj) as T;
  }

  if (obj instanceof Set) {
    // Sets are frozen but values inside may not be — freeze them
    obj.forEach((value) => {
      deepFreeze(value);
    });
    return Object.freeze(obj) as T;
  }

  // Plain object
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
  }

  return Object.freeze(obj) as T;
}
