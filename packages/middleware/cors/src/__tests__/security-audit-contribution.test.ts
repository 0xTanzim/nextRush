/**
 * @nextrush/cors - Boot-time security audit contribution (task 8.1/8.2)
 *
 * `cors()` tags its returned middleware with a {@link SECURITY_AUDIT} check so
 * `Application.ready()` can throw, in production, on `origin: true` combined
 * with `credentials: true` — the reflected-origin-plus-credentials
 * misconfiguration this package's own `securityWarning()` could previously
 * only log (silenced in production, where it matters most). This test
 * exercises the contribution directly, without needing a running `Application`.
 */
import { describe, expect, it } from 'vitest';
import { SECURITY_AUDIT, type SecurityAuditCheck } from '@nextrush/types';
import { cors } from '../middleware';

function auditOf(mw: unknown): SecurityAuditCheck {
  const check = (mw as Record<typeof SECURITY_AUDIT, SecurityAuditCheck>)[SECURITY_AUDIT];
  expect(typeof check).toBe('function');
  return check;
}

describe('cors() — security-boundaries boot audit contribution', () => {
  it('reports a throw-level verdict for origin: true + credentials: true', () => {
    const mw = cors({ origin: true, credentials: true });
    const verdict = auditOf(mw)();

    expect(verdict.level).toBe('throw');
    expect(verdict).toMatchObject({ message: expect.stringContaining('credentials') });
  });

  it('reports ok for credentials without reflected origin', () => {
    const mw = cors({ origin: 'https://example.com', credentials: true });
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });

  it('reports ok for reflected origin without credentials', () => {
    const mw = cors({ origin: true });
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });

  it('reports ok for default options', () => {
    const mw = cors();
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });
});
