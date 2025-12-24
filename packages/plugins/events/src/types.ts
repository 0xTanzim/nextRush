/**
 * @nextrush/events - Type definitions
 *
 * Simple, type-safe event system for NextRush v3.
 */

/**
 * Event handler function type.
 *
 * @template T - Event data type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Internal handler wrapper with metadata.
 */
export interface HandlerEntry<T = unknown> {
  readonly handler: EventHandler<T>;
  readonly once: boolean;
}

/**
 * Event map type for typed events.
 * Use Record<string, unknown> as base for flexibility.
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   'user:created': { id: string; name: string };
 *   'user:deleted': { id: string };
 * }
 * ```
 */
export type EventMap = Record<string, unknown>;

/**
 * Extract event names from an event map.
 */
export type EventNames<T extends EventMap> = keyof T & string;

/**
 * Options for creating an event emitter.
 */
export interface EventEmitterOptions {
  /**
   * Maximum listeners per event before warning.
   * Set to 0 to disable warnings.
   *
   * @default 10
   */
  maxListeners?: number;

  /**
   * Whether to catch and isolate handler errors.
   * When true, one handler error won't affect others.
   *
   * @default true
   */
  errorIsolation?: boolean;

  /**
   * Custom error handler for isolated errors.
   */
  onError?: (error: Error, eventName: string) => void;
}

/**
 * Default options for the event emitter.
 */
export const DEFAULT_EMITTER_OPTIONS: Required<
  Omit<EventEmitterOptions, 'onError'>
> = {
  maxListeners: 10,
  errorIsolation: true,
};

/**
 * Unsubscribe function returned by on/once.
 */
export type Unsubscribe = () => void;

/**
 * Type-safe event emitter interface.
 *
 * @template T - Event map type
 */
export interface TypedEventEmitter<T extends EventMap = EventMap> {
  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe;

  /**
   * Subscribe to an event once.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  once<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe;

  /**
   * Unsubscribe from an event.
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): void;

  /**
   * Emit an event.
   *
   * @param event - Event name
   * @param data - Event data
   * @returns Promise that resolves when all handlers complete
   */
  emit<K extends EventNames<T>>(event: K, data: T[K]): Promise<void>;

  /**
   * Get listener count for an event.
   *
   * @param event - Event name (optional, returns total if omitted)
   */
  listenerCount(event?: string): number;

  /**
   * Remove all listeners for an event or all events.
   *
   * @param event - Event name (optional, clears all if omitted)
   */
  clear(event?: string): void;
}
