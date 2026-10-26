/**
 * A process-local deadline scheduler: one timer serves many pending deadlines.
 *
 * @remarks
 * Arming one `setTimeout` per request is the single most expensive thing a
 * request path can do on Deno, where a `setTimeout`/`clearTimeout` pair costs
 * ~2.15 µs against Bun's ~0.16 µs — and a request that waits on I/O (a body
 * read, a database call) is still pending when the timeout window opens, so
 * the timer is armed for it. Measured on the Deno POST path, the per-request
 * timer cost 8.28 µs of server CPU per request (+29.8 %).
 *
 * This scheduler keeps the deadline semantics and removes the per-request
 * timer: a request registers a deadline, and one shared timer serves every
 * pending deadline.
 *
 * Two properties make the shared timer actually shared:
 *
 * - **The timer is never cancelled per request.** Cancelling it when the last
 *   pending deadline goes away would make every request re-arm it, which is
 *   the per-request cost wearing a different hat. The timer is released when
 *   the sweep finds nothing pending.
 * - **The timer wakes on a short window.** It is armed for at most
 *   {@link IDLE_WINDOW_MS}, so the sweep re-arms it a few times a second
 *   instead of sleeping until a far-off deadline. That keeps a process with no
 *   pending deadline from holding a timer for the whole timeout, and it costs
 *   a handful of timer operations per second rather than one per request.
 *
 * A deadline is still honoured exactly: the sweep arms the timer for the exact
 * remaining time once the deadline is within the window, so the callback runs
 * at the deadline rather than at the next window boundary.
 *
 * The clock is monotonic where the runtime provides one, matching
 * `setTimeout`'s relative-delay semantics: the deadline and the delay handed
 * to the timer are measured against the same clock, so a wall-clock change
 * cannot move a deadline.
 */

/** A registration that can be cancelled before its deadline fires. */
export interface DeadlineRegistration {
  /** Cancel the deadline. The callback will not run. Idempotent. */
  cancel(): void;
}

/** One pending deadline. */
interface DeadlineEntry {
  /** Monotonic timestamp the deadline is due at. */
  readonly dueAt: number;
  /** Invoked when the deadline is reached. */
  readonly onDeadline: () => void;
}

/** Options for a {@link DeadlineScheduler}. */
export interface DeadlineSchedulerOptions {
  /**
   * The clock the deadlines are measured against, in milliseconds.
   *
   * @default A monotonic clock where the runtime provides one, else the wall clock.
   */
  now?: () => number;
}

/**
 * How long the shared timer may sleep before it sweeps the pending deadlines.
 *
 * @remarks
 * The window bounds how long a process can hold the timer after its last
 * request, and how often the sweep runs. Ten sweeps a second is far below the
 * cost of the timer work it replaces.
 */
const IDLE_WINDOW_MS = 100;

/**
 * Monotonic clock in milliseconds.
 *
 * `performance.now()` where the runtime provides it (Node, Bun, Deno, and the
 * edge runtimes all do), falling back to the wall clock where it does not.
 */
const defaultClock: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

/**
 * Schedules deadlines on one shared timer.
 *
 * @example
 * ```ts
 * const scheduler = new DeadlineScheduler();
 * const registration = scheduler.register(30_000, () => console.log('deadline'));
 * registration.cancel();
 * ```
 */
export class DeadlineScheduler {
  /** Pending deadlines, keyed by registration id. */
  private readonly pending = new Map<number, DeadlineEntry>();
  /** Monotonic id for the next registration. */
  private nextId = 1;
  /** The shared timer, when one is armed. */
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** When the shared timer is currently due to fire. */
  private armedUntil = Number.POSITIVE_INFINITY;
  /** The clock the deadlines are measured against. */
  private readonly clock: () => number;

  constructor(options: DeadlineSchedulerOptions = {}) {
    this.clock = options.now ?? defaultClock;
  }

  /**
   * Register a deadline.
   *
   * @param delayMs - How long until the deadline is due.
   * @param onDeadline - Invoked when the deadline is reached.
   * @returns A registration that cancels the deadline.
   */
  register(delayMs: number, onDeadline: () => void): DeadlineRegistration {
    const id = this.nextId;
    this.nextId += 1;

    const dueAt = this.clock() + delayMs;
    this.pending.set(id, { dueAt, onDeadline });

    // The shared timer sweeps every pending deadline, so a new registration
    // only needs to re-arm it when its deadline is earlier than the timer's
    // next wake-up — a uniform timeout never is.
    if (this.timer === undefined) {
      this.arm(dueAt);
    } else if (dueAt < this.armedUntil) {
      this.arm(dueAt);
    }

    let cancelled = false;
    return {
      cancel: (): void => {
        if (cancelled) return;
        cancelled = true;
        this.pending.delete(id);
      },
    };
  }

  /** Arm the shared timer, at most one window ahead of a deadline. */
  private arm(dueAt: number): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    const delay = Math.max(0, Math.min(dueAt - this.clock(), IDLE_WINDOW_MS));
    this.armedUntil = this.clock() + delay;
    this.timer = setTimeout(() => {
      this.fire();
    }, delay);
  }

  /** Fire every deadline that is due, then re-arm for the next one. */
  private fire(): void {
    this.timer = undefined;
    this.armedUntil = Number.POSITIVE_INFINITY;

    const at = this.clock();
    const due: DeadlineEntry[] = [];

    for (const [id, entry] of this.pending) {
      if (entry.dueAt <= at) {
        this.pending.delete(id);
        due.push(entry);
      }
    }

    // The callbacks run outside the sweep, so one that throws cannot leave the
    // remaining deadlines unscheduled.
    try {
      for (const entry of due) entry.onDeadline();
    } finally {
      this.armForNextPending();
    }
  }

  /**
   * Arm the shared timer for the earliest deadline still pending.
   *
   * @remarks
   * The pending deadlines are read *after* the callbacks ran, so a callback
   * that registers a deadline of its own is accounted for — the timer is armed
   * for whichever deadline is actually earliest, not for one computed before
   * the callback could change it.
   */
  private armForNextPending(): void {
    let nextDueAt = Number.POSITIVE_INFINITY;
    for (const entry of this.pending.values()) {
      if (entry.dueAt < nextDueAt) nextDueAt = entry.dueAt;
    }
    // Nothing pending: the timer is released, so a process with no deadline
    // left holds no timer.
    if (nextDueAt !== Number.POSITIVE_INFINITY) this.arm(nextDueAt);
  }
}
