/**
 * @nextrush/router - Route Registration
 *
 * Trie-insertion logic extracted from the `Router` class (T014, design.md D2 —
 * D2 keeps HTTP-verb shortcuts (`get`/`post`/etc.) on `Router` itself, but
 * explicitly permits extracting their shared internal, `addRoute`, "if
 * `addRoute` itself is large enough to warrant it." At 116 lines and the
 * highest cyclomatic/cognitive complexity in the file, it is.
 *
 * `addRoute` touches five pieces of `Router` instance state (the trie root,
 * `caseSensitive`, the `hasParamRoutes` flag, the static-route hash map, and
 * the introspection registry) as both reads and writes. All five are threaded
 * explicitly rather than read/written through an implicit `this`, so this
 * function has no hidden dependency on `Router` beyond what's passed in —
 * same principle as the matching-engine extraction (design.md D1).
 *
 * @packageDocumentation
 * @internal
 */

import { HTTP_METHODS } from '@nextrush/types';
import type {
  HttpMethod,
  MetadataContribution,
  Middleware,
  RouteDefinition,
  RouteEntry,
  RouteHandler,
} from '@nextrush/types';
import {
  compileExecutor,
  createNode,
  NodeType,
  parseSegments,
  type HandlerEntry,
  type TrieNode,
} from './segment-trie';
import { mergeContributions, readContribution } from './route-metadata';
import { createRedirectHandler, type RedirectStatus } from './redirect';

/** Registration state `addRoute` reads, threaded explicitly. */
export interface RegistrationState {
  readonly root: TrieNode;
  readonly caseSensitive: boolean;
  readonly staticRoutes: Map<string, HandlerEntry>;
  readonly routeDefinitions: RouteDefinition[];
}

/**
 * Normalize a route path at registration time: join the router prefix,
 * collapse duplicate slashes, drop a trailing slash in non-strict mode, and
 * guarantee a leading slash.
 *
 * @remarks
 * This is registration-time normalization — it joins the router `prefix` and
 * never case-folds (case handling belongs to trie insertion / matching). It is
 * a distinct concern from `normalizePathForMatch` in `matching.ts`, which
 * normalizes an *incoming request* path for lookup; both were extracted from
 * `Router` to keep each single-definition (design.md D2/D3).
 */
export function normalizeRegistrationPath(path: string, prefix: string, strict: boolean): string {
  // Handle prefix with trailing slash and path with leading slash
  let joinedPrefix = prefix;
  if (joinedPrefix.endsWith('/') && path.startsWith('/')) {
    joinedPrefix = joinedPrefix.slice(0, -1);
  }

  let normalized = joinedPrefix + path;

  // Fast-path: skip regex when no double slashes (99%+ of requests)
  if (normalized.includes('//')) {
    normalized = normalized.replace(/\/+/g, '/');
  }

  // For non-strict mode during registration, remove trailing slash
  if (!strict && normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

/**
 * Insert one route into the segment trie, updating every side structure
 * (static-route fast-path map, introspection registry) that
 * `Router.match`/`Router.getRoutes` depend on.
 *
 * @param normalized - Already-normalized path (caller applies `Router`'s own
 *   prefix/strict-mode normalization before calling this — normalization
 *   itself stays a `Router` method since it only touches `opts`, not the trie).
 * @param recordIntrospection - When `false`, skips pushing this call's row
 *   into `state.routeDefinitions` while still inserting the concrete
 *   per-method trie handler (matching is completely unaffected either way).
 *   `Router.all()` (T016) sets this to `false` on each of its 7 per-method
 *   `addRoute` calls, then pushes exactly one consolidated
 *   `isAnyMethod: true` row itself — so an any-method route yields a single
 *   `getRoutes()` entry instead of one row per enumerated method, without
 *   touching how any individual method is matched. Every other call site
 *   (`get`/`post`/etc., `redirect`, sub-router mounting) omits this parameter
 *   and keeps the original one-row-per-call behavior unchanged.
 * @returns `true` if the registered route has a param or wildcard segment —
 *   the caller (`Router.addRoute`) uses this to flip its own `hasParamRoutes`
 *   flag. Returned rather than mutated through `state` because it's a
 *   primitive: a struct field can't carry a boolean mutation back to the
 *   caller by reference the way `root`/`staticRoutes`/`routeDefinitions` do.
 */
export function addRoute(
  method: HttpMethod,
  normalized: string,
  entries: RouteEntry[],
  middleware: Middleware[],
  state: RegistrationState,
  recordIntrospection = true
): boolean {
  const segments = parseSegments(normalized, state.caseSensitive);

  let node = state.root;

  for (const seg of segments) {
    if (seg.type === NodeType.PARAM) {
      if (!node.paramChild) {
        node.paramChild = createNode(seg.segment, NodeType.PARAM);
        node.paramChild.paramName = seg.paramName;
      } else if (node.paramChild.paramName !== seg.paramName) {
        // Same position, different param names — this silently loses one name
        // at runtime (params[newName] is undefined), so fail fast at
        // registration rather than warn (audit RT-5). Also removes the
        // process.env / console.warn usage that was here.
        throw new Error(
          `Route param name conflict at "${normalized}": ":${String(seg.paramName)}" ` +
            `conflicts with existing ":${String(node.paramChild.paramName)}" at the same ` +
            `position. Use the same param name for this segment across all routes.`
        );
      }
      node = node.paramChild;
    } else if (seg.type === NodeType.WILDCARD) {
      node.wildcardChild ??= createNode('*', NodeType.WILDCARD);
      node = node.wildcardChild;
      break; // Wildcard must be last
    } else {
      const key = seg.segment;
      let child = node.children.get(key);
      if (!child) {
        child = createNode(seg.segment, NodeType.STATIC);
        node.children.set(key, child);
      }
      node = child;
    }
  }

  // Partition entries: functions are behavior (inline middleware + the final
  // handler); pure markers (endpoint()) contribute metadata only and never
  // execute. Every entry may also carry a metadata contribution (e.g. a
  // function like validate() that both runs and contributes its schema).
  const functions: Middleware[] = [];
  const contributions: MetadataContribution[] = [];
  for (const routeEntry of entries) {
    const contribution = readContribution(routeEntry);
    if (contribution) contributions.push(contribution);
    if (typeof routeEntry === 'function') functions.push(routeEntry);
  }

  // Combine functions into a single handler with inline middleware
  const combinedMiddleware = [...middleware];
  const finalHandler: RouteHandler | undefined = functions[functions.length - 1];

  if (!finalHandler) {
    throw new Error('At least one handler is required');
  }

  // Inline middleware = every function before the last
  for (let i = 0; i < functions.length - 1; i++) {
    const fn = functions[i];
    if (fn) combinedMiddleware.push(fn);
  }

  // Pre-compile executor at registration time (not per-request!)
  const executor = compileExecutor(finalHandler, combinedMiddleware);

  const handlerEntry: HandlerEntry = {
    handler: finalHandler,
    middleware: combinedMiddleware,
    executor,
  };

  // Detect duplicate route registration
  if (node.handlers.has(method)) {
    throw new Error(
      `Route conflict: ${method} ${normalized} is already registered. ` +
        'Remove the duplicate or use a different path.'
    );
  }

  node.handlers.set(method, handlerEntry);

  // Populate static route hash map for O(1) lookup
  const hasParams = segments.some((s) => s.type === NodeType.PARAM || s.type === NodeType.WILDCARD);
  if (!hasParams) {
    const normalizedKey = state.caseSensitive ? normalized : normalized.toLowerCase();
    state.staticRoutes.set(`${method} ${normalizedKey}`, handlerEntry);
  }

  // Record in the introspection registry (side structure — never touched by
  // request dispatch). key is the canonical `${METHOD} ${pathPattern}`. Skipped
  // when the caller is consolidating multiple addRoute calls into a single row
  // itself (Router.all(), T016) — the concrete trie handler above is still
  // inserted regardless, so matching for this method is unaffected.
  if (recordIntrospection) {
    state.routeDefinitions.push({
      key: `${method} ${normalized}`,
      method,
      path: normalized,
      metadata: mergeContributions(contributions),
    });
  }

  return hasParams;
}

/**
 * Callback signature matching `Router['addRoute']` (the validating/
 * normalizing wrapper, not the extracted `addRoute` above) — injected so
 * `registerRedirect` doesn't need `Router` instance access, same pattern as
 * `copyRoutes`'s `AddRouteFn` in `composition.ts`.
 */
export type RegisterRouteFn = (method: HttpMethod, path: string, entries: RouteEntry[]) => void;

/**
 * Register a redirect route from one path to another across every HTTP
 * method the target status code requires (GET/HEAD always; POST/PUT/PATCH/
 * DELETE additionally for 307/308, which must preserve the original method).
 *
 * Extracted from `Router.redirect()` — thematically closer to "register N
 * routes for one call" than to composition or matching, and, like
 * `copyRoutes`, only needs `addRoute` injected rather than full `Router`
 * instance access.
 */
export function registerRedirect(
  from: string,
  to: string,
  status: RedirectStatus,
  addRoute: RegisterRouteFn
): void {
  const redirectHandler = createRedirectHandler(to, status);

  // Register for common methods. 307/308 preserve the original method,
  // so register all standard methods for those status codes.
  addRoute('GET', from, [redirectHandler]);
  addRoute('HEAD', from, [redirectHandler]);
  if (status === 307 || status === 308) {
    addRoute('POST', from, [redirectHandler]);
    addRoute('PUT', from, [redirectHandler]);
    addRoute('PATCH', from, [redirectHandler]);
    addRoute('DELETE', from, [redirectHandler]);
  }
}

/**
 * Push a single consolidated any-method (`isAnyMethod: true`) introspection
 * row (T016) into the registry.
 *
 * @remarks
 * `Router.all()` / `GroupRouter.all()` insert one concrete per-method trie
 * handler each (so every method still matches) with `recordIntrospection`
 * off, then call this exactly once — so `getRoutes()` yields a single row per
 * `.all()`/`@All()` route instead of one row per enumerated HTTP method,
 * without changing how any individual method is matched.
 *
 * @param routeDefinitions - The router's introspection registry to append to.
 * @param normalized - The already-normalized route path.
 */
export function pushAnyMethodDefinition(
  routeDefinitions: RouteDefinition[],
  normalized: string
): void {
  routeDefinitions.push({
    key: `${HTTP_METHODS[0]} ${normalized}`,
    method: HTTP_METHODS[0],
    path: normalized,
    isAnyMethod: true,
  });
}
