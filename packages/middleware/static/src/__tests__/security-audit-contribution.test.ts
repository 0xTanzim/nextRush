/**
 * @nextrush/static - Boot-time security audit contribution (task 8.1/8.2)
 *
 * `serveStatic()` tags its returned middleware with a {@link SECURITY_AUDIT}
 * check so `Application.ready()` warns, in production, when `dotfiles: 'allow'`
 * is configured — a legitimate choice for some apps (serving `.well-known/`),
 * so it warns rather than throws, unlike the CORS reflect+credentials case.
 */
import { describe, expect, it } from 'vitest';
import { SECURITY_AUDIT, type SecurityAuditCheck } from '@nextrush/types';
import { serveStatic } from '../index';

function auditOf(mw: unknown): SecurityAuditCheck {
  const check = (mw as Record<typeof SECURITY_AUDIT, SecurityAuditCheck>)[SECURITY_AUDIT];
  expect(typeof check).toBe('function');
  return check;
}

describe('serveStatic() — security-boundaries boot audit contribution', () => {
  it('reports a warn-level verdict for dotfiles: allow', () => {
    const mw = serveStatic({ root: '/tmp', dotfiles: 'allow' });
    const verdict = auditOf(mw)();

    expect(verdict.level).toBe('warn');
    expect(verdict).toMatchObject({ message: expect.stringContaining('dotfiles') });
  });

  it('reports ok for the default dotfiles policy (ignore)', () => {
    const mw = serveStatic({ root: '/tmp' });
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });

  it('reports ok for dotfiles: deny', () => {
    const mw = serveStatic({ root: '/tmp', dotfiles: 'deny' });
    expect(auditOf(mw)()).toEqual({ level: 'ok' });
  });
});
