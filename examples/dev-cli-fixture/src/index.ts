/**
 * dev-cli-fixture — minimal app for CI's `nextrush dev`/`nextrush build` smoke tests.
 *
 * Intentionally has no framework features beyond what `dev`/`build` touch (routing +
 * a single JSON response) — this fixture only needs to prove the CLI can start a
 * process, serve a request, shut down cleanly, and produce a working build output.
 * See openspec/changes/close-phase0-ci-matrix-and-metadata-preflight/design.md (D4).
 */
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json({ ok: true }));
app.route('/', router);

const port = Number(process.env.PORT ?? 8080);
listen(app, port);
