/**
 * Combines the two package-registry data parts into one ordered list.
 * Split into two files purely to respect the repo's 300-line file-size
 * ceiling — the data is one logical table, read package-registry.ts for
 * the public API.
 */

import { packageRegistryDataPart1 } from './package-registry-data-1';
import { packageRegistryDataPart2 } from './package-registry-data-2';
import type { PackageEntry } from './package-registry-types';

export const packageRegistryData: readonly PackageEntry[] = [
  ...packageRegistryDataPart1,
  ...packageRegistryDataPart2,
];
