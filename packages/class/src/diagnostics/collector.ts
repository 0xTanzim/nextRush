/**
 * collectDiagnostics: Pure function deriving DiagnosticsReport from ApplicationGraph IR
 *
 * Extracts route list, provider list, detects duplicate routes (same method+path),
 * detects circular dependencies via DFS, and includes bootstrap timings.
 *
 * Called by bootstrap/pipeline.ts when diagnostics: true.
 */

import type { ApplicationGraph } from '../bootstrap/graph.js';
import type {
  CircularDependency,
  DiagnosticsReport,
  DuplicateRoute,
  ProviderEntry,
  RouteEntry,
  TimingEntry,
} from './types.js';

/**
 * Collect diagnostics from the frozen ApplicationGraph IR.
 *
 * Pure function: takes graph and timings, derives report without side effects.
 * Reports extracted route list, provider graph, duplicate routes, circular
 * dependencies, and stage timings.
 *
 * @param graph Frozen ApplicationGraph from bootstrap
 * @param timings Array of timing entries (stage name + duration)
 * @returns DiagnosticsReport with all extracted metadata
 */
export function collectDiagnostics(
  graph: ApplicationGraph,
  timings: TimingEntry[]
): DiagnosticsReport {
  // Extract routes: map BuiltRoute to RouteEntry
  const routes = graph.routes.map((route) => ({
    method: route.method,
    path: route.path,
    controller: route.controller,
  })) as RouteEntry[];

  // Extract providers: convert Map<Function, Function[]> to ProviderEntry[]
  const providers = Array.from(graph.providers.entries()).map(([token, deps]) => ({
    token,
    dependencies: [...deps],
  })) as ProviderEntry[];

  // Detect duplicate routes: same method+path more than once
  const routeMap = new Map<string, number>();
  for (const route of routes) {
    const key = `${route.method}:${route.path}`;
    routeMap.set(key, (routeMap.get(key) ?? 0) + 1);
  }

  const duplicateRoutes = Array.from(routeMap.entries())
    .filter(([_key, count]) => count > 1)
    .map(([key, count]) => {
      const [method, ...pathParts] = key.split(':');
      return {
        method,
        path: pathParts.join(':'),
        count,
      };
    }) as DuplicateRoute[];

  // Detect circular dependencies via DFS
  const circularDependencies = detectCircularDependencies(graph.providers);

  return {
    routes: Object.freeze(routes),
    providers: Object.freeze(providers),
    duplicateRoutes: Object.freeze(duplicateRoutes),
    circularDependencies: Object.freeze(circularDependencies),
    timings: Object.freeze(timings),
  };
}

/**
 * Detect circular dependencies in the provider graph using DFS.
 * Returns array of cycles found (each cycle is an array of tokens).
 *
 * @param providers Map from token to its dependencies
 * @returns Array of detected cycles
 */
function detectCircularDependencies(
  providers: ReadonlyMap<Function | Symbol, ReadonlyArray<Function | Symbol>>
): CircularDependency[] {
  const cycles: CircularDependency[] = [];
  const visited = new Set<Function | Symbol>();
  const recursionStack = new Set<Function | Symbol>();

  const visit = (token: Function | Symbol, path: (Function | Symbol)[]): void => {
    if (recursionStack.has(token)) {
      // Found a cycle: extract it from the path
      const cycleStart = path.indexOf(token);
      if (cycleStart !== -1) {
        const cycle = Object.freeze([...path.slice(cycleStart), token]) as ReadonlyArray<Function | Symbol>;
        cycles.push({ cycle });
      }
      return;
    }

    if (visited.has(token)) {
      return;
    }

    visited.add(token);
    recursionStack.add(token);

    const deps = providers.get(token) || [];
    for (const dep of deps) {
      visit(dep, [...path, token]);
    }

    recursionStack.delete(token);
  };

  // Start DFS from each unvisited provider
  for (const token of providers.keys()) {
    if (!visited.has(token)) {
      visit(token, []);
    }
  }

  return cycles;
}
