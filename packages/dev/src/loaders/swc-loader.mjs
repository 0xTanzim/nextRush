/**
 * SWC Loader for @nextrush/dev
 *
 * This loader wraps @swc-node/register to work from any CWD.
 * It resolves @swc-node/register from this package's node_modules.
 *
 * The path structure is:
 *   packages/dev/dist/loaders/swc-loader.mjs  <- this file
 *   packages/dev/node_modules/@swc-node/register/esm/esm-register.mjs  <- target
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory of this file (inside @nextrush/dev/dist/loaders/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Navigate from dist/loaders/ to node_modules/@swc-node/register/esm/
// dist/loaders -> dist -> packages/dev -> packages/dev/node_modules
const swcRegisterPath = join(__dirname, '..', '..', 'node_modules', '@swc-node', 'register', 'esm', 'esm-register.mjs');

// Import and re-export the SWC hooks from @swc-node/register
const swcModule = await import(swcRegisterPath);

export const { resolve, load, initialize } = swcModule;
