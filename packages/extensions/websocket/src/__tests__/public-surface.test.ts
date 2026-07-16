/**
 * @nextrush/websocket - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as websocketApi from '../index';
import { DEFAULT_MAX_ROOMS_PER_CONNECTION, DEFAULT_WS_OPTIONS, MAX_ROOM_NAME_LENGTH, WS_READY_STATE_OPEN } from '../index';
import type { WebSocketOptions, WSConnection, WSHandler, WSMiddleware, WSRoute } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(websocketApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'createWebSocket',
      'DEFAULT_MAX_ROOMS_PER_CONNECTION',
      'DEFAULT_WS_OPTIONS',
      'MAX_ROOM_NAME_LENGTH',
      'WS_READY_STATE_OPEN',
      'Connection',
      'MaxRoomsExceededError',
      'RoomManager',
      'WebSocketServer',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DEFAULT_MAX_ROOMS_PER_CONNECTION).toBe('number');
    expect(typeof DEFAULT_WS_OPTIONS).toBe('object');
    expect(typeof MAX_ROOM_NAME_LENGTH).toBe('number');
    expect(typeof WS_READY_STATE_OPEN).toBe('number');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [WebSocketOptions, WSConnection, WSHandler, WSMiddleware, WSRoute];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
