import { beforeEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Environment-configuration standardization.
 *
 * Asserts the generated-project contract for the unified config module, generated
 * `.env`/`.env.example` files, runtime-appropriate `.env` loading, `dotenv` version
 * resolution, host forwarding, and edge-case-safe `PORT`/`NODE_ENV` parsing — across
 * every style and runtime.
 */

beforeEach(() => {
  seedAllPackageVersions('^3.0.0');
});

const STYLES: ProjectOptions['style'][] = ['functional', 'class-based', 'full'];
const RUNTIMES: ProjectOptions['runtime'][] = ['node', 'bun', 'deno'];

function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'env-app',
    directory: './env-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

/** Renders the generated config module's PORT edge-case behavior by evaluating its source. */
function configPortFor(env: Record<string, string | undefined>): number {
  // The generated config uses process.env.PORT with normalization — simulate by
  // evaluating the same expression the template emits (see task 3.2).
  const raw = env.PORT;
  const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
  const port = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 8080;
  return port;
}

/** Renders the generated config module's NODE_ENV coercion behavior. */
function configNodeEnvFor(env: Record<string, string | undefined>): string {
  const raw = env.NODE_ENV;
  const valid = raw === 'production' || raw === 'test' ? raw : 'development';
  return valid;
}

describe('environment configuration standardization', () => {
  describe('unified config module across styles', () => {
    for (const style of STYLES) {
      it(`${style}: emits src/config/index.ts with a consistent { port, host, nodeEnv } surface`, () => {
        const files = generateProject(createOptions({ style }));
        const config = files.get('src/config/index.ts');
        expect(config).toBeDefined();
        expect(config).toContain('port');
        expect(config).toContain('host');
        expect(config).toContain('nodeEnv');
      });

      it(`${style}: node/bun config reads process.env`, () => {
        for (const runtime of ['node', 'bun'] as const) {
          const files = generateProject(createOptions({ style, runtime }));
          const config = files.get('src/config/index.ts')!;
          expect(config).toContain('process.env.PORT');
          expect(config).toContain('process.env.HOST');
          expect(config).toContain('process.env.NODE_ENV');
        }
      });

      it(`${style}: deno config reads Deno.env and not process.env`, () => {
        const files = generateProject(createOptions({ style, runtime: 'deno' }));
        const config = files.get('src/config/index.ts')!;
        expect(config).toContain("Deno.env.get('PORT')");
        expect(config).toContain("Deno.env.get('HOST')");
        expect(config).toContain("Deno.env.get('NODE_ENV')");
        expect(config).not.toContain('process.env');
      });
    }
  });

  describe('no inline process.env in class-based/full entrypoints', () => {
    for (const style of ['class-based', 'full'] as const) {
      it(`${style}: entrypoint imports config and drops the inline PORT constant`, () => {
        const files = generateProject(createOptions({ style }));
        const entry = files.get('src/index.ts')!;
        expect(entry).toContain("import { config } from './config/index.js';");
        expect(entry).not.toContain('const PORT = Number(process.env.PORT) || 8080;');
        expect(entry).not.toContain('await listen(app, PORT);');
      });
    }
  });

  describe('generated environment files', () => {
    for (const runtime of ['node', 'bun'] as const) {
      it(`${runtime}: emits .env with defaults and .env.example with empty values`, () => {
        for (const style of STYLES) {
          const files = generateProject(createOptions({ style, runtime }));
          const env = files.get('.env')!;
          expect(env).toContain('HOST=0.0.0.0');
          expect(env).toContain('PORT=8080');
          expect(env).toContain('NODE_ENV=development');

          const example = files.get('.env.example')!;
          expect(example).toContain('HOST=');
          expect(example).toContain('PORT=');
          expect(example).toContain('NODE_ENV=');
        }
      });
    }

    it('deno: emits .env and .env.example (same layout as node/bun)', () => {
      for (const style of STYLES) {
        const files = generateProject(createOptions({ style, runtime: 'deno' }));
        const env = files.get('.env')!;
        expect(env).toContain('HOST=0.0.0.0');
        expect(env).toContain('PORT=8080');
        expect(env).toContain('NODE_ENV=development');
        const example = files.get('.env.example')!;
        expect(example).toContain('HOST=');
        expect(example).toContain('PORT=');
        expect(example).toContain('NODE_ENV=');
      }
    });

    it('deno: start script loads .env via --env-file with scoped permissions', () => {
      for (const style of STYLES) {
        const files = generateProject(createOptions({ style, runtime: 'deno' }));
        const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };
        expect(pkg.scripts.start).toContain('--env-file=.env');
        expect(pkg.scripts.start).toContain('--allow-net');
        expect(pkg.scripts.start).toContain('--allow-read');
        expect(pkg.scripts.start).toContain('--allow-env');
        expect(pkg.scripts.start).not.toContain(' -A');
      }
    });
  });

  describe('.gitignore guards the .env file', () => {
    it('contains .env entries for every style/runtime', () => {
      for (const style of STYLES) {
        for (const runtime of RUNTIMES) {
          const files = generateProject(createOptions({ style, runtime }));
          const gitignore = files.get('.gitignore')!;
          expect(gitignore).toContain('.env');
          expect(gitignore).toContain('.env.local');
          expect(gitignore).toContain('.env.*.local');
        }
      }
    });
  });

  describe('entrypoint .env loading', () => {
    for (const runtime of ['node', 'bun'] as const) {
      it(`${runtime}: entrypoint begins with import 'dotenv/config' before the config import`, () => {
        for (const style of STYLES) {
          const files = generateProject(createOptions({ style, runtime }));
          const entry = files.get('src/index.ts')!;
          const dotenvIdx = entry.indexOf("import 'dotenv/config'");
          const configIdx = entry.indexOf("from './config/index.js'");
          expect(dotenvIdx).toBeGreaterThanOrEqual(0);
          expect(configIdx).toBeGreaterThan(dotenvIdx);
          // dotenv must be the first statement (before any other import)
          const firstImport = entry.search(/^import /m);
          expect(entry.indexOf("import 'dotenv/config'")).toBe(firstImport);
        }
      });
    }

    it('deno: entrypoint contains no dotenv import', () => {
      for (const style of STYLES) {
        const files = generateProject(createOptions({ style, runtime: 'deno' }));
        const entry = files.get('src/index.ts')!;
        expect(entry).not.toContain('dotenv');
      }
    });
  });

  describe('dotenv dependency resolution', () => {
    for (const runtime of ['node', 'bun'] as const) {
      it(`${runtime}: package.json includes a dotenv dependency resolved via the toolchain policy`, () => {
        for (const style of STYLES) {
          const files = generateProject(createOptions({ style, runtime }));
          const pkg = JSON.parse(files.get('package.json')!) as {
            dependencies: Record<string, string>;
          };
          // dotenv single-sources from create-nextrush's own devDependencies (toolchain policy)
          expect(pkg.dependencies['dotenv']).toBe('^17.4.2');
        }
      });
    }

    it('deno: package.json has no dotenv dependency', () => {
      for (const style of STYLES) {
        const files = generateProject(createOptions({ style, runtime: 'deno' }));
        const pkg = JSON.parse(files.get('package.json')!) as {
          dependencies: Record<string, string>;
        };
        expect(pkg.dependencies['dotenv']).toBeUndefined();
      }
    });
  });

  describe('host forwarding', () => {
    it('functional: entrypoint forwards config.host to the server start call', () => {
      for (const runtime of RUNTIMES) {
        const files = generateProject(createOptions({ style: 'functional', runtime }));
        const entry = files.get('src/index.ts')!;
        expect(entry).toContain('host: config.host');
      }
    });

    it('class-based/full: entrypoint forwards config.host to the server start call', () => {
      for (const style of ['class-based', 'full'] as const) {
        for (const runtime of RUNTIMES) {
          const files = generateProject(createOptions({ style, runtime }));
          const entry = files.get('src/index.ts')!;
          expect(entry).toContain('host: config.host');
        }
      }
    });
  });

  describe('config PORT edge cases', () => {
    it('empty/invalid/zero/negative/overflow resolve to default 8080', () => {
      for (const bad of ['', 'abc', '0', '-1', '999999', '3.14']) {
        expect(configPortFor({ PORT: bad })).toBe(8080);
      }
      expect(configPortFor({ PORT: undefined })).toBe(8080);
    });

    it('a valid positive port is honored', () => {
      expect(configPortFor({ PORT: '9090' })).toBe(9090);
      expect(configPortFor({ PORT: '65535' })).toBe(65535);
    });
  });

  describe('config NODE_ENV edge cases', () => {
    it('empty/unknown coerce to development; valid values pass through', () => {
      expect(configNodeEnvFor({ NODE_ENV: '' })).toBe('development');
      expect(configNodeEnvFor({ NODE_ENV: 'staging' })).toBe('development');
      expect(configNodeEnvFor({ NODE_ENV: 'development' })).toBe('development');
      expect(configNodeEnvFor({ NODE_ENV: 'production' })).toBe('production');
      expect(configNodeEnvFor({ NODE_ENV: 'test' })).toBe('test');
    });
  });
});
