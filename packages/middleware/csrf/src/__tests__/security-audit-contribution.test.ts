/**
 * @nextrush/csrf - Boot-time security audit contribution (task 8.1/8.2)
 *
 * `csrf()` tags its `protect` middleware with a {@link SECURITY_AUDIT} check
 * so `Application.ready()` warns, in production, when `cookie.secure: false`
 * is explicitly configured — the one CSRF cookie attribute that is a static,
 * boot-inspectable boolean (unlike `@nextrush/cookies`' per-request
 * `secure: 'auto'` resolution, which has nothing static to audit).
 */
import { describe, expect, it } from 'vitest';
import { SECURITY_AUDIT, type SecurityAuditCheck } from '@nextrush/types';
import { csrf } from '../middleware';

function auditOf(mw: unknown): SecurityAuditCheck {
  const check = (mw as Record<typeof SECURITY_AUDIT, SecurityAuditCheck>)[SECURITY_AUDIT];
  expect(typeof check).toBe('function');
  return check;
}

describe('csrf() — security-boundaries boot audit contribution', () => {
  const secret = 'a'.repeat(32);
  const baseOptions = { secret, sessionBinding: 'none' as const, originCheck: false as const };

  it('reports a warn-level verdict for cookie.secure: false', () => {
    const { protect } = csrf({
      ...baseOptions,
      cookie: { name: 'csrf-token', secure: false },
    });
    const verdict = auditOf(protect)();

    expect(verdict.level).toBe('warn');
    expect(verdict).toMatchObject({ message: expect.stringContaining('secure') });
  });

  it('reports ok for the default cookie.secure (true)', () => {
    const { protect } = csrf(baseOptions);
    expect(auditOf(protect)()).toEqual({ level: 'ok' });
  });

  it('reports ok for an explicit cookie.secure: true', () => {
    const { protect } = csrf({ ...baseOptions, cookie: { secure: true } });
    expect(auditOf(protect)()).toEqual({ level: 'ok' });
  });
});
