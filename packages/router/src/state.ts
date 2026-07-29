/**
 * @nextrush/router - Router State Construction
 *
 * Pure builders for the `Router`'s resolved options and its memoized state
 * struct, extracted from the constructor (design.md D2) so `Router` stays a
 * thin shell that delegates even its own initialization.
 *
 * @packageDocumentation
 * @internal
 */

import type { Middleware, RouteDefinition, RouterOptions } from '@nextrush/types';
import type { StaticRouteMap, TrieNode } from './segment-trie';
import type { RegistrationState } from './registration';
import type { MatchState } from './match-route';

/** Apply defaults to user-supplied router options. */
export function resolveRouterOptions(options: RouterOptions): Required<RouterOptions> {
  return {
    prefix: options.prefix ?? '',
    caseSensitive: options.caseSensitive ?? false,
    strict: options.strict ?? false,
    decode: options.decode ?? true,
  };
}

/**
 * Build the state struct the extracted registration/matching functions read.
 *
 * @remarks
 * Every field is a stable reference for the router's lifetime, so the caller
 * memoizes this once — `reset()` mutates the referenced structures in place, it
 * never reassigns them. A single struct satisfies both `RegistrationState`
 * (what `addRoute` reads) and `MatchState` (what `resolveMatch` reads).
 */
export function createRouterState(
  root: TrieNode,
  opts: Required<RouterOptions>,
  staticRoutes: StaticRouteMap,
  routeDefinitions: RouteDefinition[],
  routerMiddleware: Middleware[]
): RegistrationState & MatchState {
  return {
    root,
    staticRoutes,
    routeDefinitions,
    caseSensitive: opts.caseSensitive,
    strict: opts.strict,
    decode: opts.decode,
    routerMiddleware,
    maxDepth: 0,
  };
}
