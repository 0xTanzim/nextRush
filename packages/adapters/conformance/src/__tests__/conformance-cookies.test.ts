/**
 * Cross-adapter conformance — cookie capability behaviors (RFC-034), run
 * against every built-in driver. Assertions live in the reusable `../suite`
 * (single source): the uninitialized diagnostic, activation parsing, multiple
 * Set-Cookie accumulation, deletion, and read-after-write.
 */

import { describe } from 'vitest';
import { drivers } from '../drivers';
import { defineCookieConformance } from '../suite';

describe.each(drivers)('conformance: cookie behaviors [$name]', (driver) => {
  defineCookieConformance(driver);
});
