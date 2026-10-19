/**
 * Scenario proof-level ledger tests (task 1.4/1.5).
 *
 * The suite must be able to say, per scenario and per driver, at what level the
 * assertion was actually proven — and must never credit a driver with a pass for
 * a scenario it cannot observe. These pin the refusal path (`not satisfied at
 * real-runtime level`), the recorded level for each combination, and the built-in
 * driver set's declared transport/fidelity.
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';
import type { ConformanceDriver, RuntimeFidelity, Transport } from '../drivers/types';
import {
  SOCKET_UNSATISFIED_REASON,
  createScenarioLedger,
  proofLevelOf,
  type ScenarioRecord,
} from '../scenario';

/** A driver that declares only its transport/fidelity — never actually dispatched. */
function fakeDriver(transport: Transport, runtimeFidelity: RuntimeFidelity): ConformanceDriver {
  return {
    name: `fake-${transport}`,
    transport,
    runtimeFidelity,
    handlerTimeout504: true,
    teardownOnShutdown: true,
    honorsCloudflareIp: false,
    // Not dispatched by the ledger tests; declared so the driver contract stays
    // complete where it is implemented.
    honorsPostHandlerHeaderWrite: false,
    transportAbortFiresSignal: true,
    rawRequestTarget: false, // never dispatched — only its transport/fidelity is read
    dispatch: () => Promise.reject(new Error('the ledger never dispatches')),
    abortFiresSignal: () => Promise.resolve(false),
    timeoutResult: () => Promise.resolve(null),
  };
}

/** Read the single record a ledger holds, failing loudly if it holds another count. */
function only(records: readonly ScenarioRecord[]): ScenarioRecord {
  const [record] = records;
  if (record === undefined) throw new Error('expected exactly one record');
  return record;
}

describe('scenario proof-level ledger', () => {
  it('1.4 refuses a socket-required scenario from an in-process driver, reporting the level it missed', () => {
    const registered: string[] = [];
    const ledger = createScenarioLedger((name) => {
      registered.push(name);
    });

    const accepted = ledger.register(
      fakeDriver('in-process', 'simulated'),
      '#25 real listener',
      { socketRequired: true },
      () => undefined
    );

    // Not registered → it can never be counted as a pass.
    expect(accepted).toBe(false);
    expect(registered).toEqual([]);

    const record = only(ledger.records());
    expect(record.satisfied).toBe(false);
    expect(record.reason).toBe(SOCKET_UNSATISFIED_REASON);
    expect(record.reason).toContain('not satisfied at real-runtime level');
    expect(proofLevelOf(record)).toBe('not-satisfied');
  });

  it('1.4 registers the same scenario for a socket driver and reports real-runtime + socket', () => {
    const registered: string[] = [];
    const ledger = createScenarioLedger((name) => {
      registered.push(name);
    });

    const accepted = ledger.register(
      fakeDriver('socket', 'real-runtime'),
      '#25 real listener',
      { socketRequired: true },
      () => undefined
    );

    expect(accepted).toBe(true);
    expect(registered).toEqual(['#25 real listener']);
    expect(proofLevelOf(only(ledger.records()))).toBe('real-runtime+socket');
  });

  it('1.4 registers a scenario with no socket requirement for any driver, at that driver’s own level', () => {
    const ledger = createScenarioLedger(() => undefined);

    expect(ledger.register(fakeDriver('in-process', 'simulated'), '#1', {}, () => undefined)).toBe(
      true
    );
    expect(
      ledger.register(fakeDriver('in-process', 'real-runtime'), '#1', {}, () => undefined)
    ).toBe(true);

    expect(ledger.records().map(proofLevelOf)).toEqual(['simulated', 'real-runtime']);
  });

  it('1.4 renders every recorded scenario with its level and, when refused, why', () => {
    const ledger = createScenarioLedger(() => undefined);
    ledger.register(fakeDriver('socket', 'real-runtime'), '#25', { socketRequired: true }, () => undefined);
    ledger.register(fakeDriver('in-process', 'simulated'), '#25', { socketRequired: true }, () => undefined);
    ledger.register(fakeDriver('in-process', 'simulated'), '#1', {}, () => undefined);

    const report = ledger.report();

    expect(report).toContain('real-runtime+socket');
    expect(report).toContain('not-satisfied');
    expect(report).toContain('simulated');
    expect(report).toContain(SOCKET_UNSATISFIED_REASON);
    expect(report).toContain(
      '3 recorded — 2 satisfied (1 over a real socket, 1 on the real runtime), 1 not satisfied'
    );
  });

  it('1.4 only the built-in socket driver can satisfy a socket-required scenario', () => {
    const registered: string[] = [];
    const ledger = createScenarioLedger((name) => {
      registered.push(name);
    });

    for (const driver of drivers) {
      ledger.register(driver, '#25 real listener', { socketRequired: true }, () => undefined);
    }

    expect(registered).toEqual(['#25 real listener']); // node, the only socket driver
    expect(ledger.records().filter((r) => !r.satisfied).map((r) => r.driver)).toEqual([
      'bun',
      'deno',
      'edge',
      'serverless',
      'nextjs',
    ]);
  });

  it('1.5 declares transport and fidelity for every built-in driver', () => {
    const byName = new Map(drivers.map((d) => [d.name, d]));

    expect(byName.get('node')?.transport).toBe('socket');
    expect(byName.get('node')?.runtimeFidelity).toBe('real-runtime');

    for (const name of ['bun', 'deno', 'edge', 'serverless', 'nextjs']) {
      expect(byName.get(name)?.transport).toBe('in-process');
      expect(byName.get(name)?.runtimeFidelity).toBe('simulated');
    }
  });
});
