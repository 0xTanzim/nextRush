/**
 * Simple Events API Facade for NextRush v2
 *
 * Provides a simple string-based event API that bridges to the sophisticated
 * CQRS/Event Sourcing implementation underneath.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import type { Event, EventSubscription } from '../../types/events';
import { createEventMetadata } from './event-emitter';
import type { NextRushEventSystem } from './event-system';

/**
 * Simple event handler type for string-based events
 */
export type SimpleEventHandler = (data: any) => void | Promise<void>;

/**
 * Simple event listener registration
 */
export interface SimpleEventListener {
  eventName: string;
  handler: SimpleEventHandler;
  subscription: EventSubscription;
}

/**
 * Simple Event implementation for string-based events
 */
class SimpleEvent implements Event {
  public readonly type: string;
  public readonly data: any;
  public readonly metadata: any;

  constructor(eventName: string, eventData: any) {
    this.type = eventName;
    this.data = eventData;
    this.metadata = createEventMetadata({
      id: `simple_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      source: 'simple-api',
      correlationId: `simple_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      version: 1,
    });
  }

  // Keep name for backwards compatibility with simple API
  public get name(): string {
    return this.type;
  }
}

/**
 * Simple Events API Facade
 *
 * Provides familiar Express-style event API while leveraging
 * the sophisticated CQRS implementation underneath.
 */
export class SimpleEventsAPI {
  private listeners: Map<string, SimpleEventListener[]> = new Map();

  constructor(private eventSystem: NextRushEventSystem) {}

  /**
   * Emit a simple string-based event
   *
   * @param eventName - Event name
   * @param data - Event data
   * @returns Promise that resolves when event is processed
   *
   * @example
   * ```typescript
   * app.events.emit('user.created', { userId: '123', name: 'John' });
   * ```
   */
  async emit(eventName: string, data?: any): Promise<void> {
    // Create a SimpleEvent that implements our Event interface
    // Use undefined if no data is provided, otherwise use the provided data
    const eventData = arguments.length > 1 ? data : {};
    const event = new SimpleEvent(eventName, eventData);

    // Emit through the sophisticated event system
    await this.eventSystem.emit(event);
  }

  /**
   * Listen for a simple string-based event
   *
   * @param eventName - Event name to listen for
   * @param handler - Handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = app.events.on('user.created', (data) => {
   *   console.log('User created:', data.userId);
   * });
   * ```
   */
  on(eventName: string, handler: SimpleEventHandler): () => void {
    // Subscribe to SimpleEvent type through the sophisticated system
    const subscription = this.eventSystem.subscribe(
      eventName,
      async (event: SimpleEvent) => {
        // Only handle SimpleEvent instances with matching names
        if (event.type === eventName) {
          try {
            await handler(event.data);
          } catch (error) {
            // Log error but don't break other handlers
            console.error(`Error in event handler for '${eventName}':`, error);
          }
        }
      }
    );

    // Store listener reference for management
    const listener: SimpleEventListener = {
      eventName,
      handler,
      subscription,
    };

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(listener);

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();

      // Remove from our tracking
      const eventListeners = this.listeners.get(eventName);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index !== -1) {
          eventListeners.splice(index, 1);
        }
        if (eventListeners.length === 0) {
          this.listeners.delete(eventName);
        }
      }
    };
  }

  /**
   * Listen for a simple string-based event (once)
   *
   * @param eventName - Event name to listen for
   * @param handler - Handler function
   * @returns Promise that resolves with event data
   *
   * @example
   * ```typescript
   * const data = await app.events.once('user.created');
   * console.log('User created:', data.userId);
   * ```
   */
  once(eventName: string, handler?: SimpleEventHandler): Promise<any> {
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
   *
   * @example
   * ```typescript
   * app.events.off('user.created');
   * ```
   */
  off(eventName: string): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      // Unsubscribe all listeners
      eventListeners.forEach(listener => {
        listener.subscription.unsubscribe();
      });
      this.listeners.delete(eventName);
    }
  }

  /**
   * Remove all listeners
   *
   * @example
   * ```typescript
   * app.events.removeAllListeners();
   * ```
   */
  removeAllListeners(): void {
    for (const [eventName] of this.listeners) {
      this.off(eventName);
    }
  }

  /**
   * Get list of event names that have listeners
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get number of listeners for an event
   *
   * @param eventName - Event name
   * @returns Number of listeners
   */
  listenerCount(eventName: string): number {
    const eventListeners = this.listeners.get(eventName);
    return eventListeners ? eventListeners.length : 0;
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
}

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
