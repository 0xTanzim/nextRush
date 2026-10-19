/**
 * Scenario registry and proof-level ledger for the conformance suite.
 *
 * @remarks
 * A conformance run is only as strong as the evidence behind each assertion.
 * Before this ledger, every scenario registered itself straight through `it(...)`,
 * so a scenario that could not possibly be observed by a given driver — one that
 * needs a real socket, say — either did not exist there or quietly asserted a
 * weaker thing, and nothing recorded which. A green run therefore said "every
 * adapter passed" without saying *at what level*.
 *
 * The ledger makes that level explicit and per scenario:
 *
 *   - A driver declares its {@link Transport} and {@link RuntimeFidelity}.
 *   - A scenario declares what it needs (`socketRequired`).
 *   - A scenario whose requirement the driver cannot meet is recorded as
 *     **not satisfied at real-runtime level** and is NOT registered as a test,
 *     so it can never be mistaken for a pass.
 *
 * {@link ScenarioLedger.report} renders the whole ledger, so a runner can print
 * exactly which assertions were proven over a real socket, which on the real
 * runtime but in-process, and which were not proven at all.
 *
 * @packageDocumentation
 */

import type { ConformanceDriver, RuntimeFidelity, Transport } from './drivers/types';
import { it } from '@nextrush/adapter-conformance/test-primitives';

/** What a scenario needs from a driver before it can be proven. */
export interface ScenarioOptions {
  /**
   * The scenario can only be observed over a real HTTP listener: the behaviour it
   * pins lives in the transport (response framing, connection teardown, the raw
   * request target as the platform received it) and cannot be reproduced by
   * invoking the adapter's handler function directly.
   */
  readonly socketRequired?: boolean;
}

/** One registered (or refused) scenario, with the evidence it actually got. */
export interface ScenarioRecord {
  /** Adapter under test. */
  readonly driver: string;
  /** Scenario title, as registered. */
  readonly scenario: string;
  /** How the driver reaches the adapter. */
  readonly transport: Transport;
  /** Which runtime the driver executes on. */
  readonly runtimeFidelity: RuntimeFidelity;
  /** Whether the scenario declared a socket requirement. */
  readonly socketRequired: boolean;
  /** Whether the driver met every requirement the scenario declared. */
  readonly satisfied: boolean;
  /** Why the scenario could not run. Present only when `satisfied` is false. */
  readonly reason?: string;
}

/** Recorded reason for a socket-required scenario the driver cannot satisfy. */
export const SOCKET_UNSATISFIED_REASON =
  'not satisfied at real-runtime level: the scenario requires a real HTTP listener ' +
  'and this driver invokes the handler in-process';

/** Registers one test case. The runner supplies its own framework's `it`. */
export type ScenarioRegistrar = (name: string, fn: () => void | Promise<void>) => void;

/** Registry of scenario outcomes for one conformance run. */
export interface ScenarioLedger {
  /**
   * Record a scenario and register its test, unless the driver cannot meet the
   * scenario's requirement — in which case nothing is registered and the ledger
   * records why.
   *
   * @returns whether the scenario was registered (i.e. can be a pass).
   */
  register(
    driver: ConformanceDriver,
    name: string,
    options: ScenarioOptions,
    fn: () => void | Promise<void>
  ): boolean;

  /** Every recorded scenario, in registration order. */
  records(): readonly ScenarioRecord[];
  /** Human-readable proof-level summary of every recorded scenario. */
  report(): string;
}

/** The proof level a satisfied record actually achieved. */
export function proofLevelOf(record: ScenarioRecord): string {
  if (!record.satisfied) return 'not-satisfied';
  return record.transport === 'socket'
    ? `${record.runtimeFidelity}+socket`
    : record.runtimeFidelity;
}

/** Render a proof-level summary of `records`, grouped by scenario title. */
function renderReport(records: readonly ScenarioRecord[]): string {
  const lines = ['scenario proof levels (driver / level / scenario)'];
  for (const record of records) {
    const suffix = record.reason === undefined ? '' : ` — ${record.reason}`;
    lines.push(
      `  ${record.driver.padEnd(12)} ${proofLevelOf(record).padEnd(22)} ${record.scenario}${suffix}`
    );
  }
  const satisfied = records.filter((r) => r.satisfied);
  const socket = satisfied.filter((r) => r.transport === 'socket').length;
  const onRealRuntime = satisfied.filter((r) => r.runtimeFidelity === 'real-runtime').length;
  const refused = records.length - satisfied.length;
  lines.push(
    `  ${String(records.length)} recorded — ${String(satisfied.length)} satisfied ` +
      `(${String(socket)} over a real socket, ${String(onRealRuntime)} on the real runtime), ` +
      `${String(refused)} not satisfied`
  );
  return lines.join('\n');
}

/**
 * Build a ledger around a test registrar.
 *
 * The registrar is injected rather than imported so the ledger's own behaviour is
 * testable without a test framework, and so each real-runtime runner can wire it
 * to its own `it`.
 */
export function createScenarioLedger(test: ScenarioRegistrar): ScenarioLedger {
  const entries: ScenarioRecord[] = [];

  return {
    register(driver, name, options, fn) {
      const socketRequired = options.socketRequired === true;
      const base = {
        driver: driver.name,
        scenario: name,
        transport: driver.transport,
        runtimeFidelity: driver.runtimeFidelity,
        socketRequired,
      } as const;

      if (socketRequired && driver.transport !== 'socket') {
        entries.push({ ...base, satisfied: false, reason: SOCKET_UNSATISFIED_REASON });
        return false;
      }

      entries.push({ ...base, satisfied: true });
      test(name, fn);
      return true;
    },
    records: () => entries,
    report: () => renderReport(entries),
  };
}

const defaultLedger = createScenarioLedger(it);

/** Register a scenario against the shared suite's ledger. */
export function registerScenario(
  driver: ConformanceDriver,
  name: string,
  options: ScenarioOptions,
  fn: () => void | Promise<void>
): boolean {
  return defaultLedger.register(driver, name, options, fn);
}

/** Every scenario the shared suite registered (and refused) so far. */
export function scenarioRecords(): readonly ScenarioRecord[] {
  return defaultLedger.records();
}

/** Proof-level summary of the shared suite's ledger. */
export function scenarioReport(): string {
  return defaultLedger.report();
}
