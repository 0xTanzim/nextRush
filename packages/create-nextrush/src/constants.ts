import type { MiddlewarePreset, Runtime, Style } from './types.js';

export const NEXTRUSH_VERSION = '3.0.1';

export const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];
export const RUNTIMES: readonly Runtime[] = ['node', 'bun', 'deno'];
export const MIDDLEWARE_PRESETS: readonly MiddlewarePreset[] = ['minimal', 'api', 'full'];

export const DEFAULT_STYLE: Style = 'functional';
export const DEFAULT_RUNTIME: Runtime = 'node';
export const DEFAULT_MIDDLEWARE: MiddlewarePreset = 'api';

/** Middleware packages for each preset tier. */
export const MIDDLEWARE_PACKAGES: Record<MiddlewarePreset, Record<string, string>> = {
  minimal: {},
  api: {
    '@nextrush/cors': `^${NEXTRUSH_VERSION}`,
    '@nextrush/body-parser': `^${NEXTRUSH_VERSION}`,
    '@nextrush/helmet': `^${NEXTRUSH_VERSION}`,
  },
  full: {
    '@nextrush/cors': `^${NEXTRUSH_VERSION}`,
    '@nextrush/body-parser': `^${NEXTRUSH_VERSION}`,
    '@nextrush/helmet': `^${NEXTRUSH_VERSION}`,
    '@nextrush/rate-limit': `^${NEXTRUSH_VERSION}`,
    '@nextrush/compression': `^${NEXTRUSH_VERSION}`,
    '@nextrush/request-id': `^${NEXTRUSH_VERSION}`,
  },
};

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

/** Adapter packages for non-Node runtimes. */
export const ADAPTER_PACKAGES: Record<Runtime, Record<string, string>> = {
  node: {},
  bun: { '@nextrush/adapter-bun': `^${NEXTRUSH_VERSION}` },
  deno: { '@nextrush/adapter-deno': `^${NEXTRUSH_VERSION}` },
};

/** Valid npm package name pattern. */
export const PACKAGE_NAME_REGEX = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
