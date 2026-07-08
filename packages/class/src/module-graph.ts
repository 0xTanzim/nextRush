/**
 * @nextrush/controllers - Module graph traversal
 *
 * Walks a module's `imports` into a flat, ordered, deduplicated list. The walk
 * is post-order (imported feature modules before their importer), dedupes
 * diamond/duplicate imports, and guards import cycles. See RFC-NEXTRUSH-MODULES.
 */

import { getModuleMetadata, isModule } from './module.js';
import { NotAModuleError } from './errors.js';

/**
 * Collect the full module graph reachable from `root` via `imports`.
 *
 * - **Post-order**: an imported module appears before the module that imports
 *   it, so a feature module's providers/controllers register before the root's.
 * - **Dedupe**: a module reached through multiple paths (diamond) or listed
 *   twice is included exactly once (first-completed wins).
 * - **Cycle guard**: a back-edge to an in-progress module is skipped, so a
 *   mutual import (`A imports B imports A`) terminates instead of recursing
 *   forever.
 *
 * @throws {NotAModuleError} if `root` or any imported class lacks `@Module`.
 */
export function collectModuleGraph(root: Function): Function[] {
  const ordered: Function[] = [];
  const completed = new Set<Function>();
  const visiting = new Set<Function>();

  const visit = (mod: Function): void => {
    if (completed.has(mod)) {
      return;
    }
    if (visiting.has(mod)) {
      // Back-edge into an in-progress module — an import cycle. Skip to
      // terminate; the module is still added when its original visit completes.
      return;
    }
    if (!isModule(mod)) {
      throw new NotAModuleError(mod.name || 'AnonymousModule');
    }

    visiting.add(mod);

    const metadata = getModuleMetadata(mod);
    for (const imported of metadata?.imports ?? []) {
      visit(imported);
    }

    visiting.delete(mod);
    completed.add(mod);
    ordered.push(mod);
  };

  visit(root);
  return ordered;
}

/**
 * Collect every controller declared across an ordered module list, preserving
 * order and deduplicating a controller declared in more than one module.
 */
export function collectModuleControllers(modules: Function[]): Function[] {
  const controllers: Function[] = [];
  const seen = new Set<Function>();

  for (const mod of modules) {
    const metadata = getModuleMetadata(mod);
    for (const controller of metadata?.controllers ?? []) {
      if (!seen.has(controller)) {
        seen.add(controller);
        controllers.push(controller);
      }
    }
  }

  return controllers;
}
