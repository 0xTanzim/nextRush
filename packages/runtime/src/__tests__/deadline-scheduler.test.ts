/**
 * @nextrush/runtime — the shared deadline scheduler.
 *
 * @remarks
 * The scheduler replaces one `setTimeout` per pending request with one timer
 * that serves every pending deadline. These cases pin the two properties that
 * matter: a deadline still fires when it is due, and a cancelled deadline
 * never fires — and that the shared timer is actually shared, and actually
 * released.
 *
 * The clock is injected so the deadlines are deterministic under fake timers
 * without depending on how a runtime's `performance.now()` interacts with them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadlineScheduler } from '../deadline-scheduler';

describe('DeadlineScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A scheduler whose clock is the fake-timer wall clock. */
  function makeScheduler(): DeadlineScheduler {
    return new DeadlineScheduler({ now: () => Date.now() });
  }

  it('fires a deadline when it is due', () => {
    const scheduler = makeScheduler();
    const onDeadline = vi.fn();

    scheduler.register(1_000, onDeadline);
    vi.advanceTimersByTime(999);
    expect(onDeadline).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDeadline).toHaveBeenCalledTimes(1);
  });

  it('does not fire a cancelled deadline', () => {
    const scheduler = makeScheduler();
    const onDeadline = vi.fn();

    const registration = scheduler.register(1_000, onDeadline);
    registration.cancel();
    vi.advanceTimersByTime(5_000);

    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('treats a repeated cancel as one', () => {
    const scheduler = makeScheduler();
    const onDeadline = vi.fn();

    const registration = scheduler.register(1_000, onDeadline);
    registration.cancel();
    registration.cancel();
    vi.advanceTimersByTime(5_000);

    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('serves every pending deadline from one shared timer', () => {
    const scheduler = makeScheduler();
    const first = vi.fn();
    const second = vi.fn();

    scheduler.register(1_000, first);
    scheduler.register(2_000, second);

    // One timer, not one per registration.
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('re-arms the shared timer for an earlier deadline', () => {
    const scheduler = makeScheduler();
    const later = vi.fn();
    const earlier = vi.fn();

    scheduler.register(5_000, later);
    scheduler.register(1_000, earlier);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1_000);
    expect(earlier).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  it('keeps a later deadline reachable after an earlier one is cancelled', () => {
    const scheduler = makeScheduler();
    const first = vi.fn();
    const second = vi.fn();

    const registration = scheduler.register(1_000, first);
    scheduler.register(2_000, second);
    registration.cancel();

    vi.advanceTimersByTime(2_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('releases the shared timer when the sweep finds nothing pending', () => {
    const scheduler = makeScheduler();

    const first = scheduler.register(1_000, vi.fn());
    const second = scheduler.register(2_000, vi.fn());
    expect(vi.getTimerCount()).toBe(1);

    first.cancel();
    second.cancel();

    // The timer is not cancelled per request — that would make every request
    // re-arm it. The sweep releases it once it finds nothing pending.
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not re-arm the shared timer for every registration', () => {
    const scheduler = makeScheduler();

    for (let i = 0; i < 50; i += 1) scheduler.register(30_000, vi.fn());

    // One timer for fifty pending deadlines, not fifty timers.
    expect(vi.getTimerCount()).toBe(1);
  });

  it('serves a deadline that a callback registered', () => {
    const scheduler = makeScheduler();
    const later = vi.fn();

    scheduler.register(1_000, () => {
      scheduler.register(500, later);
    });

    // The sweep reads the pending deadlines after the callbacks ran, so the
    // deadline the callback added is served on its own schedule.
    vi.advanceTimersByTime(2_000);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('does not let a throwing callback stop the other deadlines', () => {
    const scheduler = makeScheduler();
    const later = vi.fn();

    scheduler.register(1_000, () => {
      throw new Error('callback failed');
    });
    scheduler.register(2_000, later);

    expect(() => {
      vi.advanceTimersByTime(1_000);
    }).toThrow('callback failed');

    vi.advanceTimersByTime(1_000);
    expect(later).toHaveBeenCalledTimes(1);
  });
});
