/**
 * Cross-adapter conformance — runtime behaviors, run against every built-in
 * driver. Assertions (with encoded capability differences) live in the reusable
 * `../suite` (single source).
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';
import { defineRuntimeConformance } from '../suite';

describe.each(drivers)('conformance: runtime behaviors [$name]', (driver) => {
  defineRuntimeConformance(driver);

  // Built-in-specific: this file knows the built-in adapters by name, so it can
  // assert the exact teardown model (edge/serverless/nextjs have no server
  // lifetime, F-14/RFC-024 §7a). The reusable suite only asserts the flag is
  // declared.
  it('#18/#14 built-in teardown model: edge/serverless/nextjs have no server lifetime', () => {
    const hasServerLifetime =
      driver.name !== 'edge' && driver.name !== 'serverless' && driver.name !== 'nextjs';
    expect(driver.teardownOnShutdown).toBe(hasServerLifetime);
  });
});
