/**
 * Environment-independent benchmark constants.
 *
 * Centralizes values that were previously hardcoded across run.js, utils.js,
 * smoke-test.js, and the servers (audit ARCH-06).
 */

/** Port every benchmark server binds to (overridable via PORT env). */
export const PORT = 8080;

/**
 * Address EVERY server binds to, and the address the load generator targets.
 *
 * Previously unequalized: `fastify` and the two NextRush servers bound
 * `0.0.0.0` (AF_INET) while `raw-node`/`express`/`koa`/`hono` bound `*`
 * (AF_INET6 dual-stack, Node's default when `host` is omitted), so four of six
 * servers served benchmark traffic over an IPv6 socket with IPv4-mapped
 * addresses and two did not — an unmeasured transport asymmetry invisible to
 * every response-level parity check.
 *
 * A literal loopback address is used rather than `localhost` so the run never
 * depends on resolver ordering: on a host whose resolver returns `::1` first,
 * `localhost` would reach the dual-stack servers and fail to connect to the
 * IPv4-only ones, turning a config difference into a startup failure.
 */
export const LISTEN_HOST = '127.0.0.1';

/** Base URL for the local benchmark target. */
export const BASE_URL = `http://${LISTEN_HOST}:${PORT}`;

/**
 * Keep-alive timeout (ms) applied explicitly by EVERY server.
 *
 * Fastify defaults `keepAliveTimeout` to 72_000 while Node's own default — and
 * `@nextrush/runtime`'s `DEFAULT_KEEP_ALIVE_TIMEOUT_MS` — is 5_000, so Fastify
 * held idle sockets 14x longer than every competitor. Verified two ways before
 * this was equalized: Fastify emitted `Keep-Alive: timeout=72` on every
 * response while the others emitted `timeout=5`, and an idle-socket probe found
 * Fastify still open past 9s while the others closed at ~6s.
 *
 * A deeper idle window lets a server reuse a connection the others have already
 * closed, so an unequal value advantages that server whenever sockets go idle —
 * exactly the same class of silent skew as an unequal accept-queue backlog, and
 * equally invisible to a body/header comparison. Set explicitly everywhere so
 * this is a controlled variable rather than a coincidence of Node's default.
 */
export const KEEP_ALIVE_TIMEOUT_MS = 5000;

/**
 * V8 flags passed to every server process — identical for all frameworks so the
 * runtime configuration is a controlled variable, not a per-framework choice.
 * `--expose-gc` enables optional GC tracing; the heap cap keeps memory bounded.
 *
 * NOTE: `--max-old-space-size=512` sets an IDENTICAL heap cap for every
 * framework, but that does NOT guarantee a uniform memory-pressure effect.
 * Frameworks with higher baseline heap usage reach the GC trigger threshold
 * earlier, so the same numeric limit can produce different GC behavior across
 * frameworks. The flag ensures a level ceiling, not a level playing field.
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
