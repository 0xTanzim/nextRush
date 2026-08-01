/**
 * All four adapter drivers, assembled for the parameterized conformance suite.
 *
 * @packageDocumentation
 */

import { nodeDriver } from './node-driver';
import { nextjsDriver } from './nextjs-driver';
import { serverlessDriver } from './serverless-driver';
import { bunDriver, denoDriver, edgeDriver } from './web-driver';
import type { ConformanceDriver } from './types';

/** The drivers the conformance suite runs its assertions against. */
export const drivers: readonly ConformanceDriver[] = [
  nodeDriver,
  bunDriver,
  denoDriver,
  edgeDriver,
  serverlessDriver,
  nextjsDriver,
];

export type { ConformanceDriver, DispatchInit, DispatchResult } from './types';
