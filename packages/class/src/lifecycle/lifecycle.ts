/**
 * @nextrush/class - Service lifecycle bridge
 *
 * Bridges duck-typed service lifecycle hooks (`OnInit`/`OnShutdown` from
 * `@nextrush/class`) into the application's Extension lifecycle without
 * touching `@nextrush/core`:
 *
 * - `onInit()` runs at `app.ready()` (when adapters boot the app, before serving)
 * - `onShutdown()` runs at `app.close()`, in the reverse of the `onInit` order
 *
 * Instances are collected by walking the controller + transitive
 * `@Service`/`@Repository`/`@Config` graph, resolving each from the active
 * container, and keeping the DISTINCT instances (deduped by identity) that
 * implement at least one hook. Ordering is a reverse-BFS approximation:
 * dependencies initialize before the controllers/services that depend on them,
 * and tear down in the opposite order. Services without hooks are untouched, and
 * no Extension is registered at all when no instance implements a hook.
 */

import type { Application } from '@nextrush/core';
import { isOnInit, isOnShutdown } from './lifecycle-types.js';
import type { Container, Token } from '@nextrush/di';
import { collectServiceGraph } from '../request/isolation.js';

/**
 * Base name of the internal Extension registered to run lifecycle hooks. Each
 * `registerControllers` call that finds hooks registers a uniquely-suffixed
 * variant (see {@link registerLifecycleExtension}), because `app.extend()`
 * rejects duplicate names and the same app may register controllers more than
 * once.
 */
export const CONTROLLERS_LIFECYCLE_EXTENSION = 'nextrush:controllers-lifecycle';

/** Monotonic per-call counter guaranteeing unique Extension names within a process. */
let lifecycleRegistrationCount = 0;

/**
 * Return the distinct instances implementing `onInit` and/or `onShutdown`, in
 * dependency-first `onInit` order (dependencies before the classes that depend
 * on them — a reverse-BFS approximation).
 *
 * Services are resolved from `container` (singletons return the shared instance
 * requests use). Controllers are taken ONLY from `instanceCache` (populated by
 * the registrar's eager validation) — never force-resolved here, so disabling
 * validation keeps controller construction lazy. A controller that implements a
 * hook therefore participates only when validation is enabled (the default).
 *
 * Unresolvable service classes are skipped silently; genuine resolution failures
 * are surfaced separately by the registrar's eager controller/guard validation.
 */
export function collectLifecycleInstances(
  controllers: Function[],
  container: Container,
  instanceCache: Map<Function, unknown>
): object[] {
  const seen = new Set<object>();
  const collected: object[] = [];

  const consider = (instance: unknown): void => {
    if (typeof instance !== 'object' || instance === null || seen.has(instance)) {
      return;
    }
    seen.add(instance);
    if (isOnInit(instance) || isOnShutdown(instance)) {
      collected.push(instance);
    }
  };

  // Dependencies first: reverse the BFS service graph (deepest deps lead).
  for (const service of [...collectServiceGraph(controllers)].reverse()) {
    try {
      consider(container.resolve(service as Token));
    } catch {
      continue;
    }
  }

  // Controllers last (they depend on the services above), using only the
  // already-resolved instance — never resolving a controller just for hooks.
  for (const controller of controllers) {
    consider(instanceCache.get(controller));
  }

  return collected;
}

/**
 * Register the internal lifecycle Extension on `app` when at least one collected
 * instance implements a hook. No-op when there are none (never adds a dead
 * Extension).
 *
 * @throws if the app is already booted (`ready()`) or running — configuration is
 * frozen and `app.extend()` would reject, so this fails fast with actionable
 * guidance to call `registerControllers` before `serve()`/`ready()`.
 */
export function registerLifecycleExtension(
  app: Application,
  controllers: Function[],
  container: Container,
  instanceCache: Map<Function, unknown>
): void {
  const instances = collectLifecycleInstances(controllers, container, instanceCache);
  if (instances.length === 0) {
    return;
  }

  if (app.isReady || app.isRunning) {
    throw new Error(
      'registerControllers() found services with lifecycle hooks (onInit/onShutdown), ' +
        'but the app is already booted (ready()) or running, so its configuration is ' +
        'frozen and the lifecycle Extension cannot be registered. Call ' +
        'registerControllers() BEFORE serve()/listen()/ready().'
    );
  }

  app.extend({
    name: `${CONTROLLERS_LIFECYCLE_EXTENSION}#${++lifecycleRegistrationCount}`,
    async setup(): Promise<void> {
      for (const instance of instances) {
        if (isOnInit(instance)) {
          await instance.onInit();
        }
      }
    },
    async destroy(): Promise<void> {
      // Isolated, per-hook teardown (F-03 / RFC-022 D2): a throwing onShutdown()
      // must not strand every later service's teardown. Mirrors the app-level
      // Promise.allSettled isolation across extensions — this loop previously
      // had none, so one throw aborted every subsequent hook in reverse order.
      const errors: unknown[] = [];
      for (const instance of [...instances].reverse()) {
        if (isOnShutdown(instance)) {
          try {
            await instance.onShutdown();
          } catch (err) {
            errors.push(err);
          }
        }
      }
      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          `${String(errors.length)} onShutdown() hook(s) failed`
        );
      }
    },
  });
}
