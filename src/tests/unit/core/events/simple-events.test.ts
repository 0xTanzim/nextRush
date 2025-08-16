/**
 * Simple Events API Tests
 *
 * Comprehensive test suite for the Simple Events API facade
 * that bridges to the sophisticated CQRS implementation.
 *
 * @version 2.0.0
 */

import { NextRushEventSystem } from '@/core/events/event-system';
import {
  createSimpleEventsAPI,
  SimpleEventsAPI,
} from '@/core/events/simple-events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SimpleEventsAPI', () => {
  let eventSystem: NextRushEventSystem;
  let simpleEvents: SimpleEventsAPI;

  beforeEach(() => {
    eventSystem = new NextRushEventSystem();
    simpleEvents = createSimpleEventsAPI(eventSystem);
  });

  afterEach(() => {
    // Clean up all listeners
    simpleEvents.removeAllListeners();
  });

  describe('Basic Event Operations', () => {
    it('should emit and receive simple string events', async () => {
      // Arrange
      const eventName = 'test.event';
      const eventData = { message: 'Hello, World!' };
      let receivedData: any = null;

      // Act - Setup listener
      const unsubscribe = simpleEvents.on(eventName, data => {
        receivedData = data;
      });

      // Act - Emit event
      await simpleEvents.emit(eventName, eventData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(receivedData).toEqual(eventData);

      // Cleanup
      unsubscribe();
    });

    it('should handle multiple listeners for the same event', async () => {
      // Arrange
      const eventName = 'test.multiple';
      const eventData = { count: 42 };
      const receivedData: any[] = [];

      // Act - Setup multiple listeners
      const unsubscribe1 = simpleEvents.on(eventName, data => {
        receivedData.push({ listener: 1, data });
      });

      const unsubscribe2 = simpleEvents.on(eventName, data => {
        receivedData.push({ listener: 2, data });
      });

      // Act - Emit event
      await simpleEvents.emit(eventName, eventData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(receivedData).toHaveLength(2);
      expect(receivedData[0].data).toEqual(eventData);
      expect(receivedData[1].data).toEqual(eventData);
      expect(receivedData[0].listener).toBe(1);
      expect(receivedData[1].listener).toBe(2);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });

    it('should not trigger listeners for different event names', async () => {
      // Arrange
      const eventData = { test: true };
      let wrongEventTriggered = false;
      let correctEventTriggered = false;

      // Act - Setup listeners for different events
      const unsubscribe1 = simpleEvents.on('event.one', () => {
        correctEventTriggered = true;
      });

      const unsubscribe2 = simpleEvents.on('event.two', () => {
        wrongEventTriggered = true;
      });

      // Act - Emit only one event
      await simpleEvents.emit('event.one', eventData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(correctEventTriggered).toBe(true);
      expect(wrongEventTriggered).toBe(false);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });
  });

  describe('Event Data Handling', () => {
    it('should handle undefined/null data gracefully', async () => {
      // Arrange
      const eventName = 'test.empty';
      let receivedData: any = 'not-set';

      // Act - Setup listener
      const unsubscribe = simpleEvents.on(eventName, data => {
        receivedData = data;
      });

      // Test undefined data
      await simpleEvents.emit(eventName, undefined);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedData).toBeUndefined();

      // Test null data
      await simpleEvents.emit(eventName, null);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedData).toBeNull();

      // Test no data (should default to {})
      await simpleEvents.emit(eventName);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedData).toEqual({});

      // Cleanup
      unsubscribe();
    });

    it('should handle complex data objects', async () => {
      // Arrange
      const eventName = 'test.complex';
      const complexData = {
        user: {
          id: 123,
          name: 'John Doe',
          roles: ['admin', 'user'],
          metadata: {
            lastLogin: new Date(),
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        action: 'user.updated',
        timestamp: Date.now(),
      };
      let receivedData: any = null;

      // Act
      const unsubscribe = simpleEvents.on(eventName, data => {
        receivedData = data;
      });

      await simpleEvents.emit(eventName, complexData);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(receivedData).toEqual(complexData);
      expect(receivedData.user.roles).toEqual(['admin', 'user']);
      expect(receivedData.user.metadata.preferences.theme).toBe('dark');

      // Cleanup
      unsubscribe();
    });
  });

  describe('Once Event Handling', () => {
    it('should trigger once event listener only once', async () => {
      // Arrange
      const eventName = 'test.once';
      const eventData = { trigger: 1 };
      let triggerCount = 0;

      // Act - Setup once listener
      const dataPromise = simpleEvents.once(eventName, () => {
        triggerCount++;
      });

      // Emit event multiple times
      await simpleEvents.emit(eventName, eventData);
      await simpleEvents.emit(eventName, { trigger: 2 });
      await simpleEvents.emit(eventName, { trigger: 3 });

      // Wait for the promise to resolve
      const receivedData = await dataPromise;

      // Assert
      expect(triggerCount).toBe(1);
      expect(receivedData).toEqual(eventData);
    });

    it('should return promise that resolves with event data', async () => {
      // Arrange
      const eventName = 'test.promise';
      const eventData = { important: 'data' };

      // Act - Setup once listener (no handler)
      const dataPromise = simpleEvents.once(eventName);

      // Emit after a delay to test async behavior
      setTimeout(() => {
        simpleEvents.emit(eventName, eventData);
      }, 50);

      // Wait for the promise
      const receivedData = await dataPromise;

      // Assert
      expect(receivedData).toEqual(eventData);
    });
  });

  describe('Listener Management', () => {
    it('should properly unsubscribe listeners', async () => {
      // Arrange
      const eventName = 'test.unsubscribe';
      let eventReceived = false;

      // Act - Setup and immediately unsubscribe
      const unsubscribe = simpleEvents.on(eventName, () => {
        eventReceived = true;
      });
      unsubscribe();

      // Emit event after unsubscribing
      await simpleEvents.emit(eventName, {});
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(eventReceived).toBe(false);
    });

    it('should remove all listeners for a specific event', async () => {
      // Arrange
      const eventName = 'test.off';
      let listener1Triggered = false;
      let listener2Triggered = false;

      // Act - Setup multiple listeners
      simpleEvents.on(eventName, () => {
        listener1Triggered = true;
      });
      simpleEvents.on(eventName, () => {
        listener2Triggered = true;
      });

      // Remove all listeners for the event
      simpleEvents.off(eventName);

      // Emit event
      await simpleEvents.emit(eventName, {});
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(listener1Triggered).toBe(false);
      expect(listener2Triggered).toBe(false);
    });

    it('should remove all listeners for all events', async () => {
      // Arrange
      let event1Triggered = false;
      let event2Triggered = false;

      // Act - Setup listeners for different events
      simpleEvents.on('event.1', () => {
        event1Triggered = true;
      });
      simpleEvents.on('event.2', () => {
        event2Triggered = true;
      });

      // Remove all listeners
      simpleEvents.removeAllListeners();

      // Emit events
      await simpleEvents.emit('event.1', {});
      await simpleEvents.emit('event.2', {});
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(event1Triggered).toBe(false);
      expect(event2Triggered).toBe(false);
    });
  });

  describe('Event Introspection', () => {
    it('should return correct event names', () => {
      // Arrange & Act
      simpleEvents.on('event.one', () => {});
      simpleEvents.on('event.two', () => {});
      simpleEvents.on('event.one', () => {}); // Duplicate event name

      const eventNames = simpleEvents.eventNames();

      // Assert
      expect(eventNames).toEqual(
        expect.arrayContaining(['event.one', 'event.two'])
      );
      expect(eventNames).toHaveLength(2); // Should not duplicate
    });

    it('should return correct listener count', () => {
      // Arrange
      const eventName = 'test.count';

      // Act & Assert - Initially zero
      expect(simpleEvents.listenerCount(eventName)).toBe(0);

      // Add listeners
      const unsubscribe1 = simpleEvents.on(eventName, () => {});
      expect(simpleEvents.listenerCount(eventName)).toBe(1);

      const unsubscribe2 = simpleEvents.on(eventName, () => {});
      expect(simpleEvents.listenerCount(eventName)).toBe(2);

      // Remove one listener
      unsubscribe1();
      expect(simpleEvents.listenerCount(eventName)).toBe(1);

      // Remove all listeners
      unsubscribe2();
      expect(simpleEvents.listenerCount(eventName)).toBe(0);
    });

    it('should handle max listeners methods for compatibility', () => {
      // Act & Assert
      expect(simpleEvents.getMaxListeners()).toBe(Infinity);

      const returnValue = simpleEvents.setMaxListeners(100);
      expect(returnValue).toBe(simpleEvents); // Should return this for chaining
      expect(simpleEvents.getMaxListeners()).toBe(Infinity); // Should still be Infinity
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event handlers gracefully', async () => {
      // Arrange
      const eventName = 'test.error';
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let otherHandlerCalled = false;

      // Act - Setup handlers, one that throws
      simpleEvents.on(eventName, () => {
        throw new Error('Handler error');
      });

      simpleEvents.on(eventName, () => {
        otherHandlerCalled = true;
      });

      // Emit event
      await simpleEvents.emit(eventName, {});
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(otherHandlerCalled).toBe(true); // Other handlers should still work

      // Cleanup
      consoleErrorSpy.mockRestore();
    });

    it('should handle async errors in event handlers', async () => {
      // Arrange
      const eventName = 'test.async.error';
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let successHandlerCalled = false;

      // Act - Setup handlers
      simpleEvents.on(eventName, async () => {
        throw new Error('Async handler error');
      });

      simpleEvents.on(eventName, () => {
        successHandlerCalled = true;
      });

      // Emit event
      await simpleEvents.emit(eventName, {});
      await new Promise(resolve => setTimeout(resolve, 20)); // Extra time for async

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(successHandlerCalled).toBe(true);

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration with Sophisticated Event System', () => {
    it('should dispatch events through the underlying CQRS system', async () => {
      // Arrange
      const eventName = 'integration.test';
      const eventData = { integration: true };
      let receivedEvent: any = null;

      // Setup listener directly on the sophisticated system
      eventSystem.subscribe(eventName, (event: any) => {
        receivedEvent = event;
      });

      // Act - Emit through simple API
      await simpleEvents.emit(eventName, eventData);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(receivedEvent).toBeTruthy();
      expect(receivedEvent.type).toBe(eventName);
      expect(receivedEvent.data).toEqual(eventData);
      expect(receivedEvent.metadata).toBeTruthy();
    });

    it('should create events with proper metadata', async () => {
      // Arrange
      const eventName = 'metadata.test';
      const eventData = { test: 'metadata' };
      let capturedEvent: any = null;

      // Spy on the emit method to capture the event
      const emitSpy = vi
        .spyOn(eventSystem, 'emit')
        .mockImplementation(async (event: any) => {
          capturedEvent = event;
        });

      // Act
      await simpleEvents.emit(eventName, eventData);

      // Assert
      expect(emitSpy).toHaveBeenCalled();
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe(eventName);
      expect(capturedEvent.data).toEqual(eventData);
      expect(capturedEvent.metadata).toBeTruthy();
      expect(capturedEvent.metadata.source).toBe('simple-api');
      expect(capturedEvent.metadata.version).toBe(1);

      // Cleanup
      emitSpy.mockRestore();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle high-frequency events efficiently', async () => {
      // Arrange
      const eventName = 'performance.test';
      const eventCount = 1000;
      let receivedCount = 0;

      simpleEvents.on(eventName, () => {
        receivedCount++;
      });

      // Act - Emit many events quickly
      const start = performance.now();

      const promises: Promise<void>[] = [];
      for (let i = 0; i < eventCount; i++) {
        promises.push(simpleEvents.emit(eventName, { index: i }));
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for processing

      const end = performance.now();

      // Assert
      expect(receivedCount).toBe(eventCount);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should properly clean up memory when removing listeners', () => {
      // Arrange
      const eventName = 'memory.test';
      const listenerCount = 100;
      const unsubscribeFunctions: Array<() => void> = [];

      // Act - Add many listeners
      for (let i = 0; i < listenerCount; i++) {
        const unsubscribe = simpleEvents.on(eventName, () => {});
        unsubscribeFunctions.push(unsubscribe);
      }

      expect(simpleEvents.listenerCount(eventName)).toBe(listenerCount);

      // Remove all listeners
      unsubscribeFunctions.forEach(unsub => unsub());

      // Assert
      expect(simpleEvents.listenerCount(eventName)).toBe(0);
      expect(simpleEvents.eventNames()).not.toContain(eventName);
    });
  });
});
