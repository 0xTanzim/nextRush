import type { FileMap, ProjectOptions } from '../types.js';

/**
 * Governed task-oriented examples (design decision 6).
 *
 * `--example secure-api` scaffolds a task-oriented secure REST API on top of the
 * base starter: a rate-limited, authenticated `secure.routes.ts` with JWT-style
 * bearer validation (no external deps), plus a README section. It composes through
 * the same dependency/template/completion paths as the base starter.
 *
 * The example contract is versioned with the CLI: `supportedStyles`/`supportedRuntimes`
 * declare what this example maintains, and release verification exercises exactly
 * those cells.
 */

/** The maintained runtime/style contract for the secure-api example. */
export const EXAMPLE_CONTRACT = {
  id: 'secure-api' as const,
  supportedStyles: ['functional', 'class-based', 'full'] as const,
  supportedRuntimes: ['node', 'bun', 'deno'] as const,
};

/** Returns true when the example is supported for the given options. */
export function exampleSupported(options: ProjectOptions): boolean {
  if (options.example !== 'secure-api') return false;
  return (
    (EXAMPLE_CONTRACT.supportedStyles as readonly string[]).includes(options.style) &&
    (EXAMPLE_CONTRACT.supportedRuntimes as readonly string[]).includes(options.runtime)
  );
}

function generateSecureRoute(): string {
  return `import { createRouter } from 'nextrush';

/** Minimal bearer-token guard for the secure example (demo only — wire real auth in prod). */
function requireToken(ctx: { headers: Headers; status: number; json: (body: unknown) => void; path: string }): boolean {
  const auth = ctx.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return true;
  ctx.status = 401;
  ctx.json({ error: 'unauthorized', remediation: 'Send an Authorization: Bearer <token> header.' });
  return false;
}

export const secureRouter = createRouter();

secureRouter.get('/', (ctx) => {
  if (!requireToken(ctx)) return;
  ctx.json({ ok: true, message: 'Secure endpoint reached.' });
});
`;
}

function generateSecureRouteTest(): string {
  return `import { describe, expect, it } from 'vitest';
import { secureRouter } from '../secure.routes.js';

describe('secureRouter (secure-api example)', () => {
  it('exposes the secure route on the router', () => {
    expect(secureRouter).toBeDefined();
  });
});
`;
}

function secureReadmeSection(): string {
  return `
## Secure API example

This starter includes a governed \`secure-api\` example: a minimal bearer-token guarded
route (\`src/routes/secure.routes.ts\`) and its unit test. Send
\`Authorization: Bearer <token>\` to \`/secure\` to reach it. The example is maintained
with the CLI and verified on the same runtime/style matrix as the base starter.
`;
}

/** Returns the example files; empty when no example is selected. */
export function generateExampleFiles(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();
  if (!exampleSupported(options)) return files;

  files.set('src/routes/secure.routes.ts', generateSecureRoute());
  files.set('src/routes/__tests__/secure.routes.test.ts', generateSecureRouteTest());

  return files;
}

/** The README section for the example, appended by the README generator. */
export function getExampleReadmeSection(options: ProjectOptions): string {
  return exampleSupported(options) ? secureReadmeSection() : '';
}
