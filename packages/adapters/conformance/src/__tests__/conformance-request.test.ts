/**
 * Cross-adapter conformance — request-side behaviors, run against every built-in
 * driver. Assertions live in the reusable `../suite` (single source) so external
 * adapter authors run the identical checks via `defineConformanceSuite`.
 */

import { describe } from 'vitest';
import { drivers } from '../drivers';
import { defineRequestConformance } from '../suite';

describe.each(drivers)('conformance: request behaviors [$name]', (driver) => {
  defineRequestConformance(driver);
});
