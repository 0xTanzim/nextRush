/**
 * Type definitions for the package registry.
 * See package-registry-data.ts for the data and package-registry.ts for
 * the public lookup API.
 */

export type PackageCategory =
  | 'Core'
  | 'Class Runtime'
  | 'Security'
  | 'Request Data'
  | 'Responses'
  | 'Observability'
  | 'Real-time & Events'
  | 'Adapters'
  | 'Tooling';

export type PackageTypeBadge = 'Core' | 'Middleware' | 'Extension' | 'Adapter' | 'Tool';

export type PackageStatus = 'Stable' | 'New' | 'Deprecated';

export interface PackageEntry {
  /** npm package name, e.g. '@nextrush/core' or 'nextrush'. */
  readonly name: string;
  /** Capability cluster used for sidebar grouping (Axis A). */
  readonly category: PackageCategory;
  /** Type badge shown in the /packages catalog (Axis B). */
  readonly type: PackageTypeBadge;
  /** Lifecycle status shown as a badge. */
  readonly status: PackageStatus;
  /** One sentence describing what the package does. */
  readonly summary: string;
  /** The `version` field from the package's own package.json at time of writing. */
  readonly sinceVersion: string;
}
