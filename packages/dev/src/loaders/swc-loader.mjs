/**
 * SWC Loader for @nextrush/dev
 *
 * Registers the in-repo SWC hooks module (`swc-hooks.mjs`, same directory) so
 * `nextrush dev` transforms TypeScript with `@swc/core` — no third-party register
 * package, no TypeScript compiler JS API, works on any TypeScript major (D3).
 *
 * The path structure is:
 *   packages/dev/dist/loaders/swc-loader.mjs  <- this file (loaded via --import)
 *   packages/dev/dist/loaders/swc-hooks.mjs   <- hooks module (copied by tsdown onSuccess)
 *
 * `module.register()` (async, off-thread hooks) is kept deliberately: it needs only
 * Node 20.6 and is already proven in this wiring, while `module.registerHooks()`
 * needs Node 22.15+ synchronous in-thread hooks, which the repo's `>=22.0.0` engine
 * floor does not guarantee (D4). The `dist/loaders/swc-loader.mjs` entry path and the
 * `--import` wiring are unchanged, so loader-path resolution stays deterministic.
 */

import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Get this file's directory (inside @nextrush/dev/dist/loaders/, or src/loaders/
// when running from source in tests) and register the sibling hooks module by
// absolute file URL — no bare-specifier resolution, no parent-package dependency.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// D4: module.register() is kept deliberately (Node >= 20.6, proven wiring);
// registerHooks() needs Node 22.15+.
// oxlint-disable-next-line typescript/no-deprecated
register(pathToFileURL(join(__dirname, 'swc-hooks.mjs')).href);
