/**
 * Simple Events API Facade for NextRush v2
 *
 * Provides a simple string-based event API that bridges to the sophisticated
 * CQRS/Event Sourcing implementation underneath.
 *
 * @packageDocumentation
 */

import type { Event, EventSubscription } from '../../../types/events';
import { createEventMetadata, generatePrefixedId } from '../utils/event-helpers';
import type { NextRushEventSystem } from './event-system';

// ============================================================================
// Types
// ============================================================================

/**
 * Simple event handler type for string-based events
 */
export type SimpleEventHandler = (data: unknown) => void | Promise<void>;

/**
 * Simple event listener registration
 */
interface SimpleEventListener {
  readonly eventName: string;
  readonly handler: SimpleEventHandler;
  readonly subscription: EventSubscription;
}

// ============================================================================
// Simple Event Implementation
// ============================================================================

/**
 * Simple Event implementation for string-based events
 */
class SimpleEvent implements Event {
  public readonly type: string;
  public readonly data: unknown;
  public readonly metadata: ReturnType<typeof createEventMetadata>;

  constructor(eventName: string, eventData: unknown) {
    this.type = eventName;
    this.data = eventData;
    this.metadata = createEventMetadata({
      id: generatePrefixedId('simple'),
      source: 'simple-api',
      correlationId: generatePrefixedId('simple'),
    });
  }

  /**
   * Alias for type (backwards compatibility)
   */
  public get name(): string {
    return this.type;
  }
}

// ============================================================================
// Simple Events API
// ============================================================================

/**
 * Simple Events API Facade
 *
 * Provides familiar Express-style event API while leveraging
 * the sophisticated CQRS implementation underneath.
 *
 * @example
 * ```typescript
 * const events = new SimpleEventsAPI(eventSystem);
 *
 * // Listen for events
 * const unsubscribe = events.on('user.created', (data) => {
 *   console.log('User created:', data.userId);
 * });
 *
 * // Emit events
 * await events.emit('user.created', { userId: '123' });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class SimpleEventsAPI {
  private readonly listeners = new Map<string, SimpleEventListener[]>();

  constructor(private readonly eventSystem: NextRushEventSystem) {}

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit a simple string-based event
   *
   * @param eventName - Event name
   * @param data - Event data (optional)
   * @returns Promise that resolves when event is processed
   */
  async emit(eventName: string, data?: unknown): Promise<void> {
    // Use empty object only if no data argument was provided
    const eventData = arguments.length > 1 ? data : {};
    const event = new SimpleEvent(eventName, eventData);
    await this.eventSystem.emit(event);
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Listen for a simple string-based event
   *
   * @param eventName - Event name to listen for
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  on(eventName: string, handler: SimpleEventHandler): () => void {
    const subscription = this.eventSystem.subscribe(
      eventName,
      async (event: SimpleEvent) => {
        if (event.type === eventName) {
          try {
            await handler(event.data);
          } catch (error) {
            this.logHandlerError(eventName, error);
          }
        }
      }
    );

    const listener: SimpleEventListener = {
      eventName,
      handler,
      subscription,
    };

    this.addListener(eventName, listener);
    return () => this.removeListener(eventName, listener);
  }

  /**
   * Listen for a simple string-based event (once)
   *
   * @param eventName - Event name to listen for
   * @param handler - Handler function (optional)
   * @returns Promise that resolves with event data
   */
  once(eventName: string, handler?: SimpleEventHandler): Promise<unknown> {
    return new Promise(resolve => {
      const unsubscribe = this.on(eventName, async data => {
        unsubscribe();
        if (handler) {
          await handler(data);
        }
        resolve(data);
      });
    });
  }

  /**
   * Remove all listeners for an event
   *
   * @param eventName - Event name
   */
  off(eventName: string): void {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    for (const listener of eventListeners) {
      listener.subscription.unsubscribe();
    }
    this.listeners.delete(eventName);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    for (const eventName of this.listeners.keys()) {
      this.off(eventName);
    }
  }

  // ============================================================================
  // Introspection
  // ============================================================================

  /**
   * Get list of event names that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get number of listeners for an event
   */
  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.length ?? 0;
  }

  /**
   * Get maximum number of listeners (for compatibility)
   * Returns Infinity as we don't impose limits
   */
  getMaxListeners(): number {
    return Infinity;
  }

  /**
   * Set maximum number of listeners (for compatibility)
   * No-op as we don't impose limits
   */
  setMaxListeners(_n: number): this {
    return this;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private addListener(eventName: string, listener: SimpleEventListener): void {
    let eventListeners = this.listeners.get(eventName);
    if (!eventListeners) {
      eventListeners = [];
      this.listeners.set(eventName, eventListeners);
    }
    eventListeners.push(listener);
  }

  private removeListener(
    eventName: string,
    listener: SimpleEventListener
  ): void {
    listener.subscription.unsubscribe();

    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }

    if (eventListeners.length === 0) {
      this.listeners.delete(eventName);
    }
  }

  private logHandlerError(eventName: string, error: unknown): void {
    // Always log errors - this is important for debugging
    // eslint-disable-next-line no-console
    console.error(`Error in event handler for '${eventName}':`, error);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a simple events API instance
 *
 * @param eventSystem - Underlying sophisticated event system
 * @returns Simple events API
 */
export function createSimpleEventsAPI(
  eventSystem: NextRushEventSystem
): SimpleEventsAPI {
  return new SimpleEventsAPI(eventSystem);
}
