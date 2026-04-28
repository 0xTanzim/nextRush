/**
 * @nextrush/events - Comprehensive Test Suite
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEvents, EventEmitter, eventsPlugin, MAX_EVENT_NAME_LENGTH, VALID_PROPERTY_NAME } from '../index';

// Test events interface - use [key: string] for EventMap compatibility
type TestEvents = {
  'user:created': { id: string; name: string };
  'user:updated': { id: string; changes: Record<string, unknown> };
  'user:deleted': { id: string };
  'order:placed': { orderId: string; total: number };
  simple: string;
  nodata: undefined;
  [key: string]: unknown;
};

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new EventEmitter<TestEvents>();
  });

  describe('on() - Basic Subscription', () => {
    it('should subscribe to events', async () => {
      const handler = vi.fn();
      emitter.on('user:created', handler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
    });

    it('should support multiple handlers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('user:created', handler1);
      emitter.on('user:created', handler2);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should call handlers in order of registration', async () => {
      const order: number[] = [];

      emitter.on('user:created', () => { order.push(1); });
      emitter.on('user:created', () => { order.push(2); });
      emitter.on('user:created', () => { order.push(3); });

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(order).toEqual([1, 2, 3]);
    });

    it('should return unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on('user:created', handler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });
      expect(handler).toHaveBeenCalledOnce();

      unsubscribe();

      await emitter.emit('user:created', { id: '2', name: 'Bob' });
      expect(handler).toHaveBeenCalledOnce(); // Still 1
    });
  });

  describe('once() - One-time Subscription', () => {
    it('should only call handler once', async () => {
      const handler = vi.fn();
      emitter.once('user:created', handler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });
      await emitter.emit('user:created', { id: '2', name: 'Bob' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
    });

    it('should return unsubscribe function that works before emit', async () => {
      const handler = vi.fn();
      const unsubscribe = emitter.once('user:created', handler);

      unsubscribe();

      await emitter.emit('user:created', { id: '1', name: 'Alice' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove once handler from listener count after emit', async () => {
      emitter.once('user:created', vi.fn());

      expect(emitter.listenerCount('user:created')).toBe(1);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(emitter.listenerCount('user:created')).toBe(0);
    });
  });

  describe('off() - Unsubscription', () => {
    it('should remove specific handler', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('user:created', handler1);
      emitter.on('user:created', handler2);
      emitter.off('user:created', handler1);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should handle removing non-existent handler gracefully', () => {
      const handler = vi.fn();
      expect(() => emitter.off('user:created', handler)).not.toThrow();
    });

    it('should handle removing from non-existent event gracefully', () => {
      const handler = vi.fn();
      expect(() => emitter.off('user:created', handler)).not.toThrow();
    });

    it('should clean up empty handler sets', async () => {
      const handler = vi.fn();
      emitter.on('user:created', handler);
      emitter.off('user:created', handler);

      expect(emitter.eventNames()).not.toContain('user:created');
    });
  });

  describe('emit() - Event Emission', () => {
    it('should handle emitting with no handlers', async () => {
      await expect(
        emitter.emit('user:created', { id: '1', name: 'Alice' })
      ).resolves.not.toThrow();
    });

    it('should support async handlers', async () => {
      const results: number[] = [];

      emitter.on('user:created', async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(1);
      });
      emitter.on('user:created', async () => {
        results.push(2);
      });

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it('should wait for all handlers to complete', async () => {
      let completed = false;

      emitter.on('user:created', async () => {
        await new Promise((r) => setTimeout(r, 20));
        completed = true;
      });

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(completed).toBe(true);
    });
  });

  describe('Error Isolation', () => {
    it('should isolate errors by default', async () => {
      const successHandler = vi.fn();

      emitter.on('user:created', () => {
        throw new Error('Handler error');
      });
      emitter.on('user:created', successHandler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(successHandler).toHaveBeenCalledOnce();
    });

    it('should call onError callback for isolated errors', async () => {
      const onError = vi.fn();
      const errorEmitter = new EventEmitter<TestEvents>({ onError });

      errorEmitter.on('user:created', () => {
        throw new Error('Test error');
      });

      await errorEmitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        'user:created'
      );
    });

    it('should throw AggregateError when errorIsolation is false', async () => {
      const strictEmitter = new EventEmitter<TestEvents>({
        errorIsolation: false,
      });

      const handler = vi.fn(() => {
        throw new Error('Handler error');
      });

      strictEmitter.on('user:created', handler);

      // When errorIsolation is false, errors are collected and thrown as AggregateError
      await expect(
        strictEmitter.emit('user:created', { id: '1', name: 'Alice' })
      ).rejects.toBeInstanceOf(AggregateError);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle errors in onError callback', async () => {
      const errorEmitter = new EventEmitter<TestEvents>({
        onError: () => {
          throw new Error('Error in error handler');
        },
      });

      errorEmitter.on('user:created', () => {
        throw new Error('Original error');
      });

      // Should not throw - error in onError is swallowed
      await expect(
        errorEmitter.emit('user:created', { id: '1', name: 'Alice' })
      ).resolves.not.toThrow();
    });
  });

  describe('Wildcard Events', () => {
    it('should support * wildcard for all events', async () => {
      const wildcardHandler = vi.fn();
      emitter.on('*' as string, wildcardHandler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });
      await emitter.emit('order:placed', { orderId: '1', total: 100 });

      expect(wildcardHandler).toHaveBeenCalledTimes(2);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, {
        event: 'user:created',
        data: { id: '1', name: 'Alice' },
      });
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, {
        event: 'order:placed',
        data: { orderId: '1', total: 100 },
      });
    });

    it('should support prefix:* pattern matching', async () => {
      const userHandler = vi.fn();
      emitter.on('user:*' as string, userHandler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });
      await emitter.emit('user:deleted', { id: '1' });
      await emitter.emit('order:placed', { orderId: '1', total: 100 });

      expect(userHandler).toHaveBeenCalledTimes(2);
    });

    it('should pass event name and data to pattern handlers', async () => {
      const handler = vi.fn();
      emitter.on('user:*' as string, handler);

      await emitter.emit('user:created', { id: '1', name: 'Alice' });

      expect(handler).toHaveBeenCalledWith({
        event: 'user:created',
        data: { id: '1', name: 'Alice' },
      });
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 for no listeners', () => {
      expect(emitter.listenerCount('user:created')).toBe(0);
    });

    it('should return correct count for specific event', () => {
      emitter.on('user:created', vi.fn());
      emitter.on('user:created', vi.fn());
      emitter.on('user:deleted', vi.fn());

      expect(emitter.listenerCount('user:created')).toBe(2);
      expect(emitter.listenerCount('user:deleted')).toBe(1);
    });

    it('should return total count when no event specified', () => {
      emitter.on('user:created', vi.fn());
      emitter.on('user:created', vi.fn());
      emitter.on('user:deleted', vi.fn());

      expect(emitter.listenerCount()).toBe(3);
    });
  });

  describe('clear()', () => {
    it('should remove all listeners for specific event', () => {
      emitter.on('user:created', vi.fn());
      emitter.on('user:created', vi.fn());
      emitter.on('user:deleted', vi.fn());

      emitter.clear('user:created');

      expect(emitter.listenerCount('user:created')).toBe(0);
      expect(emitter.listenerCount('user:deleted')).toBe(1);
    });

    it('should remove all listeners when no event specified', () => {
      emitter.on('user:created', vi.fn());
      emitter.on('user:deleted', vi.fn());
      emitter.on('order:placed', vi.fn());

      emitter.clear();

      expect(emitter.listenerCount()).toBe(0);
    });
  });

  describe('eventNames()', () => {
    it('should return empty array when no events', () => {
      expect(emitter.eventNames()).toEqual([]);
    });

    it('should return all registered event names', () => {
      emitter.on('user:created', vi.fn());
      emitter.on('user:deleted', vi.fn());

      const names = emitter.eventNames();

      expect(names).toContain('user:created');
      expect(names).toContain('user:deleted');
      expect(names).toHaveLength(2);
    });
  });

  describe('Memory Leak Warning', () => {
    it('should warn when exceeding maxListeners', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const limitedEmitter = new EventEmitter<TestEvents>({ maxListeners: 2 });

      limitedEmitter.on('user:created', vi.fn());
      limitedEmitter.on('user:created', vi.fn());
      limitedEmitter.on('user:created', vi.fn()); // Third one

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('3 listeners')
      );

      warnSpy.mockRestore();
    });

    it('should not warn when maxListeners is 0 (disabled)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unlimitedEmitter = new EventEmitter<TestEvents>({ maxListeners: 0 });

      for (let i = 0; i < 100; i++) {
        unlimitedEmitter.on('user:created', vi.fn());
      }

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});

describe('createEvents()', () => {
  it('should create a new EventEmitter instance', () => {
    const events = createEvents<TestEvents>();
    expect(events).toBeInstanceOf(EventEmitter);
  });

  it('should pass options to EventEmitter', () => {
    const onError = vi.fn();
    const events = createEvents<TestEvents>({ onError, maxListeners: 5 });

    events.on('user:created', () => {
      throw new Error('test');
    });
    events.emit('user:created', { id: '1', name: 'Alice' });

    expect(onError).toHaveBeenCalled();
  });
});

describe('eventsPlugin()', () => {
  it('should create plugin with correct metadata', () => {
    const plugin = eventsPlugin();

    expect(plugin.name).toBe('@nextrush/events');
    expect(plugin.version).toBe('3.0.4');
    expect(typeof plugin.install).toBe('function');
    expect(plugin.events).toBeInstanceOf(EventEmitter);
  });

  it('should install events on app object', () => {
    const plugin = eventsPlugin();
    const app: Record<string, unknown> = {};

    plugin.install(app);

    expect(app['events']).toBe(plugin.events);
  });

  it('should use custom property name', () => {
    const plugin = eventsPlugin({ propertyName: 'bus' });
    const app: Record<string, unknown> = {};

    plugin.install(app);

    expect(app['bus']).toBe(plugin.events);
    expect(app['events']).toBeUndefined();
  });

  it('should pass emitter options', async () => {
    const onError = vi.fn();
    const plugin = eventsPlugin<TestEvents>({ onError });

    plugin.events.on('user:created', () => {
      throw new Error('test');
    });
    await plugin.events.emit('user:created', { id: '1', name: 'Alice' });

    expect(onError).toHaveBeenCalled();
  });

  it('should make events property non-writable', () => {
    const plugin = eventsPlugin();
    const app: Record<string, unknown> = {};

    plugin.install(app);

    expect(() => {
      app['events'] = 'something else';
    }).toThrow();
  });

  it('should handle null/undefined app gracefully', () => {
    const plugin = eventsPlugin();

    expect(() => plugin.install(null)).not.toThrow();
    expect(() => plugin.install(undefined)).not.toThrow();
  });

  it('should clean up on destroy', () => {
    const plugin = eventsPlugin<TestEvents>();
    const handler = vi.fn();

    plugin.events.on('user:created', handler);
    expect(plugin.events.listenerCount()).toBe(1);

    plugin.destroy?.();
    expect(plugin.events.listenerCount()).toBe(0);
  });

  it('should allow app.events direct access pattern', async () => {
    const plugin = eventsPlugin<TestEvents>();

    // Simulate app with plugin method
    const app: { events?: typeof plugin.events } = {};
    plugin.install(app);

    const handler = vi.fn();
    app.events!.on('user:created', handler);
    await app.events!.emit('user:created', { id: '1', name: 'Alice' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });
});

describe('Edge Cases', () => {
  it('should handle rapid subscribe/unsubscribe', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    for (let i = 0; i < 100; i++) {
      const unsub = emitter.on('user:created', handler);
      unsub();
    }

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    expect(handler).not.toHaveBeenCalled();
    expect(emitter.listenerCount()).toBe(0);
  });

  it('should handle concurrent emits', async () => {
    const emitter = createEvents<TestEvents>();
    const results: string[] = [];

    emitter.on('user:created', async (data) => {
      await new Promise((r) => setTimeout(r, 10));
      results.push(data.id);
    });

    await Promise.all([
      emitter.emit('user:created', { id: '1', name: 'One' }),
      emitter.emit('user:created', { id: '2', name: 'Two' }),
      emitter.emit('user:created', { id: '3', name: 'Three' }),
    ]);

    expect(results).toHaveLength(3);
    expect(results).toContain('1');
    expect(results).toContain('2');
    expect(results).toContain('3');
  });

  it('should handle unsubscribe during emit', async () => {
    const emitter = createEvents<TestEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    let unsubscribe2: () => void;

    emitter.on('user:created', () => {
      handler1();
      unsubscribe2(); // Unsubscribe handler2 during execution
    });
    unsubscribe2 = emitter.on('user:created', handler2);

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    // handler1 should be called
    expect(handler1).toHaveBeenCalledOnce();

    // Note: handler2 may or may not be called depending on iteration order
    // The important thing is no crash occurs
  });

  it('should handle different data types', async () => {
    const genericEmitter = createEvents<{
      string: string;
      number: number;
      boolean: boolean;
      object: { nested: { deep: boolean } };
      array: number[];
      null: null;
      undefined: undefined;
    }>();

    const results: unknown[] = [];

    genericEmitter.on('string', (d) => { results.push(d); });
    genericEmitter.on('number', (d) => { results.push(d); });
    genericEmitter.on('boolean', (d) => { results.push(d); });
    genericEmitter.on('object', (d) => { results.push(d); });
    genericEmitter.on('array', (d) => { results.push(d); });
    genericEmitter.on('null', (d) => { results.push(d); });
    genericEmitter.on('undefined', (d) => { results.push(d); });

    await genericEmitter.emit('string', 'hello');
    await genericEmitter.emit('number', 42);
    await genericEmitter.emit('boolean', true);
    await genericEmitter.emit('object', { nested: { deep: true } });
    await genericEmitter.emit('array', [1, 2, 3]);
    await genericEmitter.emit('null', null);
    await genericEmitter.emit('undefined', undefined);

    expect(results).toEqual([
      'hello',
      42,
      true,
      { nested: { deep: true } },
      [1, 2, 3],
      null,
      undefined,
    ]);
  });
});

// ============================================================================
// NEW TESTS: Event Name Validation
// ============================================================================

describe('Event Name Validation', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new EventEmitter<TestEvents>();
  });

  it('should reject empty event name', () => {
    expect(() => emitter.on('' as string, vi.fn())).toThrow(TypeError);
    expect(() => emitter.on('' as string, vi.fn())).toThrow('non-empty string');
  });

  it('should reject non-string event name', () => {
    expect(() => emitter.on(123 as unknown as string, vi.fn())).toThrow(TypeError);
    expect(() => emitter.on(null as unknown as string, vi.fn())).toThrow(TypeError);
    expect(() => emitter.on(undefined as unknown as string, vi.fn())).toThrow(TypeError);
  });

  it('should reject event name exceeding max length', () => {
    const longName = 'a'.repeat(MAX_EVENT_NAME_LENGTH + 1);
    expect(() => emitter.on(longName, vi.fn())).toThrow(RangeError);
    expect(() => emitter.on(longName, vi.fn())).toThrow(`${MAX_EVENT_NAME_LENGTH}`);
  });

  it('should accept event name at max length', () => {
    const maxName = 'a'.repeat(MAX_EVENT_NAME_LENGTH);
    expect(() => emitter.on(maxName, vi.fn())).not.toThrow();
  });

  it('should handle special characters in event names', async () => {
    const handler = vi.fn();
    emitter.on('user:created:v2' as string, handler);
    emitter.on('user.created' as string, handler);
    emitter.on('user-created' as string, handler);
    emitter.on('user_created' as string, handler);

    await emitter.emit('user:created:v2' as string, { id: '1', name: 'test' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// NEW TESTS: New Methods (listeners, hasListeners, setMaxListeners, prepend)
// ============================================================================

describe('listeners() Method', () => {
  it('should return empty array for non-existent event', () => {
    const emitter = createEvents<TestEvents>();
    expect(emitter.listeners('user:created')).toEqual([]);
  });

  it('should return array of handlers', () => {
    const emitter = createEvents<TestEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('user:created', handler1);
    emitter.on('user:created', handler2);

    const listeners = emitter.listeners('user:created');
    expect(listeners).toHaveLength(2);
    expect(listeners).toContain(handler1);
    expect(listeners).toContain(handler2);
  });

  it('should return a copy, not the internal array', () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();
    emitter.on('user:created', handler);

    const listeners = emitter.listeners('user:created');
    listeners.pop(); // Modify the returned array

    expect(emitter.listenerCount('user:created')).toBe(1);
  });
});

describe('hasListeners() Method', () => {
  it('should return false when no listeners', () => {
    const emitter = createEvents<TestEvents>();
    expect(emitter.hasListeners()).toBe(false);
    expect(emitter.hasListeners('user:created')).toBe(false);
  });

  it('should return true when listeners exist', () => {
    const emitter = createEvents<TestEvents>();
    emitter.on('user:created', vi.fn());

    expect(emitter.hasListeners()).toBe(true);
    expect(emitter.hasListeners('user:created')).toBe(true);
    expect(emitter.hasListeners('user:deleted')).toBe(false);
  });
});

describe('setMaxListeners() / getMaxListeners()', () => {
  it('should get default maxListeners', () => {
    const emitter = createEvents<TestEvents>();
    expect(emitter.getMaxListeners()).toBe(10);
  });

  it('should set maxListeners', () => {
    const emitter = createEvents<TestEvents>();
    emitter.setMaxListeners(50);
    expect(emitter.getMaxListeners()).toBe(50);
  });

  it('should return this for chaining', () => {
    const emitter = createEvents<TestEvents>();
    const result = emitter.setMaxListeners(20);
    expect(result).toBe(emitter);
  });

  it('should allow 0 to disable warnings', () => {
    const emitter = createEvents<TestEvents>();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    emitter.setMaxListeners(0);
    for (let i = 0; i < 100; i++) {
      emitter.on('user:created', vi.fn());
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should reject negative values', () => {
    const emitter = createEvents<TestEvents>();
    expect(() => emitter.setMaxListeners(-1)).toThrow(RangeError);
  });

  it('should reject non-integer values', () => {
    const emitter = createEvents<TestEvents>();
    expect(() => emitter.setMaxListeners(1.5)).toThrow(RangeError);
    expect(() => emitter.setMaxListeners(NaN)).toThrow(RangeError);
  });
});

describe('prepend() / prependOnce()', () => {
  it('should add handler at the front', async () => {
    const emitter = createEvents<TestEvents>();
    const order: number[] = [];

    emitter.on('user:created', () => { order.push(1); });
    emitter.on('user:created', () => { order.push(2); });
    emitter.prepend('user:created', () => { order.push(0); });

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    expect(order).toEqual([0, 1, 2]);
  });

  it('prependOnce should only call once', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.prependOnce('user:created', handler);

    await emitter.emit('user:created', { id: '1', name: 'Alice' });
    await emitter.emit('user:created', { id: '2', name: 'Bob' });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('prependOnce should be at front', async () => {
    const emitter = createEvents<TestEvents>();
    const order: number[] = [];

    emitter.on('user:created', () => { order.push(1); });
    emitter.prependOnce('user:created', () => { order.push(0); });

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    expect(order).toEqual([0, 1]);
  });
});

// ============================================================================
// NEW TESTS: AggregateError for errorIsolation=false
// ============================================================================

describe('AggregateError with errorIsolation=false', () => {
  it('should throw AggregateError when handlers fail', async () => {
    const emitter = new EventEmitter<TestEvents>({ errorIsolation: false });

    emitter.on('user:created', () => { throw new Error('Error 1'); });
    emitter.on('user:created', () => { throw new Error('Error 2'); });

    await expect(emitter.emit('user:created', { id: '1', name: 'Alice' }))
      .rejects.toBeInstanceOf(AggregateError);
  });

  it('should collect all errors in AggregateError', async () => {
    const emitter = new EventEmitter<TestEvents>({ errorIsolation: false });

    emitter.on('user:created', () => { throw new Error('Error 1'); });
    emitter.on('user:created', () => { throw new Error('Error 2'); });

    try {
      await emitter.emit('user:created', { id: '1', name: 'Alice' });
    } catch (e) {
      expect(e).toBeInstanceOf(AggregateError);
      const aggError = e as AggregateError;
      expect(aggError.errors).toHaveLength(2);
      expect(aggError.message).toContain('2 handler(s) failed');
    }
  });

  it('should not throw if no errors', async () => {
    const emitter = new EventEmitter<TestEvents>({ errorIsolation: false });

    emitter.on('user:created', vi.fn());

    await expect(emitter.emit('user:created', { id: '1', name: 'Alice' }))
      .resolves.not.toThrow();
  });
});

// ============================================================================
// NEW TESTS: Race Condition Prevention for once()
// ============================================================================

describe('Once Handler Race Condition Prevention', () => {
  it('should only call once handler once even with concurrent emits', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.once('user:created', handler);

    // Fire multiple emits concurrently
    await Promise.all([
      emitter.emit('user:created', { id: '1', name: 'One' }),
      emitter.emit('user:created', { id: '2', name: 'Two' }),
      emitter.emit('user:created', { id: '3', name: 'Three' }),
    ]);

    // Handler should only be called once
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should remove once handler immediately before execution', async () => {
    const emitter = createEvents<TestEvents>();
    const calls: string[] = [];

    emitter.once('user:created', async (data) => {
      await new Promise(r => setTimeout(r, 50));
      calls.push(data.id);
    });

    // Start first emit (slow handler)
    const emit1 = emitter.emit('user:created', { id: '1', name: 'One' });

    // Immediately start second emit
    const emit2 = emitter.emit('user:created', { id: '2', name: 'Two' });

    await Promise.all([emit1, emit2]);

    // Only first emit should have called the handler
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('1');
  });
});

// ============================================================================
// NEW TESTS: Plugin Property Name Validation
// ============================================================================

describe('Plugin Property Name Validation', () => {
  it('should accept valid property names', () => {
    expect(() => eventsPlugin({ propertyName: 'events' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: 'myEvents' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: '_events' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: '$events' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: 'events123' })).not.toThrow();
  });

  it('should reject invalid property names', () => {
    expect(() => eventsPlugin({ propertyName: '123events' })).toThrow(TypeError);
    expect(() => eventsPlugin({ propertyName: 'my-events' })).toThrow(TypeError);
    expect(() => eventsPlugin({ propertyName: 'my events' })).toThrow(TypeError);
    expect(() => eventsPlugin({ propertyName: '' })).toThrow(TypeError);
  });

  it('should accept JavaScript reserved words as valid identifiers', () => {
    // These are all valid JS identifiers (can be used as property names)
    expect(() => eventsPlugin({ propertyName: 'constructor' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: '__proto__' })).not.toThrow();
    expect(() => eventsPlugin({ propertyName: 'prototype' })).not.toThrow();
  });
});

// ============================================================================
// NEW TESTS: Edge Cases and Security
// ============================================================================

describe('Security and Edge Cases', () => {
  it('should handle prototype pollution attempts safely', async () => {
    const emitter = createEvents<TestEvents>();

    // These should work as normal event names (they're valid strings)
    emitter.on('constructor' as string, vi.fn());
    emitter.on('toString' as string, vi.fn());

    // The emitter's prototype should not be affected
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.emit).toBe('function');
  });

  it('should handle circular event emission', async () => {
    const emitter = createEvents<TestEvents>();
    let count = 0;
    const maxCalls = 5;

    emitter.on('user:created', async () => {
      count++;
      if (count < maxCalls) {
        await emitter.emit('user:created', { id: String(count), name: 'Loop' });
      }
    });

    await emitter.emit('user:created', { id: '0', name: 'Start' });

    expect(count).toBe(maxCalls);
  });

  it('should handle handler that throws non-Error object', async () => {
    const emitter = createEvents<TestEvents>();
    const onError = vi.fn();
    const emitterWithHandler = new EventEmitter<TestEvents>({ onError });

    emitterWithHandler.on('user:created', () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });
    emitterWithHandler.on('user:created', () => {
      throw { message: 'object error' }; // eslint-disable-line no-throw-literal
    });
    emitterWithHandler.on('user:created', () => {
      throw 42; // eslint-disable-line no-throw-literal
    });

    await emitterWithHandler.emit('user:created', { id: '1', name: 'Alice' });

    expect(onError).toHaveBeenCalledTimes(3);
    // All errors should be wrapped as Error instances
    for (const call of onError.mock.calls) {
      expect(call[0]).toBeInstanceOf(Error);
    }
  });

  it('should handle destroy() being called multiple times', () => {
    const plugin = eventsPlugin<TestEvents>();
    plugin.events.on('user:created', vi.fn());

    expect(() => {
      plugin.destroy?.();
      plugin.destroy?.();
      plugin.destroy?.();
    }).not.toThrow();

    expect(plugin.events.listenerCount()).toBe(0);
  });

  it('should work correctly after clear()', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.on('user:created', handler);
    emitter.clear();

    // Should be able to add handlers again
    emitter.on('user:created', handler);
    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should handle adding handler during emit', async () => {
    const emitter = createEvents<TestEvents>();
    const laterHandler = vi.fn();

    emitter.on('user:created', () => {
      // Add handler during emit
      emitter.on('user:created', laterHandler);
    });

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    // The later handler should NOT be called during this emit
    // because we take a snapshot before iterating
    expect(laterHandler).not.toHaveBeenCalled();

    // But should be called on next emit
    await emitter.emit('user:created', { id: '2', name: 'Bob' });
    expect(laterHandler).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// NEW TESTS: Pattern Matching Edge Cases
// ============================================================================

describe('Pattern Matching Edge Cases', () => {
  it('should not match partial patterns without :*', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.on('user' as string, handler);

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    // 'user' should NOT match 'user:created' without :*
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple colons in event name', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.on('app:user:*' as string, handler);

    await emitter.emit('app:user:created' as string, { id: '1', name: 'Alice' });
    await emitter.emit('app:user:deleted' as string, { id: '1' });
    await emitter.emit('app:order:placed' as string, { orderId: '1', total: 100 });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should handle empty prefix with :*', async () => {
    const emitter = createEvents<TestEvents>();
    const handler = vi.fn();

    emitter.on(':*' as string, handler);

    await emitter.emit(':test' as string, 'data');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not double-call for exact match and pattern', async () => {
    const emitter = createEvents<TestEvents>();
    const exactHandler = vi.fn();
    const patternHandler = vi.fn();

    emitter.on('user:created', exactHandler);
    emitter.on('user:*' as string, patternHandler);

    await emitter.emit('user:created', { id: '1', name: 'Alice' });

    expect(exactHandler).toHaveBeenCalledOnce();
    expect(patternHandler).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// NEW TESTS: Constants Export
// ============================================================================

describe('Constants Export', () => {
  it('should export MAX_EVENT_NAME_LENGTH', () => {
    expect(MAX_EVENT_NAME_LENGTH).toBe(256);
  });

  it('should export VALID_PROPERTY_NAME regex', () => {
    expect(VALID_PROPERTY_NAME).toBeInstanceOf(RegExp);
    expect(VALID_PROPERTY_NAME.test('validName')).toBe(true);
    expect(VALID_PROPERTY_NAME.test('123invalid')).toBe(false);
  });
});
