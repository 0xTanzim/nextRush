/**
 * Minimal functional edge entry (task group 4 — bundle budget).
 *
 * The smallest real app: core + edge adapter, reflect-metadata-free, no DI, no
 * middleware packages. This is the bundle whose gzipped size the budget gate
 * measures — the "import core + adapter-edge only" path documented for edge.
 */

import { createApp } from '@nextrush/core';
import { createFetchHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use((ctx) => {
  ctx.json({ ok: true });
});

export default { fetch: createFetchHandler(app) };
