/**
 * nextrush meta-package — createApp() container ownership
 *
 * The functional `nextrush` entry is DI-free: `createApp()` must NOT eagerly
 * import or attach a `@nextrush/di` container, otherwise importing `nextrush`
 * transitively loads `reflect-metadata` + tsyringe and defeats the
 * `nextrush` vs `nextrush/class` split (functional users pay a cost they never
 * asked for). See NEW-1 in docs/audits/class-based-master-audit.md.
 *
 * Container is bring-your-own via `options.container`. The class-based flow
 * (`registerControllers`) supplies the global `@nextrush/di` container fallback
 * itself (`options.container ?? app.container ?? globalContainer`), so class
 * users — who import `nextrush/class` — are unaffected.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContainer } from '@nextrush/di';
import { describe, expect, it } from 'vitest';
import { createApp } from '../index.js';

describe('createApp() container ownership', () => {
  it('leaves app.container undefined by default (DI-free functional path)', () => {
    const app = createApp();

    expect(app.container).toBeUndefined();
  });

  it('honors an explicitly passed container', () => {
    const custom = createContainer();

    const app = createApp({ container: custom });

    expect(app.container).toBe(custom);
  });

  it('does not statically import @nextrush/di (functional-path purity)', () => {
    const indexPath = fileURLToPath(new URL('../index.ts', import.meta.url));
    const source = readFileSync(indexPath, 'utf8');

    // A static `import ... from '@nextrush/di'` transitively loads
    // reflect-metadata + tsyringe. Prose mentions in docblocks are fine; only an
    // actual import defeats the functional/class split (NEW-1).
    expect(source).not.toMatch(/from\s+['"]@nextrush\/di['"]/);
  });
});
