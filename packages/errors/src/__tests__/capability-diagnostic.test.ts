/**
 * @nextrush/errors — CapabilityNotInitializedError diagnostic snapshots
 *
 * Locks the exact WHAT / WHY / HOW / WHERE message shape so a future edit
 * cannot silently degrade the developer-facing diagnostic.
 */

import { describe, expect, it } from 'vitest';
import { CapabilityNotInitializedError } from '../capability';

const COOKIE_INSTRUCTIONS =
  'Install @nextrush/cookies and register the middleware:\n' +
  '  import { cookies } from \'@nextrush/cookies\';\n' +
  '  app.use(cookies());';

describe('CapabilityNotInitializedError — diagnostic shape', () => {
  it('renders the four-part cookies diagnostic verbatim', () => {
    const error = new CapabilityNotInitializedError('cookies', COOKIE_INSTRUCTIONS);

    expect(error.message).toBe(
      'cookies capability is not initialized.\n\n' +
        'You called an operation on this capability, but its middleware has not run for ' +
        'this request. Possible causes:\n' +
        '  1. The cookies middleware was not registered.\n' +
        '  2. The middleware was registered after this route.\n' +
        '  3. The middleware is conditionally skipped for this request.\n\n' +
        'Fix:\n' +
        'Install @nextrush/cookies and register the middleware:\n' +
        '  import { cookies } from \'@nextrush/cookies\';\n' +
        '  app.use(cookies());\n\n' +
        'Docs: https://nextrush.dev/docs/reference/cookies'
    );
  });

  it('derives UPPER_SNAKE codes from camelCase capability names', () => {
    const error = new CapabilityNotInitializedError('signedCookies', 'install it');
    expect(error.code).toBe('SIGNED_COOKIES_NOT_INITIALIZED');
  });

  it('derives codes from multi-word capability names', () => {
    const error = new CapabilityNotInitializedError('rate-limit', 'install it');
    expect(error.code).toBe('RATE_LIMIT_NOT_INITIALIZED');
  });
});
