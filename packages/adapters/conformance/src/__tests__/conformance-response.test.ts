/**
 * Cross-adapter conformance — response-side behaviors, run against every built-in
 * driver. Assertions live in the reusable `../suite` (single source).
 */

import { describe } from 'vitest';
import { drivers } from '../drivers';
import { defineResponseConformance } from '../suite';

describe.each(drivers)('conformance: response behaviors [$name]', (driver) => {
  defineResponseConformance(driver);
});
