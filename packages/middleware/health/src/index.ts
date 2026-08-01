/**
 * @nextrush/health
 *
 * Liveness and readiness health check endpoints for orchestrator probes
 * (Kubernetes, PM2, systemd, Docker).
 *
 * Features:
 * - `/livez` reflects only whether the process can respond at all — never
 *   depends on registered checks.
 * - `/readyz` reflects whether every registered readiness check currently
 *   passes — 503 if any fails, throws, or times out.
 * - Check functions may be sync (`() => boolean`) or async
 *   (`() => Promise<boolean>`).
 * - A hung check is bounded by a timeout and treated as a failure, never
 *   an indefinite hang.
 *
 * @packageDocumentation
 */

// ============================================================================
// Constants
// ============================================================================

export {
    DEFAULT_CHECK_TIMEOUT_MS,
    DEFAULT_LIVEZ_PATH,
    DEFAULT_READYZ_PATH,
    HTTP_OK,
    HTTP_SERVICE_UNAVAILABLE,
    STATUS_ERROR,
    STATUS_OK
} from './constants';

// ============================================================================
// Types
// ============================================================================

export type {
    CheckFn,
    HealthInstance,
    HealthOptions,
    HealthResponseBody
} from './types';

// ============================================================================
// Middleware
// ============================================================================

export { health } from './middleware';
