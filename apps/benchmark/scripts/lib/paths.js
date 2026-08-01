/** Filesystem path constants for the benchmark suite. */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** apps/benchmark root (scripts/lib → scripts → benchmark). */
export const ROOT_DIR = resolve(__dirname, '..', '..');
export const SERVERS_DIR = join(ROOT_DIR, 'servers');
export const RESULTS_DIR = join(ROOT_DIR, 'results');
export const WRK_DIR = join(ROOT_DIR, 'wrk');
