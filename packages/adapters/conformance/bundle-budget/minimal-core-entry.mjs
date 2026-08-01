/**
 * Minimal functional core entry (T012 residual — core bundle budget).
 *
 * The smallest real app on the general functional path: core + router +
 * the Node adapter (which itself pulls in @nextrush/runtime + @nextrush/stream),
 * no DI, no middleware packages. This is distinct from minimal-entry.mjs (the
 * edge-scoped bundle, core + adapter-edge only) — this one measures the bundle
 * `createApp`/`createRouter`/`listen` users get from `nextrush`'s default (Node)
 * entry point, which has no edge-specific size constraints but still needs a
 * measured, gated budget so dependency creep doesn't go unnoticed.
 */

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';

const app = createApp();
const router = createRouter();
router.get('/', (ctx) => {
  ctx.json({ ok: true });
});
app.route('/', router);

listen(app, 8080);
