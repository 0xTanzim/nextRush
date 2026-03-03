/**
 * @nextrush/events - Event Emitter Implementation
 *
 * A simple, type-safe, async-ready event emitter for NextRush v3.
 * Focuses on developer experience over complexity.
 */

import type {
  EventEmitterOptions,
  EventHandler,
  EventMap,
  EventNames,
  HandlerEntry,
  TypedEventEmitter,
  Unsubscribe,
} from './types';
import { DEFAULT_EMITTER_OPTIONS, MAX_EVENT_NAME_LENGTH } from './types';

const WILDCARD = '*';

/**
 * Type-safe event emitter with async support.
 *
 * Features:
 * - Full TypeScript support with typed events
 * - Async handler support with Promise.allSettled
 * - Error isolation (one handler error won't crash others)
 * - Wildcard event subscriptions
 * - Memory leak warnings
 * - Simple, intuitive API
 *
 * @example
 * ```typescript
 * // Define your events
 * interface MyEvents {
 *   'user:created': { id: string; name: string };
 *   'user:deleted': { id: string };
 * }
 *
 * // Create typed emitter
 * const events = new EventEmitter<MyEvents>();
 *
 * // Subscribe with full type safety
 * events.on('user:created', (data) => {
 *   console.log(data.id, data.name); // Fully typed!
 * });
 *
 * // Emit events
 * await events.emit('user:created', { id: '1', name: 'Alice' });
 * ```
 */
export class EventEmitter<T extends EventMap = EventMap> implements TypedEventEmitter<T> {
  private readonly handlers = new Map<string, Set<HandlerEntry<unknown>>>();
  private options: Required<Omit<EventEmitterOptions, 'onError'>> & {
    onError?: EventEmitterOptions['onError'];
  };

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      ...DEFAULT_EMITTER_OPTIONS,
      ...options,
    };
  }

  /**
   * Validate an event name.
   * @throws {TypeError} If event name is invalid
   * @throws {RangeError} If event name exceeds maximum length
   */
  private validateEventName(event: string): void {
    if (typeof event !== 'string' || event.length === 0) {
      throw new TypeError('Event name must be a non-empty string');
    }
    if (event.length > MAX_EVENT_NAME_LENGTH) {
      throw new RangeError(
        `Event name exceeds maximum length of ${MAX_EVENT_NAME_LENGTH} characters`
      );
    }
  }

  /**
   * Subscribe to an event.
   *
   * @param event - Event name
   * @param handler - Handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = events.on('user:created', (data) => {
   *   console.log('User created:', data);
   * });
   *
   * // Later: unsubscribe
   * unsubscribe();
   * ```
   */
  on<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe {
    return this.addHandler(event, handler, false, false);
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first call).
   *
   * @param event - Event name
   * @param handler - Handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * events.once('app:ready', () => {
   *   console.log('App is ready!');
   * });
   * ```
   */
  once<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe {
    return this.addHandler(event, handler, true, false);
  }

  /**
   * Subscribe to an event, prepending to the handler list.
   * The handler will be called before other handlers.
   *
   * @param event - Event name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  prepend<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe {
    return this.addHandler(event, handler, false, true);
  }

  /**
   * Subscribe to an event once, prepending to the handler list.
   *
   * @param event - Event name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  prependOnce<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): Unsubscribe {
    return this.addHandler(event, handler, true, true);
  }

  /**
   * Unsubscribe a handler from an event.
   *
   * @param event - Event name
   * @param handler - Handler function to remove
   *
   * @example
   * ```typescript
   * const handler = (data) => console.log(data);
   * events.on('user:created', handler);
   *
   * // Later: unsubscribe
   * events.off('user:created', handler);
   * ```
   */
  off<K extends EventNames<T>>(event: K, handler: EventHandler<T[K]>): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    for (const entry of handlers) {
      if (entry.handler === handler) {
        handlers.delete(entry);
        break;
      }
    }

    if (handlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers.
   *
   * @param event - Event name
   * @param data - Event data
   * @returns Promise that resolves when all handlers complete
   * @throws {AggregateError} When errorIsolation is false and handlers throw
   *
   * @example
   * ```typescript
   * await events.emit('user:created', { id: '1', name: 'Alice' });
   * ```
   */
  async emit<K extends EventNames<T>>(event: K, data: T[K]): Promise<void> {
    const promises: Promise<void>[] = [];
    const errors: Error[] = [];

    // Collect handlers to execute (snapshot to handle modifications during iteration)
    const handlersToExecute: Array<{
      eventKey: string;
      entry: HandlerEntry<unknown>;
      payload: unknown;
    }> = [];

    // Direct event handlers
    const directHandlers = this.handlers.get(event);
    if (directHandlers) {
      for (const entry of directHandlers) {
        // Remove once handlers BEFORE execution to prevent race conditions
        if (entry.once) {
          directHandlers.delete(entry);
          if (directHandlers.size === 0) {
            this.handlers.delete(event);
          }
        }
        handlersToExecute.push({ eventKey: event, entry, payload: data });
      }
    }

    // Wildcard handlers (receive all events)
    const wildcardHandlers = this.handlers.get(WILDCARD);
    if (wildcardHandlers && event !== WILDCARD) {
      for (const entry of wildcardHandlers) {
        if (entry.once) {
          wildcardHandlers.delete(entry);
          if (wildcardHandlers.size === 0) {
            this.handlers.delete(WILDCARD);
          }
        }
        handlersToExecute.push({
          eventKey: WILDCARD,
          entry,
          payload: { event, data },
        });
      }
    }

    // Pattern handlers (e.g., 'user:*' matches 'user:created')
    for (const [pattern, handlers] of this.handlers) {
      if (this.matchesPattern(event, pattern)) {
        for (const entry of handlers) {
          if (entry.once) {
            handlers.delete(entry);
            if (handlers.size === 0) {
              this.handlers.delete(pattern);
            }
          }
          handlersToExecute.push({
            eventKey: pattern,
            entry,
            payload: { event, data },
          });
        }
      }
    }

    // Execute all handlers
    for (const { eventKey, entry, payload } of handlersToExecute) {
      promises.push(this.executeHandler(eventKey, entry, payload, errors));
    }

    // Wait for all handlers
    await Promise.allSettled(promises);

    // Throw AggregateError if errorIsolation is false and there were errors
    if (!this.options.errorIsolation && errors.length > 0) {
      throw new AggregateError(errors, `${errors.length} handler(s) failed for event '${event}'`);
    }
  }

  /**
   * Get the number of listeners for an event.
   *
   * @param event - Event name (optional, returns total if omitted)
   * @returns Listener count
   */
  listenerCount(event?: string): number {
    if (event !== undefined) {
      return this.handlers.get(event)?.size ?? 0;
    }

    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /**
   * Remove all listeners for an event or all events.
   *
   * @param event - Event name (optional, clears all if omitted)
   */
  clear(event?: string): void {
    if (event !== undefined) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get all registered event names.
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get all handlers for an event.
   *
   * @param event - Event name
   * @returns Array of handler functions
   */
  listeners<K extends EventNames<T>>(event: K): EventHandler<T[K]>[] {
    const handlers = this.handlers.get(event);
    if (!handlers) return [];
    return Array.from(handlers).map((entry) => entry.handler as EventHandler<T[K]>);
  }

  /**
   * Check if an event has listeners.
   *
   * @param event - Event name (optional, checks any if omitted)
   * @returns True if listeners exist
   */
  hasListeners(event?: string): boolean {
    if (event !== undefined) {
      return (this.handlers.get(event)?.size ?? 0) > 0;
    }
    return this.handlers.size > 0;
  }

  /**
   * Set the maximum number of listeners per event before warning.
   *
   * @param n - Maximum listeners (0 = unlimited, no warnings)
   * @returns This emitter for chaining
   * @throws {RangeError} If n is not a non-negative integer
   */
  setMaxListeners(n: number): this {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError('maxListeners must be a non-negative integer');
    }
    this.options.maxListeners = n;
    return this;
  }

  /**
   * Get the maximum listeners setting.
   *
   * @returns Maximum listeners
   */
  getMaxListeners(): number {
    return this.options.maxListeners;
  }

  private addHandler<D>(
    event: string,
    handler: EventHandler<D>,
    once: boolean,
    prepend: boolean
  ): Unsubscribe {
    this.validateEventName(event);

    let handlers = this.handlers.get(event);

    if (!handlers) {
      handlers = new Set();
      this.handlers.set(event, handlers);
    }

    const entry: HandlerEntry<D> = { handler, once };

    if (prepend) {
      // Create new Set with entry first, then existing handlers
      const newHandlers = new Set<HandlerEntry<unknown>>();
      newHandlers.add(entry as HandlerEntry<unknown>);
      for (const existing of handlers) {
        newHandlers.add(existing);
      }
      this.handlers.set(event, newHandlers);
      handlers = newHandlers;
    } else {
      handlers.add(entry as HandlerEntry<unknown>);
    }

    // Memory leak warning
    if (this.options.maxListeners > 0 && handlers.size > this.options.maxListeners) {
      console.warn(
        `[nextrush/events] Warning: Event '${event}' has ${handlers.size} listeners. ` +
          `This might indicate a memory leak. ` +
          `Use { maxListeners: 0 } to disable this warning.`
      );
    }

    return () => {
      const currentHandlers = this.handlers.get(event);
      if (currentHandlers) {
        currentHandlers.delete(entry as HandlerEntry<unknown>);
        if (currentHandlers.size === 0) {
          this.handlers.delete(event);
        }
      }
    };
  }

  private async executeHandler(
    event: string,
    entry: HandlerEntry<unknown>,
    data: unknown,
    errors: Error[]
  ): Promise<void> {
    try {
      await entry.handler(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (this.options.errorIsolation) {
        if (this.options.onError) {
          try {
            this.options.onError(err, event);
          } catch {
            // Ignore errors in error handler to prevent infinite loops
          }
        } else if (typeof process === 'undefined' || process.env?.['NODE_ENV'] !== 'test') {
          console.error(`[nextrush/events] Handler error for '${event}':`, err);
        }
      } else {
        // Collect errors for AggregateError
        errors.push(err);
      }
    }
  }

  /**
   * Check if an event name matches a pattern.
   * Supports wildcards at the end (e.g., 'user:*').
   */
  private matchesPattern(event: string, pattern: string): boolean {
    if (pattern === event || pattern === WILDCARD) {
      return false; // Already handled
    }

    if (!pattern.endsWith(':*')) {
      return false;
    }

    const prefix = pattern.slice(0, -1); // Remove trailing '*'
    return event.startsWith(prefix);
  }
}
