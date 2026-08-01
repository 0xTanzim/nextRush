/**
 * @nextrush/runtime - Deadline signal tests (N11, task 11.3)
 *
 * Covers `deriveDeadlineSignal` — deriving a bounded child `AbortSignal` from
 * a parent signal (e.g. `ctx.signal`) so handler authors can race work
 * against a deadline without hand-rolling `AbortSignal.any`/`setTimeout`.
 */

import { describe, expect, it } from 'vitest';
import { deriveDeadlineSignal } from '../request-signal.js';

describe('deriveDeadlineSignal (N11, F-06 helper)', () => {
  it('aborts when the timeout elapses (parent never aborts)', async () => {
    // AbortSignal.timeout() schedules against the platform's real timer
    // internals, not vi's fake-timer queue — exercise it with a real (short)
    // wait rather than vi.advanceTimersByTime.
    const parent = new AbortController();
    const derived = deriveDeadlineSignal(parent.signal, 20);

    expect(derived.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(derived.aborted).toBe(true);
  });

  it('aborts when the parent signal fires first, before the timeout', async () => {
    const parent = new AbortController();
    const derived = deriveDeadlineSignal(parent.signal, 10_000);

    expect(derived.aborted).toBe(false);
    parent.abort(new Error('client disconnected'));
    expect(derived.aborted).toBe(true);
  });

  it('does not abort before either the deadline or the parent fires', async () => {
    const parent = new AbortController();
    const derived = deriveDeadlineSignal(parent.signal, 200);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(derived.aborted).toBe(false);
  });

  it('an already-aborted parent produces an already-aborted derived signal', () => {
    const parent = new AbortController();
    parent.abort();
    const derived = deriveDeadlineSignal(parent.signal, 1_000);
    expect(derived.aborted).toBe(true);
  });
});
