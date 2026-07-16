/**
 * @nextrush/events - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as eventsApi from '../index';
import { DEFAULT_EMITTER_OPTIONS, MAX_EVENT_NAME_LENGTH, VALID_PROPERTY_NAME, VERSION } from '../index';
import type { EventEmitterOptions, EventHandler, EventMap, EventNames, EventsOptions, TypedEventEmitter, Unsubscribe, WithEvents } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(eventsApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'EventEmitter',
      'VERSION',
      'createEvents',
      'events',
      'DEFAULT_EMITTER_OPTIONS',
      'MAX_EVENT_NAME_LENGTH',
      'VALID_PROPERTY_NAME',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof VERSION).toBe('string');
    expect(typeof DEFAULT_EMITTER_OPTIONS).toBe('object');
    expect(typeof MAX_EVENT_NAME_LENGTH).toBe('number');
    expect(typeof VALID_PROPERTY_NAME.test).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [EventEmitterOptions, EventHandler<never>, EventMap, EventNames<EventMap>, TypedEventEmitter<EventMap>, Unsubscribe, EventsOptions, WithEvents];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
