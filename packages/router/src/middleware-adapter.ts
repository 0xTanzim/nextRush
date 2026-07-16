/**
 * @nextrush/router - Middleware Adaptation
 *
 * Router-level-middleware sealing logic extracted from the `Router` class
 * (T014, design.md D3 — extracted after the matching-engine and composition
 * splits left `router.ts` still over the 300-line ceiling).
 *
 * The tree-walk that re-compiles every handler's executor is structurally
 * pure (it only mutates the `TrieNode`/`HandlerEntry` structures passed in,
 * same shape as `copyRoutes` in `composition.ts`) — it doesn't touch
 * `Router`-only state like `_sealed`, so it extracts cleanly. `routes()` and
 * `allowedMethods()` stay on `Router`: both return closures that capture
 * `this` (for `this.match`, `this.opts`, `this.root`) and are the router's
 * actual public middleware-producing API, not internal tree mechanics.
 *
 * @packageDocumentation
 * @internal
 */

import { compileExecutor, type HandlerEntry, type TrieNode } from './segment-trie';
import type { Middleware } from '@nextrush/types';

/**
 * Re-compile every route executor in the trie (plus the static-route hash
 * map) to include router-level middleware ahead of each route's own
 * middleware. Idempotency (guarding against a double seal) is the caller's
 * responsibility — this function always re-walks and re-compiles.
 */
export function sealRouterMiddleware(
  root: TrieNode,
  staticRoutes: Map<string, HandlerEntry>,
  routerMiddleware: Middleware[]
): void {
  const routerMw = [...routerMiddleware];

  const walk = (node: TrieNode): void => {
    for (const [method, entry] of node.handlers) {
      const combinedMw = [...routerMw, ...entry.middleware];
      entry.executor = compileExecutor(entry.handler, combinedMw);
      node.handlers.set(method, entry);
    }
    for (const [, child] of node.children) {
      walk(child);
    }
    if (node.paramChild) walk(node.paramChild);
    if (node.wildcardChild) walk(node.wildcardChild);
  };

  walk(root);

  // Also update static route entries
  for (const [key, entry] of staticRoutes) {
    const combinedMw = [...routerMw, ...entry.middleware];
    entry.executor = compileExecutor(entry.handler, combinedMw);
    staticRoutes.set(key, entry);
  }
}
