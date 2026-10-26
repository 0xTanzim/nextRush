/**
 * @nextrush/core - Adversarial Differential & Seeded Property-Based Testing
 *
 * Implements property-based differential testing comparing NextRush's specialized
 * composition fast paths (composedEmpty, composedSingle, composedTwo, composedThree)
 * against an independent reference recursive executor.
 *
 * Uses a deterministic mulberry32 PRNG with fixed seeds to generate 50 distinct
 * middleware permutations (sync, async, short-circuit, throws, header mutations)
 * and asserts strict observable equivalence of execution traces and outcomes.
 */

import { describe, expect, it } from 'vitest';
import { compose } from '../middleware';
import type { Context, Middleware, Next } from '@nextrush/types';
import { createMockContext } from './_shared/create-mock-context';

/** Deterministic pseudo-random number generator (mulberry32) */
function createPRNG(seed: number) {
  let s = seed | 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent, unoptimized reference Koa-style generic executor */
function referenceCompose(middleware: Middleware[]) {
  return function referenceExecutor(ctx: Context, next?: Next): Promise<void> {
    let index = -1;
    function dispatch(i: number): Promise<void> {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      let fn: Middleware | Next | undefined = middleware[i];
      if (i === middleware.length) {
        fn = next;
      }
      if (!fn) {
        return Promise.resolve();
      }
      try {
        const res = fn(ctx, () => dispatch(i + 1));
        return Promise.resolve(res);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
    return dispatch(0);
  };
}

interface StepSpec {
  isAsync: boolean;
  shouldCallNext: boolean;
  shouldThrow: boolean;
  throwSync: boolean;
}

interface ExecutionResult {
  trace: string[];
  headers: Record<string, string>;
  rejected: boolean;
  errorMessage?: string;
}

function buildMiddleware(id: number, spec: StepSpec, trace: string[]): Middleware {
  return (ctx: Context, next: () => Promise<void>) => {
    trace.push(`m${id}:enter`);
    ctx.set(`x-m${id}`, 'visited');

    if (spec.shouldThrow && spec.throwSync) {
      trace.push(`m${id}:throw-sync`);
      throw new Error(`error-sync-m${id}`);
    }

    if (!spec.isAsync) {
      // Synchronous branch
      if (spec.shouldCallNext) {
        const p = next();
        trace.push(`m${id}:after-next-sync`);
        return p;
      }
      trace.push(`m${id}:short-circuit-sync`);
      return undefined;
    }

    // Asynchronous branch
    return (async () => {
      await new Promise((r) => setTimeout(r, 1));
      if (spec.shouldThrow && !spec.throwSync) {
        trace.push(`m${id}:throw-async`);
        throw new Error(`error-async-m${id}`);
      }
      if (spec.shouldCallNext) {
        await next();
        trace.push(`m${id}:after-next-async`);
      } else {
        trace.push(`m${id}:short-circuit-async`);
      }
    })();
  };
}

function makeDifferentialContext(_trace?: string[]): { ctx: Context; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const ctx = createMockContext({
    headers,
    set: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    get: (k: string) => headers[k.toLowerCase()],
  });
  return { ctx, headers };
}

async function runPipeline(
  executor: (ctx: Context) => Promise<void>,
  trace: string[]
): Promise<ExecutionResult> {
  const { ctx, headers } = makeDifferentialContext(trace);
  let rejected = false;
  let errorMessage: string | undefined;

  try {
    await executor(ctx);
  } catch (err) {
    rejected = true;
    errorMessage = (err as Error).message;
  }

  return {
    trace: [...trace],
    headers: { ...headers },
    rejected,
    errorMessage,
  };
}

describe('Adversarial Differential & Seeded Property-Based Testing', () => {
  const MASTER_SEED = 20261026;
  const prng = createPRNG(MASTER_SEED);

  // Generate 50 distinct random pipeline specifications across stack sizes 0, 1, 2, 3, 4
  const scenarios: { id: number; size: number; specs: StepSpec[] }[] = [];

  for (let s = 1; s <= 50; s++) {
    // Distribute sizes: 0, 1, 2, 3 (fast paths) and 4 (general fallback)
    const size = s % 5;
    const specs: StepSpec[] = [];

    for (let i = 0; i < size; i++) {
      specs.push({
        isAsync: prng() > 0.4,
        shouldCallNext: prng() > 0.25,
        shouldThrow: prng() > 0.8,
        throwSync: prng() > 0.5,
      });
    }

    scenarios.push({ id: s, size, specs });
  }

  it.each(scenarios)(
    'Scenario #$id (stack size $size): candidate matches reference executor identically',
    async ({ id, specs }) => {
      // 1. Build identical stacks for both executors
      const traceRef: string[] = [];
      const traceCand: string[] = [];

      const stackRef: Middleware[] = specs.map((sp, idx) => buildMiddleware(idx + 1, sp, traceRef));
      const stackCand: Middleware[] = specs.map((sp, idx) => buildMiddleware(idx + 1, sp, traceCand));

      const refExecutor = referenceCompose(stackRef);
      const candExecutor = compose(stackCand);

      // 2. Execute reference
      const resultRef = await runPipeline(refExecutor, traceRef);

      // 3. Execute candidate
      const resultCand = await runPipeline(candExecutor, traceCand);

      // 4. Differential assertion: observable traces and outcomes must be 100% identical
      try {
        expect(resultCand.rejected).toBe(resultRef.rejected);
        expect(resultCand.errorMessage).toBe(resultRef.errorMessage);
        expect(resultCand.trace).toEqual(resultRef.trace);
        expect(resultCand.headers).toEqual(resultRef.headers);
      } catch (assertionError) {
        // Log reproduction metadata if a differential mismatch ever occurs
        console.error(`Differential mismatch in scenario #${id} with seed ${MASTER_SEED}:`, {
          specs,
          resultRef,
          resultCand,
        });
        throw assertionError;
      }
    }
  );
});
