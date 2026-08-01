/**
 * @nextrush/errors - Boot-time security audit contribution (task 8.1/8.2)
 *
 * `errorHandler()` tags its returned middleware with a {@link SECURITY_AUDIT}
 * check so `Application.ready()` warns, in production, when `includeStack:
 * true` was configured but `isProduction` was never wired to this instance —
 * the per-request guard (task 7.8) only fires when the caller explicitly
 * passes `isProduction: true`, so an app that forgets to thread it never
 * gets the per-request warning even in a real production deployment. The
 * boot audit catches exactly that omission.
 */
import { describe, expect, it } from 'vitest';
import { SECURITY_AUDIT, type SecurityAuditCheck } from '@nextrush/types';
import { errorHandler } from '../middleware';

function auditOf(mw: unknown): SecurityAuditCheck {
  const check = (mw as Record<typeof SECURITY_AUDIT, SecurityAuditCheck>)[SECURITY_AUDIT];
  expect(typeof check).toBe('function');
  return check;
}

describe('errorHandler() — security-boundaries boot audit contribution', () => {
  it('reports a warn-level verdict for includeStack: true with isProduction never wired', () => {
    const mw = errorHandler({ includeStack: true });
    const verdict = auditOf(mw)();

    expect(verdict.level).toBe('warn');
    expect(verdict).toMatchObject({ message: expect.stringContaining('includeStack') });
  });

  it('reports ok when includeStack: true is paired with an explicit isProduction', () => {
    const mw = errorHandler({ includeStack: true, isProduction: true });
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });

  it('reports ok for the default options (includeStack: false)', () => {
    const mw = errorHandler();
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });
});
