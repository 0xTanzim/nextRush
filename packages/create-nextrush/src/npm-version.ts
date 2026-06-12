/**
 * Fetch latest published versions from npm registry at RUNTIME.
 * This ensures create-nextrush always generates projects with
 * the latest published packages, regardless of CLI version.
 *
 * Falls back to build-time versions if offline.
 */

declare const __CORE_RANGE__: string;
declare const __MW_RANGE__: string;

const CORE_FALLBACK: string = typeof __CORE_RANGE__ !== 'undefined' ? __CORE_RANGE__ : '^0.0.0';
const MW_FALLBACK: string = typeof __MW_RANGE__ !== 'undefined' ? __MW_RANGE__ : '^0.0.0';

const NPM_REGISTRY = 'https://registry.npmjs.org';

interface NpmVersionCache {
  core: string;
  mw: string;
}

let cached: NpmVersionCache | null = null;

async function fetchVersion(pkg: string): Promise<string> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${pkg}/latest`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { version?: string };
    return data.version ?? '';
  } catch {
    return '';
  }
}

/**
 * Fetch latest nextrush versions from npm.
 * Called once at CLI startup. Results are cached.
 * Returns { core, mw } version ranges like "^3.0.5".
 */
export async function resolveVersions(): Promise<NpmVersionCache> {
  if (cached) return cached;

  const [coreVer, mwVer] = await Promise.all([
    fetchVersion('nextrush'),
    fetchVersion('@nextrush/cors'),
  ]);

  cached = {
    core: coreVer ? `^${coreVer}` : CORE_FALLBACK,
    mw: mwVer ? `^${mwVer}` : MW_FALLBACK,
  };

  return cached;
}
