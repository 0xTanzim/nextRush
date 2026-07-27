/**
 * Cross-adapter security scenario runner (task 2.1).
 *
 * Dispatches one raw request target + headers through every registered adapter
 * driver and returns each adapter's observable result so security parity is
 * asserted, never assumed.
 *
 * @packageDocumentation
 */

import { drivers } from '../drivers';
import type {
  Configure,
  ConformanceDriver,
  DispatchInit,
  DispatchResult,
} from '../drivers/types';

/** The four primary runtime adapters used by security-parity gates. */
export const PRIMARY_SECURITY_ADAPTERS = ['node', 'bun', 'deno', 'edge'] as const;

export type PrimarySecurityAdapter = (typeof PRIMARY_SECURITY_ADAPTERS)[number];

/** Input for one security probe across adapters. */
export interface SecurityScenarioInit {
  /** Raw request target (path + optional query). */
  path: string;
  /** HTTP method (default GET). */
  method?: string;
  /** Arbitrary request headers (forged chains, case variants, etc.). */
  headers?: Record<string, string>;
  /** Optional body for non-GET probes. */
  body?: string;
  /** Whether the app trusts proxy headers (`app.options.proxy`). */
  proxy?: boolean;
  /**
   * Platform direct/socket IP. Web drivers stub this; Node observes its real
   * loopback unless a future driver extension surfaces it.
   */
  directIp?: string;
  /** App configuration before dispatch (routes, middleware, extensions). */
  configure?: Configure;
}

/** One adapter's observable outcome for a security scenario. */
export interface SecurityScenarioResult {
  /** Driver name (`node`, `bun`, `deno`, `edge`, …). */
  readonly adapter: string;
  /** Normalized response from that adapter. */
  readonly result: DispatchResult;
}

/** Drivers covering the four primary runtimes, in suite registration order. */
export function primarySecurityDrivers(
  all: readonly ConformanceDriver[] = drivers
): ConformanceDriver[] {
  const wanted = new Set<string>(PRIMARY_SECURITY_ADAPTERS);
  return all.filter((d) => wanted.has(d.name));
}

/**
 * Dispatch one security probe to every provided adapter driver.
 *
 * @param init - Raw target, headers, and optional app configuration.
 * @param adapterDrivers - Drivers to run (default: all registered suite drivers).
 * @returns One result per adapter, same order as `adapterDrivers`.
 */
export async function securityScenario(
  init: SecurityScenarioInit,
  adapterDrivers: readonly ConformanceDriver[] = drivers
): Promise<SecurityScenarioResult[]> {
  if (adapterDrivers.length === 0) {
    throw new Error('securityScenario requires at least one ConformanceDriver');
  }

  const dispatchInit: DispatchInit = {
    path: init.path,
    method: init.method,
    headers: init.headers,
    body: init.body,
    proxy: init.proxy,
    directIp: init.directIp,
  };
  const configure: Configure = init.configure ?? (() => undefined);

  const results: SecurityScenarioResult[] = [];
  for (const driver of adapterDrivers) {
    const result = await driver.dispatch(configure, dispatchInit);
    results.push({ adapter: driver.name, result });
  }
  return results;
}

/** Map adapter name → result for callers that prefer keyed lookup. */
export function securityScenarioMap(
  results: readonly SecurityScenarioResult[]
): ReadonlyMap<string, DispatchResult> {
  return new Map(results.map((r) => [r.adapter, r.result]));
}
