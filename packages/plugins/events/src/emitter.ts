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
import { DEFAULT_EMITTER_OPTIONS } from './types';

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
export class EventEmitter<T extends EventMap = EventMap>
  implements TypedEventEmitter<T>
{
  private readonly handlers = new Map<string, Set<HandlerEntry<unknown>>>();
  private readonly options: Required<Omit<EventEmitterOptions, 'onError'>> & {
    onError?: EventEmitterOptions['onError'];
  };

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      ...DEFAULT_EMITTER_OPTIONS,
      ...options,
    };
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
    return this.addHandler(event, handler, false);
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
    return this.addHandler(event, handler, true);
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
   *
   * @example
   * ```typescript
   * await events.emit('user:created', { id: '1', name: 'Alice' });
   * ```
   */
  async emit<K extends EventNames<T>>(event: K, data: T[K]): Promise<void> {
    const promises: Promise<void>[] = [];
    const handlersToRemove: Array<{ event: string; entry: HandlerEntry<unknown> }> =
      [];

    // Direct event handlers
    const directHandlers = this.handlers.get(event);
    if (directHandlers) {
      for (const entry of directHandlers) {
        promises.push(this.executeHandler(event, entry, data, handlersToRemove));
      }
    }

    // Wildcard handlers (receive all events)
    const wildcardHandlers = this.handlers.get(WILDCARD);
    if (wildcardHandlers && event !== WILDCARD) {
      for (const entry of wildcardHandlers) {
        promises.push(
          this.executeHandler(WILDCARD, entry, { event, data }, handlersToRemove)
        );
      }
    }

    // Pattern handlers (e.g., 'user:*' matches 'user:created')
    for (const [pattern, handlers] of this.handlers) {
      if (this.matchesPattern(event, pattern)) {
        for (const entry of handlers) {
          promises.push(
            this.executeHandler(pattern, entry, { event, data }, handlersToRemove)
          );
        }
      }
    }

    // Wait for all handlers
    await Promise.allSettled(promises);

    // Remove once handlers
    for (const { event: e, entry } of handlersToRemove) {
      const handlers = this.handlers.get(e);
      if (handlers) {
        handlers.delete(entry);
        if (handlers.size === 0) {
          this.handlers.delete(e);
        }
      }
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

  private addHandler<D>(
    event: string,
    handler: EventHandler<D>,
    once: boolean
  ): Unsubscribe {
    let handlers = this.handlers.get(event);

    if (!handlers) {
      handlers = new Set();
      this.handlers.set(event, handlers);
    }

    const entry: HandlerEntry<D> = { handler, once };
    handlers.add(entry as HandlerEntry<unknown>);

    // Memory leak warning
    if (
      this.options.maxListeners > 0 &&
      handlers.size > this.options.maxListeners
    ) {
      console.warn(
        `[nextrush/events] Warning: Event '${event}' has ${handlers.size} listeners. ` +
          `This might indicate a memory leak. ` +
          `Use { maxListeners: 0 } to disable this warning.`
      );
    }

    return () => {
      handlers!.delete(entry as HandlerEntry<unknown>);
      if (handlers!.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  private async executeHandler(
    event: string,
    entry: HandlerEntry<unknown>,
    data: unknown,
    handlersToRemove: Array<{ event: string; entry: HandlerEntry<unknown> }>
  ): Promise<void> {
    if (entry.once) {
      handlersToRemove.push({ event, entry });
    }

    try {
      await entry.handler(data);
    } catch (error) {
      if (this.options.errorIsolation) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (this.options.onError) {
          try {
            this.options.onError(err, event);
          } catch {
            // Ignore errors in error handler to prevent infinite loops
          }
        } else if (process.env['NODE_ENV'] !== 'test') {
          console.error(`[nextrush/events] Handler error for '${event}':`, err);
        }
      } else {
        throw error;
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
