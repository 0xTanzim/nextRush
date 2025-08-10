/**
 * NextRush v2 Event System Integration Tests
 */

import type { Application } from '@/core/app/application';
import { NextRushEventSystem } from '@/core/events';
import { createApp } from '@/index';
import type { Event } from '@/types/events';
import { beforeEach, describe, expect, test } from 'vitest';

describe('Event System Integration', () => {
  let app: Application;
  let eventSystem: NextRushEventSystem;
  let events: Event[] = [];

  beforeEach(() => {
    // Clear events for each test
    events = [];

    // Create event system with config
    eventSystem = new NextRushEventSystem({
      enableEventStore: true,
      eventStoreType: 'memory',
    });

    // Subscribe to all events for testing
    eventSystem.subscribe('*', async (event: Event) => {
      events.push(event);
    });

    // Create app
    app = createApp();
  });

  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  describe('Event Store Integration', () => {
    test('should persist and load events', async () => {
      // Emit domain events with proper aggregate structure
      await eventSystem.emitDomainEvent(
        'UserLogin',
        {
          userId: 'user-1',
          timestamp: Date.now(),
          ip: '127.0.0.1',
        },
        'user-1',
        'User',
        1
      );

      await eventSystem.emitDomainEvent(
        'UserLogout',
        {
          userId: 'user-1',
          timestamp: Date.now(),
        },
        'user-1',
        'User',
        2
      );

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Load events from store
      const allEvents = await eventSystem.loadAggregateEvents('user-1');
      expect(allEvents).toHaveLength(2);

      expect(allEvents[0]?.type).toBe('UserLogin');
      expect(allEvents[1]?.type).toBe('UserLogout');
      expect(allEvents[0]?.aggregateId).toBe('user-1');
      expect(allEvents[1]?.aggregateId).toBe('user-1');
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle user registration workflow', async () => {
      let emailSent = false;
      let userCreated = false;

      // Subscribe to registration event
      eventSystem.subscribe('user.registered', async (event: Event) => {
        userCreated = true;

        // Emit email event
        await eventSystem.emit({
          type: 'email.send',
          data: { to: (event.data as any).email, template: 'welcome' },
          metadata: {
            id: `evt-email-${Date.now()}`,
            timestamp: Date.now(),
            source: 'email-service',
            version: 1,
          },
        });
      });

      // Subscribe to email event
      eventSystem.subscribe('email.send', async () => {
        emailSent = true;
      });

      // Trigger the workflow
      await eventSystem.emit({
        type: 'user.registered',
        data: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        metadata: {
          id: 'evt-reg-123',
          timestamp: Date.now(),
          source: 'user-api',
          version: 1,
        },
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(userCreated).toBe(true);
      expect(emailSent).toBe(true);
      expect(events.filter(e => e.type === 'user.registered')).toHaveLength(1);
      expect(events.filter(e => e.type === 'email.send')).toHaveLength(1);
    });
  });
});
