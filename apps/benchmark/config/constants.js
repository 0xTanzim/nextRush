/**
 * Environment-independent benchmark constants.
 *
 * Centralizes values that were previously hardcoded across run.js, utils.js,
 * smoke-test.js, and the servers (audit ARCH-06).
 */

/** Port every benchmark server binds to (overridable via PORT env). */
export const PORT = 8080;

/** Base URL for the local benchmark target. */
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * V8 flags passed to every server process — identical for all frameworks so the
 * runtime configuration is a controlled variable, not a per-framework choice.
 * `--expose-gc` enables optional GC tracing; the heap cap keeps memory bounded.
 */
export const NODE_SERVER_FLAGS = Object.freeze(['--expose-gc', '--max-old-space-size=512']);

/**
 * TCP accept-queue depth (`server.listen`'s `backlog`) applied by EVERY server.
 *
 * `@nextrush/adapter-node` ships `DEFAULT_LISTEN_BACKLOG = 1024` while Node's
 * own default is 511, so leaving the competitors on their default gave NextRush
 * a 2x deeper accept queue — worth a measured +1.2% at 512 connections and
 * invisible to a response-parity check. Every server now passes this same value
 * explicitly, so the accept queue is a controlled variable rather than a
 * per-framework accident.
 *
 * The NextRush servers are the one exception: `@nextrush/adapter-node`'s own
 * `listen()`/`serve()` accept no backlog option, so they rely on that
 * package's `DEFAULT_LISTEN_BACKLOG` happening to equal this constant rather
 * than passing it explicitly. This equality is pinned by
 * `scripts/lib/__tests__/backlog-invariant.test.js` and verified live by
 * `bench:validate`'s backlog-parity check — either one fails loudly if the
 * two packages' values ever diverge.
 *
 * The generated report discloses this override rather than presenting 1024
 * as the competitors' native behavior.
 */
export const LISTEN_BACKLOG = 1024;

/** Interval (ms) for /proc RSS + CPU sampling. */
export const METRICS_INTERVAL_MS = 500;

/** How long to wait for a server to become ready before failing. */
export const SERVER_START_TIMEOUT_MS = 20000;

/** Poll interval while waiting for server readiness. */
export const SERVER_POLL_INTERVAL_MS = 250;

/** Warmup connection/thread counts (kept small — warmup only primes the JIT). */
export const WARMUP_CONNECTIONS = 10;
export const WARMUP_THREADS = 2;

/**
 * Default regression tolerance for `bench:check` — a framework may drop this
 * fraction below its baseline mean RPS before the gate fails.
 */
export const REGRESSION_TOLERANCE = 0.1;
