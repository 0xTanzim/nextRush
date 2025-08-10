import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRushEventSystem } from '../../../../core/events/event-system';

describe('Isolated Event Persistence Test', () => {
  let eventSystem: NextRushEventSystem;

  beforeEach(() => {
    eventSystem = new NextRushEventSystem({
      enableEventStore: true,
      eventStoreType: 'memory',
      maxStoredEvents: 1000,
    });
  });

  afterEach(async () => {
    await eventSystem.shutdown();
  });

  it('should save and replay events from aggregate', async () => {
    const aggregateId = 'user-123';

    // Create and emit domain event
    await eventSystem.emitDomainEvent(
      'UserCreated',
      {
        userId: aggregateId,
        name: 'John Doe',
        email: 'john@example.com',
      },
      aggregateId,
      'User',
      1
    );

    // Let persistence happen
    await new Promise(resolve => setTimeout(resolve, 100));

    // Load events from store
    const loadedEvents = await eventSystem.loadAggregateEvents(aggregateId);
    console.log('Events loaded:', loadedEvents.length, loadedEvents);

    expect(loadedEvents).toHaveLength(1);
    expect(loadedEvents[0]?.type).toBe('UserCreated');
    expect(loadedEvents[0]?.aggregateId).toBe(aggregateId);
  });
});
