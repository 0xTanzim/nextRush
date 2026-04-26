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
register('@swc-node/register/esm', parentURL);
