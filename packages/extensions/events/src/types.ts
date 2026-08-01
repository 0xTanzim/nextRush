/**
 * @nextrush/events - Type definitions
 *
 * Simple, type-safe event system for NextRush v3.
 */

/**
 * Maximum allowed length for event names.
 * Prevents memory issues from extremely long event names.
 */
export const MAX_EVENT_NAME_LENGTH = 256;

/**
 * Valid property name pattern for plugin integration.
 * Must be a valid JavaScript identifier.
 */
export const VALID_PROPERTY_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

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

  /**
   * Get all event names with registered handlers.
   *
   * @returns Array of event names
   */
  eventNames(): string[];

  /**
   * Get all handlers for an event.
   *
   * @param event - Event name
   * @returns Array of handler functions
   */
  listeners<K extends EventNames<T>>(event: K): EventHandler<T[K]>[];

  /**
   * Check if an event has listeners.
   *
   * @param event - Event name (optional, checks any if omitted)
   * @returns True if listeners exist
   */
  hasListeners(event?: string): boolean;

  /**
   * Set the maximum number of listeners per event.
   *
   * @param n - Maximum listeners (0 = unlimited)
   * @returns This emitter for chaining
   */
  setMaxListeners(n: number): this;

  /**
   * Get the maximum listeners setting.
   *
   * @returns Maximum listeners
   */
  getMaxListeners(): number;
}
