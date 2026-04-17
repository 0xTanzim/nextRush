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
 * import { eventsPlugin } from '@nextrush/events';
 *
 * const app = createApp();
 * app.plugin(eventsPlugin());
 *
 * // Direct access via app.events
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

/**
 * Plugin interface (minimal, to avoid circular deps)
 */
interface Plugin {
  readonly name: string;
  readonly version?: string;
  install(app: unknown): void | Promise<void>;
  destroy?(): void | Promise<void>;
}

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
 * await events.emit('server:started', { port: 3000 });
 * ```
 */
export function createEvents<T extends EventMap = EventMap>(
  options?: EventEmitterOptions
): EventEmitter<T> {
  return new EventEmitter<T>(options);
}

/**
 * Plugin options for NextRush integration.
 */
export interface EventsPluginOptions extends EventEmitterOptions {
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
 * @returns NextRush plugin
 * @throws {TypeError} If propertyName is not a valid JavaScript identifier
 *
 * @example Basic Usage
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { eventsPlugin } from '@nextrush/events';
 *
 * const app = createApp();
 * app.plugin(eventsPlugin());
 *
 * // Direct access - clean DX!
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
 * // For TypeScript, augment the Application type
 * declare module '@nextrush/core' {
 *   interface Application {
 *     events: import('@nextrush/events').EventEmitter<MyEvents>;
 *   }
 * }
 *
 * app.plugin(eventsPlugin<MyEvents>());
 *
 * // Now fully typed!
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
 */
export function eventsPlugin<T extends EventMap = EventMap>(
  options: EventsPluginOptions = {}
): Plugin & { events: EventEmitter<T> } {
  const { propertyName = 'events', ...emitterOptions } = options;

  // Validate property name
  if (!VALID_PROPERTY_NAME.test(propertyName)) {
    throw new TypeError(
      `Invalid property name '${propertyName}'. Must be a valid JavaScript identifier.`
    );
  }

  const emitter = new EventEmitter<T>(emitterOptions);

  return {
    name: '@nextrush/events',
    version: '3.0.0-alpha.1',

    /**
     * The event emitter instance.
     * Access directly if needed, but prefer `app.events`.
     */
    events: emitter,

    install(app) {
      // Guard against invalid app object
      if (!app || typeof app !== 'object') {
        return;
      }

      // Attach events to the app for direct access
      Object.defineProperty(app, propertyName, {
        value: emitter,
        writable: false,
        enumerable: true,
        configurable: false,
      });
    },

    destroy() {
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
