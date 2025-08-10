/**
 * Debug test to check event system configuration
 */
import { NextRushEventSystem, createEventSystem } from '@/core/events';
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, test } from 'vitest';

describe('Event System Debug', () => {
  let eventSystem: NextRushEventSystem;

  beforeEach(async () => {
    console.log('Creating event system...');
    eventSystem = createEventSystem()
      .withEventStore('memory', 1000)
      .withMonitoring()
      .build();
    console.log('Event system created');

    // Don't clear the system - this removes essential subscriptions!
    // await eventSystem.clear();
    console.log('Event system ready (no clear called)');
  });

  test('should configure event system correctly', async () => {
    // Check if event system has event store
    const hasEventStore = (eventSystem as any).eventStore !== undefined;
    console.log('Has event store:', hasEventStore);

    // Check if wildcards subscriptions exist
    const eventEmitter = (eventSystem as any).eventEmitter;
    const subscriptions = eventEmitter.subscriptions;
    const wildcardSubs = subscriptions.get('*');
    console.log(
      'Wildcard subscriptions:',
      wildcardSubs ? wildcardSubs.size : 'none'
    );

    // Try emitting an event
    console.log('Emitting domain event...');
    await eventSystem.emitDomainEvent(
      'TestEvent',
      { test: true },
      'test-123',
      'Test',
      1
    );

    // Wait and check
    await setTimeout(100);
    const events = await eventSystem.loadAggregateEvents('test-123');
    console.log('Events loaded:', events.length);

    expect(hasEventStore).toBe(true);
  });
});
