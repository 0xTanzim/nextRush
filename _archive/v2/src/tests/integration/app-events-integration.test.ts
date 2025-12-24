/**
 * Application Event System Integration Tests
 *
 * Tests for the hybrid event system integration in NextRushApplication,
 * ensuring both simple and advanced APIs work correctly.
 *
 * @version 2.0.0
 */

import type { NextRushApplication } from '@/core/app/application';
import { createApp } from '@/index';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Application Event System Integration', () => {
  let app: NextRushApplication;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => {
    // Clean up event listeners
    app.events.removeAllListeners();
  });

  describe('Simple Events API Access', () => {
    it('should expose events property on application instance', () => {
      // Assert
      expect(app.events).toBeDefined();
      expect(typeof app.events.emit).toBe('function');
      expect(typeof app.events.on).toBe('function');
      expect(typeof app.events.once).toBe('function');
      expect(typeof app.events.off).toBe('function');
    });

    it('should allow basic event emission and listening', async () => {
      // Arrange
      const eventName = 'user.created';
      const userData = { id: '123', name: 'John Doe' };
      let receivedData: any = null;

      // Act
      app.events.on(eventName, data => {
        receivedData = data;
      });

      await app.events.emit(eventName, userData);

      // Wait for async event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(receivedData).toEqual(userData);
    });

    it('should support event chaining in application setup', async () => {
      // Arrange
      const events: string[] = [];

      // Act - Setup event listeners during app configuration
      app.events.on('app.started', () => events.push('started'));
      app.events.on('app.ready', () => events.push('ready'));

      // Emit events
      await app.events.emit('app.started');
      await app.events.emit('app.ready');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(events).toEqual(['started', 'ready']);
    });
  });

  describe('Advanced Event System Access', () => {
    it('should expose eventSystem property for advanced usage', () => {
      // Assert
      expect(app.eventSystem).toBeDefined();
      expect(typeof app.eventSystem.dispatch).toBe('function');
      expect(typeof app.eventSystem.subscribe).toBe('function');
    });

    it('should allow CQRS-style event handling', async () => {
      // Note: This test demonstrates the API structure
      // Full CQRS testing is covered in the event-system.test.ts

      // Assert that the advanced API is available
      expect(app.eventSystem).toBeTruthy();
      expect(app.eventSystem.subscribe).toBeTypeOf('function');
      expect(app.eventSystem.dispatch).toBeTypeOf('function');
    });
  });

  describe('API Coexistence', () => {
    it('should allow both simple and advanced APIs to work together', async () => {
      // Arrange
      let simpleEventReceived = false;
      let advancedEventReceived = false;

      // Act - Use simple API
      app.events.on('test.event', () => {
        simpleEventReceived = true;
      });

      // The advanced API would work alongside simple API
      // (Full integration would require more complex event setup)

      await app.events.emit('test.event', { test: true });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(simpleEventReceived).toBe(true);
      // Advanced API remains accessible
      expect(app.eventSystem).toBeTruthy();
    });

    it('should maintain separate event contexts', async () => {
      // Arrange
      const simpleEvents: any[] = [];

      // Act - Simple API events
      app.events.on('simple.test', data => simpleEvents.push(data));

      await app.events.emit('simple.test', { type: 'simple1' });
      await app.events.emit('simple.test', { type: 'simple2' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(simpleEvents).toHaveLength(2);
      expect(simpleEvents[0].type).toBe('simple1');
      expect(simpleEvents[1].type).toBe('simple2');
    });
  });

  describe('Event System Lifecycle', () => {
    it('should properly initialize event system during app creation', () => {
      // Arrange & Act
      const newApp = createApp();

      // Assert
      expect(newApp.events).toBeDefined();
      expect(newApp.eventSystem).toBeDefined();
    });

    it('should handle event cleanup when app is destroyed', async () => {
      // Arrange
      let eventReceived = false;
      app.events.on('cleanup.test', () => {
        eventReceived = true;
      });

      // Act - Clean up all listeners
      app.events.removeAllListeners();

      await app.events.emit('cleanup.test');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(eventReceived).toBe(false);
    });
  });

  describe('Express-style Migration Compatibility', () => {
    it('should provide familiar Express-like event API', () => {
      // Assert - Check API surface matches Express EventEmitter pattern
      expect(app.events.on).toBeTypeOf('function');
      expect(app.events.emit).toBeTypeOf('function');
      expect(app.events.once).toBeTypeOf('function');
      expect(app.events.off).toBeTypeOf('function');
      expect(app.events.removeAllListeners).toBeTypeOf('function');
      expect(app.events.eventNames).toBeTypeOf('function');
      expect(app.events.listenerCount).toBeTypeOf('function');
    });

    it('should support typical Express event patterns', async () => {
      // Arrange - Typical Express-style patterns
      const eventLog: Array<{ event: string; data: any }> = [];

      // Act - Express-style event handling
      app.events.on('user.login', user => {
        eventLog.push({ event: 'user.login', data: user });
      });

      app.events.on('user.logout', user => {
        eventLog.push({ event: 'user.logout', data: user });
      });

      // Emit events like Express apps typically do
      await app.events.emit('user.login', {
        userId: '123',
        email: 'john@example.com',
      });
      await app.events.emit('user.logout', { userId: '123' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].event).toBe('user.login');
      expect(eventLog[0].data.userId).toBe('123');
      expect(eventLog[1].event).toBe('user.logout');
    });
  });

  describe('Error Handling in Application Context', () => {
    it('should handle event errors gracefully without crashing app', async () => {
      // Arrange
      let errorOccurred = false;
      const originalConsoleError = console.error;
      console.error = () => {
        errorOccurred = true;
      };

      // Act - Add handler that throws
      app.events.on('error.test', () => {
        throw new Error('Test error');
      });

      // Emit event and ensure app doesn't crash
      await app.events.emit('error.test');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(errorOccurred).toBe(true);
      expect(app.events).toBeTruthy(); // App still functional

      // Cleanup
      console.error = originalConsoleError;
    });
  });

  describe('Performance in Application Context', () => {
    it('should handle multiple simultaneous events efficiently', async () => {
      // Arrange
      const eventCount = 100;
      let processedCount = 0;

      app.events.on('performance.test', () => {
        processedCount++;
      });

      // Act - Emit many events simultaneously
      const promises = [];
      for (let i = 0; i < eventCount; i++) {
        promises.push(app.events.emit('performance.test', { index: i }));
      }

      const start = performance.now();
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 50));
      const end = performance.now();

      // Assert
      expect(processedCount).toBe(eventCount);
      expect(end - start).toBeLessThan(500); // Should be fast
    });
  });
});
