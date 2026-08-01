/**
 * dev-cli-fixture — minimal app for CI's `nextrush dev`/`nextrush build` smoke tests.
 *
 * Intentionally has no framework features beyond what `dev`/`build` touch (routing +
 * a single JSON response) — this fixture only needs to prove the CLI can start a
 * process, serve a request, shut down cleanly, and produce a working build output.
 * See openspec/changes/close-phase0-ci-matrix-and-metadata-preflight/design.md (D4).
 *
 * The `HealthStatus` interface and `describeHealth` export below exist solely so
 * `nextrush build`'s `.d.ts` generation (see build-e2e-integration.test.ts, T013) has a
 * non-trivial type signature to assert against — a fixture with zero exported types would
 * make declaration-emission tests pass on an empty file, catching nothing.
 */
import { createApp, createRouter, listen } from 'nextrush';

export interface HealthStatus {
  ok: boolean;
}

export function describeHealth(): HealthStatus {
  return { ok: true };
}

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json(describeHealth()));
app.route('/', router);

const port = Number(process.env.PORT ?? 8080);
listen(app, port);
