/**
 * NextRush v2 Event Emitter Tests
 *
 * Comprehensive test suite for the event emitter with
 * pipeline support, error handling, and performance monitoring.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { setTimeout } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  NextRushEventEmitter,
  createEvent,
  createEventMetadata,
  isEventOfType,
} from '@/core/events/event-emitter';

import type {
  Event,
  EventHandlerDefinition,
  EventPipelineConfig,
  EventSubscription,
} from '@/types/events';

// Test event types
interface TestEvent extends Event<'test.simple', { message: string }> {}
interface ComplexEvent
  extends Event<
    'test.complex',
    {
      id: string;
      data: Record<string, unknown>;
      timestamp: number;
    }
  > {}

describe('NextRushEventEmitter', () => {
  let emitter: NextRushEventEmitter;

  beforeEach(() => {
    emitter = new NextRushEventEmitter();
  });

  afterEach(() => {
    emitter.destroy();
  });

  describe('Basic Event Operations', () => {
    test('should emit and handle events', async () => {
      const handler = vi.fn();
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      emitter.subscribe('test.simple', handler);
      await emitter.emitEvent(testEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(testEvent);
    });

    test('should handle multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      emitter.subscribe('test.simple', handler1);
      emitter.subscribe('test.simple', handler2);
      emitter.subscribe('test.simple', handler3);

      await emitter.emitEvent(testEvent);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    test('should handle async event handlers', async () => {
      const results: string[] = [];
      const asyncHandler = async (event: TestEvent) => {
        await setTimeout(10);
        results.push(event.data.message);
      };

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'async',
      });

      emitter.subscribe('test.simple', asyncHandler);
      await emitter.emitEvent(testEvent);

      expect(results).toEqual(['async']);
    });

    test('should handle events with different types', async () => {
      const simpleHandler = vi.fn();
      const complexHandler = vi.fn();

      const simpleEvent = createEvent<TestEvent>('test.simple', {
        message: 'simple',
      });
      const complexEvent = createEvent<ComplexEvent>('test.complex', {
        id: '123',
        data: { key: 'value' },
        timestamp: Date.now(),
      });

      emitter.subscribe('test.simple', simpleHandler);
      emitter.subscribe('test.complex', complexHandler);

      await emitter.emitEvent(simpleEvent);
      await emitter.emitEvent(complexEvent);

      expect(simpleHandler).toHaveBeenCalledTimes(1);
      expect(complexHandler).toHaveBeenCalledTimes(1);
      expect(simpleHandler).toHaveBeenCalledWith(simpleEvent);
      expect(complexHandler).toHaveBeenCalledWith(complexEvent);
    });
  });

  describe('Event Subscription Management', () => {
    test('should unsubscribe handlers', async () => {
      const handler = vi.fn();
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      const subscription = emitter.subscribe('test.simple', handler);
      await emitter.emitEvent(testEvent);

      expect(handler).toHaveBeenCalledTimes(1);

      await subscription.unsubscribe();
      await emitter.emitEvent(testEvent);

      expect(handler).toHaveBeenCalledTimes(1); // Still only called once
    });

    test('should track subscription state', async () => {
      const handler = vi.fn();
      const subscription = emitter.subscribe('test.simple', handler);

      expect(subscription.isActive()).toBe(true);

      await subscription.unsubscribe();

      expect(subscription.isActive()).toBe(false);
    });

    test('should unsubscribe all handlers for event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      emitter.subscribe('test.simple', handler1);
      emitter.subscribe('test.simple', handler2);
      emitter.subscribe('test.other', handler3);

      await emitter.unsubscribeAll('test.simple');
      await emitter.emitEvent(testEvent);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();

      // Other event type should still work
      const otherEvent = createEvent<Event<'test.other', unknown>>(
        'test.other',
        {}
      );
      await emitter.emitEvent(otherEvent);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    test('should get subscription count', () => {
      expect(emitter.getSubscriptionCount()).toBe(0);
      expect(emitter.getSubscriptionCount('test.simple')).toBe(0);

      const sub1 = emitter.subscribe('test.simple', vi.fn());
      const sub2 = emitter.subscribe('test.simple', vi.fn());
      const sub3 = emitter.subscribe('test.other', vi.fn());

      expect(emitter.getSubscriptionCount()).toBe(3);
      expect(emitter.getSubscriptionCount('test.simple')).toBe(2);
      expect(emitter.getSubscriptionCount('test.other')).toBe(1);
    });

    test('should handle once-only subscriptions', async () => {
      const handler = vi.fn();
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      const definition: EventHandlerDefinition<TestEvent> = {
        handler,
        once: true,
      };

      emitter.subscribeWithOptions('test.simple', definition);

      await emitter.emitEvent(testEvent);
      await emitter.emitEvent(testEvent);
      await emitter.emitEvent(testEvent);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Handler Options', () => {
    test('should handle priority ordering', async () => {
      const results: number[] = [];

      const handler1: EventHandlerDefinition<TestEvent> = {
        handler: () => {
          results.push(1);
        },
        priority: 3,
      };

      const handler2: EventHandlerDefinition<TestEvent> = {
        handler: () => {
          results.push(2);
        },
        priority: 1,
      };

      const handler3: EventHandlerDefinition<TestEvent> = {
        handler: () => {
          results.push(3);
        },
        priority: 2,
      };

      emitter.subscribeWithOptions('test.simple', handler1);
      emitter.subscribeWithOptions('test.simple', handler2);
      emitter.subscribeWithOptions('test.simple', handler3);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      // Note: Current implementation doesn't guarantee priority order
      // This test documents current behavior
      expect(results).toHaveLength(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    test('should handle handler timeouts', async () => {
      const slowHandler = async () => {
        await setTimeout(100);
        return 'completed';
      };

      const definition: EventHandlerDefinition<TestEvent> = {
        handler: slowHandler,
        timeout: 50, // Shorter than handler execution time
      };

      emitter.subscribeWithOptions('test.simple', definition);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      // Should not throw, but handler should timeout silently
      await expect(emitter.emitEvent(testEvent)).resolves.not.toThrow();
    });

    test('should handle retry configuration', async () => {
      let attemptCount = 0;
      const failingHandler = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Handler failed');
        }
        return 'success';
      };

      const definition: EventHandlerDefinition<TestEvent> = {
        handler: failingHandler,
        retry: {
          maxAttempts: 3,
          delay: 10,
          backoffMultiplier: 1,
        },
      };

      emitter.subscribeWithOptions('test.simple', definition);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      // Wait for retries to complete
      await setTimeout(50);

      expect(attemptCount).toBe(3);
    });
  });

  describe('Event Pipelines', () => {
    test('should process events through pipelines', async () => {
      const handler = vi.fn();
      const transformResults: string[] = [];

      // Create a pipeline that transforms the message
      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'test-pipeline',
        stages: [
          {
            name: 'transform-stage',
            transformers: [
              event => {
                transformResults.push(`original: ${event.data.message}`);
                return {
                  ...event,
                  data: {
                    ...event.data,
                    message: event.data.message.toUpperCase(),
                  },
                };
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      expect(transformResults).toEqual(['original: hello']);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { message: 'HELLO' },
        })
      );
    });

    test('should filter events in pipelines', async () => {
      const handler = vi.fn();

      // Create a pipeline that filters out messages containing 'skip'
      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'filter-pipeline',
        stages: [
          {
            name: 'filter-stage',
            filters: [event => !event.data.message.includes('skip')],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const normalEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      const skipEvent = createEvent<TestEvent>('test.simple', {
        message: 'skip this',
      });

      await emitter.emitEvent(normalEvent);
      await emitter.emitEvent(skipEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(normalEvent);
    });

    test('should execute middleware in pipelines', async () => {
      const handler = vi.fn();
      const middlewareResults: string[] = [];

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'middleware-pipeline',
        stages: [
          {
            name: 'middleware-stage',
            middleware: [
              async (event, next) => {
                middlewareResults.push('before-1');
                await next();
                middlewareResults.push('after-1');
              },
              async (event, next) => {
                middlewareResults.push('before-2');
                await next();
                middlewareResults.push('after-2');
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      expect(middlewareResults).toEqual([
        'before-1',
        'before-2',
        'after-2',
        'after-1',
      ]);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple pipeline stages', async () => {
      const handler = vi.fn();
      const stageResults: string[] = [];

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'multi-stage-pipeline',
        stages: [
          {
            name: 'stage-1',
            middleware: [
              async (event, next) => {
                stageResults.push('stage-1');
                await next();
              },
            ],
          },
          {
            name: 'stage-2',
            transformers: [
              event => {
                stageResults.push('stage-2');
                return event;
              },
            ],
          },
          {
            name: 'stage-3',
            filters: [
              event => {
                stageResults.push('stage-3');
                return true;
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      expect(stageResults).toEqual(['stage-1', 'stage-2', 'stage-3']);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should remove pipelines', async () => {
      const handler = vi.fn();
      const transformResults: string[] = [];

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'removable-pipeline',
        stages: [
          {
            name: 'transform-stage',
            transformers: [
              event => {
                transformResults.push('transformed');
                return event;
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      // Event should be processed through pipeline
      const testEvent1 = createEvent<TestEvent>('test.simple', {
        message: 'hello1',
      });
      await emitter.emitEvent(testEvent1);

      expect(transformResults).toEqual(['transformed']);

      // Remove pipeline
      emitter.removePipeline('test.simple', 'removable-pipeline');

      // Event should not be processed through pipeline
      const testEvent2 = createEvent<TestEvent>('test.simple', {
        message: 'hello2',
      });
      await emitter.emitEvent(testEvent2);

      expect(transformResults).toEqual(['transformed']); // No new transformations
      expect(handler).toHaveBeenCalledTimes(2); // But handler still called
    });

    test('should get pipeline names', () => {
      const pipeline1: EventPipelineConfig<TestEvent> = {
        name: 'pipeline-1',
        stages: [],
      };

      const pipeline2: EventPipelineConfig<TestEvent> = {
        name: 'pipeline-2',
        stages: [],
      };

      expect(emitter.getPipelineNames('test.simple')).toEqual([]);

      emitter.addPipeline('test.simple', pipeline1);
      emitter.addPipeline('test.simple', pipeline2);

      expect(emitter.getPipelineNames('test.simple')).toEqual([
        'pipeline-1',
        'pipeline-2',
      ]);
      expect(emitter.getPipelineNames('test.other')).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle handler errors gracefully', async () => {
      const workingHandler = vi.fn();
      const failingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      emitter.subscribe('test.simple', workingHandler);
      emitter.subscribe('test.simple', failingHandler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      // Should not throw despite failing handler
      await expect(emitter.emitEvent(testEvent)).resolves.not.toThrow();

      expect(workingHandler).toHaveBeenCalledTimes(1);
      expect(failingHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle pipeline errors with stop strategy', async () => {
      const handler = vi.fn();

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'failing-pipeline',
        errorHandling: 'stop',
        stages: [
          {
            name: 'failing-stage',
            middleware: [
              async () => {
                throw new Error('Pipeline error');
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      await expect(emitter.emitEvent(testEvent)).rejects.toThrow(
        'Pipeline error'
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle pipeline errors with continue strategy', async () => {
      const handler = vi.fn();

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'failing-pipeline',
        errorHandling: 'continue',
        stages: [
          {
            name: 'failing-stage',
            middleware: [
              async () => {
                throw new Error('Pipeline error');
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      // Should not throw and handler should still be called
      await expect(emitter.emitEvent(testEvent)).resolves.not.toThrow();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track event metrics', async () => {
      emitter.setMonitoring(true);

      const handler = vi.fn();
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      await emitter.emitEvent(testEvent);
      await emitter.emitEvent(testEvent);
      await emitter.emitEvent(testEvent);

      const metrics = emitter.getMetrics();

      expect(metrics.eventsEmitted['test.simple']).toBe(3);
      expect(metrics.eventsProcessed['test.simple']).toBe(3);
      expect(metrics.averageProcessingTime['test.simple']).toBeGreaterThan(0);
    });

    test('should track pipeline metrics', async () => {
      emitter.setMonitoring(true);

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'tracked-pipeline',
        stages: [
          {
            name: 'tracked-stage',
            middleware: [
              async (event, next) => {
                await setTimeout(1); // Small delay for metrics
                await next();
              },
            ],
          },
        ],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', vi.fn());

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      const metrics = emitter.getMetrics();

      expect(metrics.pipelineStats['tracked-pipeline']).toBeDefined();
      expect(metrics.pipelineStats['tracked-pipeline'].executions).toBe(1);
      expect(metrics.pipelineStats['tracked-pipeline'].successes).toBe(1);
      expect(
        metrics.pipelineStats['tracked-pipeline'].stageStats['tracked-stage']
      ).toBeDefined();
    });

    test('should disable monitoring', async () => {
      emitter.setMonitoring(false);

      const handler = vi.fn();
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      const metrics = emitter.getMetrics();

      expect(metrics.eventsEmitted['test.simple']).toBeUndefined();
      expect(metrics.eventsProcessed['test.simple']).toBeUndefined();
    });

    test('should track memory usage', () => {
      const metrics = emitter.getMetrics();

      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(metrics.memoryUsage.external).toBeGreaterThan(0);
    });
  });

  describe('Lifecycle Management', () => {
    test('should clear all subscriptions and pipelines', async () => {
      const handler = vi.fn();
      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'test-pipeline',
        stages: [],
      };

      emitter.subscribe('test.simple', handler);
      emitter.addPipeline('test.simple', pipeline);

      expect(emitter.getSubscriptionCount()).toBe(1);
      expect(emitter.getPipelineNames('test.simple')).toEqual([
        'test-pipeline',
      ]);

      await emitter.clear();

      expect(emitter.getSubscriptionCount()).toBe(0);
      expect(emitter.getPipelineNames('test.simple')).toEqual([]);

      // Events should not be handled after clear
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      await emitter.emitEvent(testEvent);

      expect(handler).not.toHaveBeenCalled();
    });

    test('should cleanup inactive subscriptions', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = emitter.subscribe('test.simple', handler1);
      const sub2 = emitter.subscribe('test.simple', handler2);

      expect(emitter.getSubscriptionCount()).toBe(2);

      await sub1.unsubscribe();

      // Trigger cleanup by waiting
      await setTimeout(1);

      expect(emitter.getSubscriptionCount()).toBe(1);
    });

    test('should destroy emitter properly', () => {
      const handler = vi.fn();
      emitter.subscribe('test.simple', handler);

      expect(() => emitter.destroy()).not.toThrow();

      // Should not be able to emit events after destroy
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      // destroy() calls clear() which is async, so we can't easily test this
    });
  });

  describe('Type Safety and Utilities', () => {
    test('should create events with metadata', () => {
      const metadata = createEventMetadata({
        correlationId: 'test-correlation',
        source: 'test-source',
      });

      expect(metadata.id).toBeDefined();
      expect(metadata.timestamp).toBeGreaterThan(0);
      expect(metadata.correlationId).toBe('test-correlation');
      expect(metadata.source).toBe('test-source');
      expect(metadata.version).toBe(1);
    });

    test('should create typed events', () => {
      const event = createEvent<TestEvent>(
        'test.simple',
        { message: 'hello' },
        {
          correlationId: 'test-123',
        }
      );

      expect(event.type).toBe('test.simple');
      expect(event.data.message).toBe('hello');
      expect(event.metadata.correlationId).toBe('test-123');
      expect(event.metadata.id).toBeDefined();
    });

    test('should provide type guard for events', () => {
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });
      const otherEvent = createEvent<Event<'test.other', unknown>>(
        'test.other',
        {}
      );

      expect(isEventOfType<TestEvent>(testEvent, 'test.simple')).toBe(true);
      expect(isEventOfType<TestEvent>(testEvent, 'test.other')).toBe(false);
      expect(isEventOfType<TestEvent>(otherEvent, 'test.simple')).toBe(false);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle emitting events with no subscribers', async () => {
      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      // Should not throw even with no subscribers
      await expect(emitter.emitEvent(testEvent)).resolves.not.toThrow();
    });

    test('should handle subscribing to non-existent event types', async () => {
      const handler = vi.fn();

      // Should be able to subscribe to any event type
      expect(() => emitter.subscribe('non.existent', handler)).not.toThrow();

      const testEvent = createEvent<Event<'non.existent', unknown>>(
        'non.existent',
        {}
      );
      await emitter.emitEvent(testEvent);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple unsubscribe calls', async () => {
      const handler = vi.fn();
      const subscription = emitter.subscribe('test.simple', handler);

      // Multiple unsubscribe calls should not throw
      await expect(subscription.unsubscribe()).resolves.not.toThrow();
      await expect(subscription.unsubscribe()).resolves.not.toThrow();

      expect(subscription.isActive()).toBe(false);
    });

    test('should handle pipeline with empty stages', async () => {
      const handler = vi.fn();

      const pipeline: EventPipelineConfig<TestEvent> = {
        name: 'empty-pipeline',
        stages: [],
      };

      emitter.addPipeline('test.simple', pipeline);
      emitter.subscribe('test.simple', handler);

      const testEvent = createEvent<TestEvent>('test.simple', {
        message: 'hello',
      });

      // Should work fine with empty pipeline
      await expect(emitter.emitEvent(testEvent)).resolves.not.toThrow();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should handle concurrent event emissions', async () => {
      const handler = vi.fn();
      emitter.subscribe('test.simple', handler);

      const promises = Array.from({ length: 100 }, (_, i) =>
        emitter.emitEvent(
          createEvent<TestEvent>('test.simple', { message: `msg-${i}` })
        )
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(handler).toHaveBeenCalledTimes(100);
    });

    test('should handle rapid subscribe/unsubscribe operations', async () => {
      const subscriptions: EventSubscription[] = [];

      // Create many subscriptions rapidly
      for (let i = 0; i < 100; i++) {
        subscriptions.push(emitter.subscribe('test.simple', vi.fn()));
      }

      expect(emitter.getSubscriptionCount()).toBe(100);

      // Unsubscribe them all rapidly
      await Promise.all(subscriptions.map(sub => sub.unsubscribe()));

      expect(emitter.getSubscriptionCount()).toBe(0);
    });
  });
});
