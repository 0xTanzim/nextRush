/**
 * Fetch latest published versions from npm registry at RUNTIME, per package.
 *
 * Every emitted @nextrush/* (or `nextrush`) dependency is resolved from its OWN registry
 * entry — never proxied through another package's version (see RFC-021 / ADR-0011: the
 * framework's packages version independently by design; `.changeset/config.json`'s `fixed`
 * group intentionally excludes @nextrush/dev, the middleware packages, and the bun/deno
 * adapters).
 *
 * Falls back to a build-time-injected PER-PACKAGE version map when the registry is
 * unreachable for a given package (offline, timeout, 404, etc.) — never to another
 * package's fallback value.
 */

declare const __FALLBACK_VERSIONS__: Record<string, string> | undefined;

/**
 * Dev-mode-only per-package fallback used when this module runs WITHOUT the tsup build
 * step (e.g. under `vitest` directly against `src/`, where `__FALLBACK_VERSIONS__` is
 * never defined). Mirrors the current workspace's real major-version split so tests can
 * exercise the offline path without a build. The published CLI always uses the build-time
 * map injected by `tsup.config.ts` — this is never shipped as the primary source.
 */
const DEV_FALLBACK_VERSIONS: Record<string, string> = {
  nextrush: '^3.1.0',
  '@nextrush/types': '^3.1.0',
  '@nextrush/class': '^3.1.0',
  '@nextrush/dev': '^1.0.0',
  '@nextrush/cors': '^3.1.0',
  '@nextrush/body-parser': '^3.1.0',
  '@nextrush/helmet': '^3.1.0',
  '@nextrush/rate-limit': '^1.0.0',
  '@nextrush/compression': '^3.1.0',
  '@nextrush/request-id': '^1.0.0',
  '@nextrush/adapter-bun': '^1.0.0',
  '@nextrush/adapter-deno': '^1.0.0',
};

const FALLBACK_VERSIONS: Record<string, string> = (() => {
  try {
    // esbuild's `define` (via tsup.config.ts) substitutes this identifier as a JS
    // EXPRESSION at build time — the value here is already a plain object, never a JSON
    // string, so JSON.parse must NOT be called on it (calling JSON.parse on a non-string
    // coerces it to `"[object Object]"`, which throws — silently falling through to the
    // smaller, dev-only fallback map below for every package, in the published CLI,
    // whenever a live registry probe failed. Found by actually running the built CLI
    // end-to-end and observing a real resolution failure for a package present in the
    // correctly-computed map but absent from the dev-only one).
    return typeof __FALLBACK_VERSIONS__ !== 'undefined' ? __FALLBACK_VERSIONS__ : DEV_FALLBACK_VERSIONS;
  } catch {
    return DEV_FALLBACK_VERSIONS;
  }
})();

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const PROBE_TIMEOUT_MS = 5000;

/** Resolves the npm registry to probe against, honoring the caller's configured registry. */
function resolveRegistry(): string {
  const configured = process.env.npm_config_registry;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/+$/, '');
  }
  return DEFAULT_REGISTRY;
}

async function fetchLatestVersion(pkg: string, registry: string): Promise<string> {
  try {
    const encodedPkg = pkg.startsWith('@') ? pkg.replace('/', '%2F') : pkg;
    const res = await fetch(`${registry}/${encodedPkg}/latest`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { version?: string };
    return data.version ?? '';
  } catch {
    return '';
  }
}

/**
 * Resolves the version range for every requested package name, independently.
 *
 * Called once at CLI startup with the exact set of packages the chosen
 * `{style, runtime, middleware}` will emit. Each package is probed in parallel under one
 * shared timeout budget; a package whose probe fails or times out falls back to ITS OWN
 * entry in the build-time fallback map — never another package's resolved/fallback value.
 *
 * @param packageNames - every `@nextrush/*` (or `nextrush`) package name to resolve.
 * @returns a map of package name to a caret version range, e.g. `"^1.0.0"`.
 */
export async function resolveVersions(packageNames: readonly string[]): Promise<Map<string, string>> {
  const registry = resolveRegistry();
  const results = await Promise.all(
    packageNames.map(async (pkg) => {
      const liveVersion = await fetchLatestVersion(pkg, registry);
      if (liveVersion) {
        return [pkg, `^${liveVersion}`] as const;
      }
      const fallback = FALLBACK_VERSIONS[pkg];
      if (!fallback) {
        throw new Error(
          `Unable to resolve a version for package "${pkg}": the registry probe failed and no fallback entry exists for it. This usually means a new package was added to the scaffolder without adding it to the fallback map in tsup.config.ts.`
        );
      }
      return [pkg, fallback] as const;
    })
  );

  return new Map(results);
}
