/**
 * NextRush package registry — public lookup API.
 *
 * The data lives in package-registry-data.ts (kept as a separate file so
 * this module stays a small, stable API surface as the package count
 * grows). Import from here, not from the data file directly.
 */

export type { PackageCategory, PackageEntry, PackageStatus, PackageTypeBadge } from './package-registry-types';

import { packageRegistryData } from './package-registry-data';
import type { PackageCategory, PackageEntry, PackageStatus } from './package-registry-types';

export const packageRegistry: readonly PackageEntry[] = packageRegistryData;

/** Lookup map from npm package name to its registry entry. */
export const packageRegistryByName: ReadonlyMap<string, PackageEntry> = new Map(
  packageRegistry.map((entry) => [entry.name, entry]),
);

export function getPackageEntry(name: string): PackageEntry | undefined {
  return packageRegistryByName.get(name);
}

export function getPackagesByCategory(category: PackageCategory): readonly PackageEntry[] {
  return packageRegistry.filter((entry) => entry.category === category);
}

export function getPackagesByStatus(status: PackageStatus): readonly PackageEntry[] {
  return packageRegistry.filter((entry) => entry.status === status);
}
