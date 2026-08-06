import type { MiddlewarePreset, Runtime, Style } from './types.js';
import { getPackageRange } from './version-store.js';

// Build-time injected (see tsup.config.ts define) — used only for --version flag
declare const __VERSION__: string;
export const NEXTRUSH_VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';

export const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];
export const RUNTIMES: readonly Runtime[] = ['node', 'bun', 'deno'];
export const MIDDLEWARE_PRESETS: readonly MiddlewarePreset[] = ['minimal', 'api', 'full'];

export const DEFAULT_STYLE: Style = 'functional';
export const DEFAULT_RUNTIME: Runtime = 'node';
export const DEFAULT_MIDDLEWARE: MiddlewarePreset = 'api';

/** Single runtime-policy value: the generated `engines.node` floor and the `@types/node`
 * major cap both derive from this — a future LTS bump is a one-line change here. */
export const runtimePolicy = {
  node: {
    /** Minimum supported Node major (Active LTS line). */
    minMajor: 22,
  },
} as const;

/** Backwards-compatible alias for the CLI preflight check (reads the same policy value). */
export const MIN_NODE_MAJOR: number = runtimePolicy.node.minMajor;

/** Package names for each middleware preset tier — the single source of truth for both
 * dependency resolution (task 3.3) and version-map construction. */
export const MIDDLEWARE_PACKAGE_NAMES: Record<MiddlewarePreset, readonly string[]> = {
  minimal: [],
  api: ['@nextrush/cors', '@nextrush/body-parser', '@nextrush/helmet'],
  full: [
    '@nextrush/cors',
    '@nextrush/body-parser',
    '@nextrush/helmet',
    '@nextrush/rate-limit',
    '@nextrush/compression',
    '@nextrush/request-id',
  ],
};

/** Middleware packages for each preset tier, each resolved to ITS OWN version range. */
export function getMiddlewarePackages(): Record<MiddlewarePreset, Record<string, string>> {
  const result: Record<MiddlewarePreset, Record<string, string>> = { minimal: {}, api: {}, full: {} };
  for (const preset of MIDDLEWARE_PRESETS) {
    for (const pkgName of MIDDLEWARE_PACKAGE_NAMES[preset]) {
      result[preset][pkgName] = getPackageRange(pkgName);
    }
  }
  return result;
}

/** Middleware import statements for template generation. */
export const MIDDLEWARE_IMPORTS: Record<MiddlewarePreset, string> = {
  minimal: '',
  api: [
    "import { cors } from '@nextrush/cors';",
    "import { json } from '@nextrush/body-parser';",
    "import { helmet } from '@nextrush/helmet';",
  ].join('\n'),
  full: [
    "import { cors } from '@nextrush/cors';",
    "import { json } from '@nextrush/body-parser';",
    "import { helmet } from '@nextrush/helmet';",
    "import { rateLimit } from '@nextrush/rate-limit';",
    "import { compression } from '@nextrush/compression';",
    "import { requestId } from '@nextrush/request-id';",
  ].join('\n'),
};

/** Middleware app.use() statements for template generation. */
export const MIDDLEWARE_SETUP: Record<MiddlewarePreset, string> = {
  minimal: '',
  api: ['app.use(cors());', 'app.use(helmet());', 'app.use(json());'].join('\n'),
  full: [
    'app.use(cors());',
    'app.use(helmet());',
    'app.use(json());',
    'app.use(rateLimit());',
    'app.use(compression());',
    'app.use(requestId());',
  ].join('\n'),
};

/** Adapter package name for each non-Node runtime (Node uses the built-in adapter). */
export const ADAPTER_PACKAGE_NAMES: Record<Runtime, string | undefined> = {
  node: undefined,
  bun: '@nextrush/adapter-bun',
  deno: '@nextrush/adapter-deno',
};

/** Adapter packages for non-Node runtimes, each resolved to ITS OWN version range. */
export function getAdapterPackages(): Record<Runtime, Record<string, string>> {
  const result: Record<Runtime, Record<string, string>> = { node: {}, bun: {}, deno: {} };
  for (const runtime of RUNTIMES) {
    const pkgName = ADAPTER_PACKAGE_NAMES[runtime];
    if (pkgName) {
      result[runtime][pkgName] = getPackageRange(pkgName);
    }
  }
  return result;
}

/** Valid npm package name pattern. */
export const PACKAGE_NAME_REGEX = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
