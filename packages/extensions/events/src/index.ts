/**
 * @nextrush/events - Type-safe Event Emitter for NextRush v3
 *
 * A simple, fast, async-ready event system with full TypeScript support.
 *
 * @packageDocumentation
 *
 * @example Primary Usage (with NextRush)
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { events } from '@nextrush/events';
 *
 * const app = createApp().extend(events());
 * await app.ready();
 *
 * // Direct access via app.events — fully inferred, no augmentation needed
 * app.events.emit('user:created', { id: '1', name: 'Alice' });
 * app.events.on('user:created', (data) => console.log(data));
 * ```
 *
 * @example Standalone Usage (testing/libraries)
 * ```typescript
 * import { createEvents } from '@nextrush/events';
 *
 * const events = createEvents<MyEvents>();
 * events.emit('user:created', { id: '1', name: 'Alice' });
 * ```
 */

export { EventEmitter } from './emitter';
export type {
    EventEmitterOptions,
    EventHandler,
    EventMap,
    EventNames,
    TypedEventEmitter,
    Unsubscribe
} from './types';

import { EventEmitter } from './emitter';
import type { EventEmitterOptions, EventMap } from './types';
import { VALID_PROPERTY_NAME } from './types';
import type { Extension, ExtensionContext } from '@nextrush/types';

declare const __VERSION__: string;
export const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';


/**
 * Create a new typed event emitter (standalone usage).
 *
 * Use this for:
 * - Testing in isolation
 * - Libraries that don't use NextRush
 * - Multiple independent event buses
 *
 * @template T - Event map type for type-safe events
 * @param options - Emitter options
 * @returns Type-safe event emitter
 *
 * @example
 * ```typescript
 * interface AppEvents {
 *   'server:started': { port: number };
 *   'request:received': { method: string; path: string };
 * }
 *
 * const events = createEvents<AppEvents>();
 *
 * events.on('server:started', ({ port }) => {
 *   console.log(`Server running on port ${port}`);
 * });
 *
 * await events.emit('server:started', { port: 8080 });
 * ```
 */
export function createEvents<T extends EventMap = EventMap>(
  options?: EventEmitterOptions
): EventEmitter<T> {
  return new EventEmitter<T>(options);
}

/**
 * Options for the events extension.
 */
export interface EventsOptions extends EventEmitterOptions {
  /**
   * Property name on the app instance.
   * Must be a valid JavaScript identifier.
   * @default 'events'
   */
  propertyName?: string;
}

/**
 * Create events plugin for NextRush app integration.
 *
 * This is the **primary way** to use events in NextRush.
 * Attaches `app.events` for direct access throughout your app.
 *
 * @template T - Event map type
 * @param options - Plugin options
 * @returns A NextRush Extension. `app.extend(events<T>())` returns `app`
 * intersected with `{ events: EventEmitter<T> }` — `app.events` is inferred
 * automatically, with no `declare module` augmentation required.
 * @throws {TypeError} If propertyName is not a valid JavaScript identifier
 *
 * @example Basic Usage
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { events } from '@nextrush/events';
 *
 * const app = createApp().extend(events());
 * await app.ready();
 *
 * // Direct access - clean DX, fully inferred!
 * app.events.emit('user:created', { id: '1', name: 'Alice' });
 * app.events.on('user:created', (data) => {
 *   console.log('User created:', data);
 * });
 * ```
 *
 * @example Typed Events
 * ```typescript
 * interface MyEvents {
 *   'user:login': { userId: string; ip: string };
 *   'user:logout': { userId: string };
 * }
 *
 * // Pass the event map as a generic — app.events is fully typed, inferred.
 * const app = createApp().extend(events<MyEvents>());
 *
 * app.events.emit('user:login', { userId: '1', ip: '127.0.0.1' });
 * ```
 *
 * @example In Middleware
 * ```typescript
 * app.use(async (ctx) => {
 *   await app.events.emit('request:received', {
 *     method: ctx.method,
 *     path: ctx.path
 *   });
 *
 *   await ctx.next();
 * });
 * ```
 *
 * @remarks
 * The `{ events: EventEmitter<T> }` decorated shape assumes the default
 * `propertyName: 'events'`. If you pass a custom `propertyName`, the value
 * is still decorated correctly at runtime under that key, but the static
 * type continues to expose it as `.events` — cast or use `WithEvents<T>`
 * for a custom property name at the type level.
 */
export function events<T extends EventMap = EventMap>(
  options: EventsOptions = {}
): Extension<{ events: EventEmitter<T> }> {
  const { propertyName = 'events', ...emitterOptions } = options;

  // Validate property name
  if (!VALID_PROPERTY_NAME.test(propertyName)) {
    throw new TypeError(
      `Invalid property name '${propertyName}'. Must be a valid JavaScript identifier.`
    );
  }

  const emitter = new EventEmitter<T>(emitterOptions);

  return {
    name: 'events',
    setup(ctx: ExtensionContext): void {
      // Expose the emitter as `app.<propertyName>` (default `app.events`).
      ctx.decorate(propertyName, emitter);
    },
    destroy(): void {
      // Clean up all handlers on shutdown
      emitter.clear();
    },
  };
}

// Convenience re-export for better tree-shaking
export { DEFAULT_EMITTER_OPTIONS, MAX_EVENT_NAME_LENGTH, VALID_PROPERTY_NAME } from './types';

// ============================================================================
// Type Augmentation Helper
// ============================================================================

/**
 * Helper type for extending Application with events.
 *
 * @example
 * ```typescript
 * import type { WithEvents } from '@nextrush/events';
 *
 * interface MyEvents {
 *   'user:created': { id: string };
 * }
 *
 * // Use in function signatures
 * function setupRoutes(app: WithEvents<MyEvents>) {
 *   app.events.emit('user:created', { id: '1' });
 * }
 * ```
 */
export interface WithEvents<T extends EventMap = EventMap> {
  events: EventEmitter<T>;
}
