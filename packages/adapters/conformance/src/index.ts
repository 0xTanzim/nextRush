/**
 * @nextrush/adapter-conformance — testing-tier entrypoint (task group 11.1).
 *
 * **Testing/dev tier, NOT the frozen runtime API.** External adapter authors
 * import from here to certify a new adapter against the SAME cross-adapter
 * behavioral suite the built-in adapters pass:
 *
 * ```ts
 * import { describe } from 'vitest';
 * import { defineConformanceSuite, type ConformanceDriver } from '@nextrush/adapter-conformance';
 *
 * const myDriver: ConformanceDriver = { name: 'my-runtime', ... };
 * describe('my-adapter conformance', () => defineConformanceSuite(myDriver));
 * ```
 *
 * Implement a {@link ConformanceDriver} for your adapter (drive its real handler,
 * normalize the result), then run `defineConformanceSuite(driver)`. Behaviors
 * that legitimately cannot match are encoded as capability flags on the driver
 * (e.g. `handlerTimeout504`, `teardownOnShutdown`, `transportAbortFiresSignal`),
 * never skipped.
 *
 * @packageDocumentation
 * @module @nextrush/adapter-conformance
 */

// Driver contract (implement this for your adapter)
export type {
  ConformanceDriver,
  Configure,
  DispatchInit,
  DispatchResult,
} from './drivers/types';

// The reusable suite (run these against your driver)
export {
  defineConformanceSuite,
  defineRequestConformance,
  defineResponseConformance,
  defineRuntimeConformance,
} from './suite';

// The built-in drivers + certification matrix (for reference/inspection)
export { drivers } from './drivers';
export {
  FEATURES,
  certInputs,
  coverageOf,
  featureSupport,
  renderCertificationMarkdown,
  type CertInput,
  type Feature,
  type Support,
} from './certification';
