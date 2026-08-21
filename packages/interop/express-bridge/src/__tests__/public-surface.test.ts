/**
 * @nextrush/express-bridge — public surface lock
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import * as bridgeApi from '../index';
import {
  ExpressBridgeArityError,
  ExpressBridgeCapabilityError,
  ExpressBridgeProtocolError,
  UnsupportedExpressApiError,
  compat,
} from '../index';
import type { ExpressMiddleware, ExpressNext } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(bridgeApi).filter((k) => k !== 'default').sort();
    expect(actualExports).toEqual(
      [
        'compat',
        'ExpressBridgeArityError',
        'ExpressBridgeCapabilityError',
        'ExpressBridgeProtocolError',
        'UnsupportedExpressApiError',
      ].sort()
    );
  });

  it('exports the compat function and error classes', () => {
    expect(typeof compat).toBe('function');
    expect(typeof ExpressBridgeArityError).toBe('function');
    expect(typeof ExpressBridgeCapabilityError).toBe('function');
    expect(typeof ExpressBridgeProtocolError).toBe('function');
    expect(typeof UnsupportedExpressApiError).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    type Surface = [ExpressMiddleware, ExpressNext];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
