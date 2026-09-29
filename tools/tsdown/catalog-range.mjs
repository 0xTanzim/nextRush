import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * pnpm's workspace catalog protocol, with or without a catalog name.
 * @see https://pnpm.io/catalogs
 */
const CATALOG_PROTOCOL = 'catalog:';

/**
 * Resolve a specifier taken from a workspace-root manifest into a concrete version
 * range that a *generated, standalone* project can install.
 *
 * A `catalog:<name>` specifier (or the unnamed `catalog:`) resolves only inside the
 * workspace that declares the catalog. A scaffolded project lives outside that
 * workspace, so re-emitting the protocol verbatim produces a `package.json` no package
 * manager can install. The catalog's real resolved value is the version pnpm installed
 * for the package, so read it from the workspace root's `node_modules`.
 *
 * A plain range is returned unchanged.
 *
 * @param {string | undefined} spec - the root manifest's specifier, e.g. `"catalog:tooling"`
 * @param {string} packageName - the package the specifier resolves for, e.g. `"oxlint"`
 * @param {string} rootDir - workspace root containing `node_modules`
 * @param {string} fallback - value used when the spec is a catalog protocol with no installed resolution
 * @returns {string} a concrete, installable version range
 */
export function resolveInstallableRange(spec, packageName, rootDir, fallback) {
  if (typeof spec === 'string' && spec.length > 0 && !spec.startsWith(CATALOG_PROTOCOL)) {
    return spec;
  }

  try {
    const manifest = JSON.parse(
      readFileSync(join(rootDir, 'node_modules', packageName, 'package.json'), 'utf8')
    );
    if (typeof manifest.version === 'string' && manifest.version.length > 0) {
      return manifest.version;
    }
  } catch {
    // No installed resolution available (offline, package not installed) — fall back.
  }

  return fallback;
}
