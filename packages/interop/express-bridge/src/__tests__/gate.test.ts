/**
 * @nextrush/express-bridge — Node-shaped raw-HTTP gate tests
 */

import { describe, expect, it } from 'vitest';
import { assertNodeShapedRaw, isNodeShapedRaw } from '../gate';
import { ExpressBridgeCapabilityError } from '../errors';

describe('isNodeShapedRaw', () => {
  it('accepts a Node-shaped pair', () => {
    expect(
      isNodeShapedRaw({
        req: { on() {} },
        res: { setHeader() {}, end() {}, headersSent: false },
      })
    ).toBe(true);
  });

  it('refuses Web-shaped raw (res undefined)', () => {
    expect(isNodeShapedRaw({ req: new Request('http://x'), res: undefined })).toBe(false);
  });

  it('refuses a req without EventEmitter on', () => {
    expect(
      isNodeShapedRaw({ req: {}, res: { setHeader() {}, end() {}, headersSent: false } })
    ).toBe(false);
  });
});

describe('assertNodeShapedRaw', () => {
  it('does not throw for a Node-shaped pair', () => {
    expect(() =>
      assertNodeShapedRaw({ req: { on() {} }, res: { setHeader() {}, end() {}, headersSent: false } })
    ).not.toThrow();
  });

  it('throws ExpressBridgeCapabilityError for Web-shaped raw', () => {
    expect(() => assertNodeShapedRaw({ req: new Request('http://x'), res: undefined })).toThrow(
      ExpressBridgeCapabilityError
    );
  });
});
