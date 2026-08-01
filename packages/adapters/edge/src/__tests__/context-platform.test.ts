/**
 * @nextrush/adapter-edge - ctx.platform Tests (RFC-026 P1)
 */

import { resetRuntimeCache } from '@nextrush/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdgeContext } from '../context';

function createMockRequest(url = 'http://localhost/'): Request {
  return new Request(url);
}

describe('EdgeContext ctx.platform', () => {
  beforeEach(() => {
    resetRuntimeCache();
  });

  afterEach(() => {
    resetRuntimeCache();
  });

  it('defaults to undefined when no explicit platform is given and no named edge platform is detected', () => {
    const ctx = new EdgeContext(createMockRequest());

    expect(ctx.platform).toBeUndefined();
  });

  it('uses the explicitly-supplied platform over detection', () => {
    const ctx = new EdgeContext(createMockRequest(), undefined, false, undefined, true, 'lambda');

    expect(ctx.platform).toBe('lambda');
  });

  it('accepts each serverless PlatformId explicitly', () => {
    const gcf = new EdgeContext(createMockRequest(), undefined, false, undefined, true, 'gcf');
    const azure = new EdgeContext(createMockRequest(), undefined, false, undefined, true, 'azure');

    expect(gcf.platform).toBe('gcf');
    expect(azure.platform).toBe('azure');
  });
});
