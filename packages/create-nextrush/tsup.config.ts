import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../../');

/** Read a workspace package's version from its own package.json. */
function readVer(...segments: string[]): string {
  try {
    return JSON.parse(readFileSync(join(ROOT, ...segments, 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

// Every @nextrush/* (+ nextrush) package this scaffolder can emit into a generated
// package.json, mapped to its OWN workspace directory. Read independently — NOT proxied
// through one shared "core"/"mw" scalar (see RFC-021 / ADR-0011: the changeset `fixed`
// group deliberately excludes most of these; @nextrush/dev, the middleware packages, and
// the bun/deno adapters version independently of `nextrush`).
const PACKAGE_VERSION_SOURCES: Record<string, string[]> = {
  nextrush: ['packages', 'nextrush'],
  '@nextrush/types': ['packages', 'types'],
  '@nextrush/class': ['packages', 'class'],
  '@nextrush/dev': ['packages', 'dev'],
  '@nextrush/cors': ['packages', 'middleware', 'cors'],
  '@nextrush/body-parser': ['packages', 'middleware', 'body-parser'],
  '@nextrush/helmet': ['packages', 'middleware', 'helmet'],
  '@nextrush/rate-limit': ['packages', 'middleware', 'rate-limit'],
  '@nextrush/compression': ['packages', 'middleware', 'compression'],
  '@nextrush/request-id': ['packages', 'middleware', 'request-id'],
  '@nextrush/adapter-bun': ['packages', 'adapters', 'bun'],
  '@nextrush/adapter-deno': ['packages', 'adapters', 'deno'],
};

// Build-time-injected per-package fallback map (used only when a live registry probe fails
// or times out — see npm-version.ts). Every entry is this package's OWN resolved version,
// never a proxy for another package's version.
const FALLBACK_VERSIONS: Record<string, string> = {};
for (const [pkgName, segments] of Object.entries(PACKAGE_VERSION_SOURCES)) {
  FALLBACK_VERSIONS[pkgName] = '^' + readVer(...segments);
}

// create-nextrush's own toolchain devDependency versions, single-sourced into the
// generated project (see task 5.3 / F-07): typescript / @types/node must not drift from
// what this scaffolder itself uses and tests against.
const OWN_PKG_JSON = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as {
  version: string;
  devDependencies: Record<string, string>;
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  sourcemap: true,
  splitting: false,
  define: {
    __VERSION__: JSON.stringify(OWN_PKG_JSON.version),
    __FALLBACK_VERSIONS__: JSON.stringify(FALLBACK_VERSIONS),
    __TYPESCRIPT_RANGE__: JSON.stringify(OWN_PKG_JSON.devDependencies['typescript'] ?? '^5.0.0'),
    __TYPES_NODE_RANGE__: JSON.stringify(OWN_PKG_JSON.devDependencies['@types/node'] ?? '^22.0.0'),
    __VITEST_RANGE__: JSON.stringify(OWN_PKG_JSON.devDependencies['vitest'] ?? '^3.0.0'),
  },
});
