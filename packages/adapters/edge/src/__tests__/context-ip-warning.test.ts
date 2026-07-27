/**
 * @nextrush/adapter-edge - ctx.ip empty-string dev-mode warning (P2-3).
 *
 * When `proxy` is `false` (default), `ctx.ip` is `''` on Edge (no
 * socket to fall back to). Outside production, the first *read* of `ctx.ip`
 * in that state warns once per context — a silent empty string is otherwise
 * indistinguishable from "IP resolution succeeded and it's empty."
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeContext } from '../context';

function mockRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/', { headers });
}

describe('EdgeContext ctx.ip dev-mode warning (P2-3)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once, in development, on the first read of ctx.ip when proxy is false', () => {
    const ctx = new EdgeContext(mockRequest(), undefined, false, undefined, false);

    expect(ctx.ip).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('[nextrush/edge]');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('ctx.ip');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('proxy');

    // Reading it again on the same context does not warn a second time.
    expect(ctx.ip).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not warn in production, even though ctx.ip is still empty', () => {
    const ctx = new EdgeContext(mockRequest(), undefined, false, undefined, true);

    expect(ctx.ip).toBe('');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when proxy is a hop count, even in development', () => {
    const ctx = new EdgeContext(
      mockRequest({ 'cf-connecting-ip': '1.2.3.4' }),
      undefined,
      1,
      undefined,
      false
    );

    expect(ctx.ip).toBe('1.2.3.4');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('4.3: rejects a peer-CIDR list at construction — Edge has no peer address to validate against', () => {
    expect(() => new EdgeContext(mockRequest(), undefined, ['10.0.0.0/8'])).toThrow(
      /no socket peer address/
    );
  });
});
