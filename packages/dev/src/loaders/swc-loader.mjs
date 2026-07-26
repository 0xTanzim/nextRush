/**
 * SWC Loader for @nextrush/dev
 *
 * Registers @swc-node/register ESM hooks with the correct parent URL
 * so that @swc-node/register resolves from this package's node_modules,
 * not from the user's CWD.
 *
 * The path structure is:
 *   packages/dev/dist/loaders/swc-loader.mjs  <- this file (loaded via --import)
 *   packages/dev/node_modules/@swc-node/register/esm/index.js  <- hooks module
 */

import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Get this file's directory (inside @nextrush/dev/dist/loaders/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Navigate to the dev package root: dist/loaders -> dist -> packages/dev
const devPackageRoot = join(__dirname, '..', '..');
const parentURL = pathToFileURL(join(devPackageRoot, '/')).toString();

// Register @swc-node/register/esm hooks from the dev package's node_modules
//
// `module.register()` is deprecated in favor of `module.registerHooks()` (stable since
// Node 22.15/23.5), but that replacement is not a drop-in signature swap — it wants real
// `resolve`/`load` hook functions defined synchronously in-thread, not a module specifier
// to delegate to off-thread. `@swc-node/register/esm` itself is built around the OLDER
// `register()` contract (it exports a module for `register()` to load, not hook
// functions `registerHooks()` could call directly). Migrating this loader to the new API
// means re-architecting how it integrates with `@swc-node/register`, not a mechanical
// rename — a real, separate task, not something to do silently while fixing lint debt.
// Confirmed still functionally correct: `nextrush dev`/`build` both compile TypeScript
// successfully with this loader as of this fix (2026-07-24).
// eslint-disable-next-line @typescript-eslint/no-deprecated -- see comment above; tracked, not silently ignored
register('@swc-node/register/esm', parentURL);
