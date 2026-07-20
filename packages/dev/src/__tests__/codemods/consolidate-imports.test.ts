import { describe, it, expect } from 'vitest';
import { consolidateImports } from '../../codemods/consolidate-imports.js';

describe('consolidateImports', () => {
  // ─── (a) Single @nextrush/decorators -> nextrush/class ─────────────────

  it('rewrites single @nextrush/decorators import to nextrush/class', () => {
    const input = `import { Controller, Get } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toBe(`import { Controller, Get } from 'nextrush/class';`);
  });

  // ─── (b) Single @nextrush/controllers -> nextrush/class ────────────────

  it('rewrites single @nextrush/controllers import to nextrush/class', () => {
    const input = `import { registerControllers } from '@nextrush/controllers';`;
    const output = consolidateImports(input);
    expect(output).toBe(`import { registerControllers } from 'nextrush/class';`);
  });

  // ─── (c) BOTH in one file -> merged single nextrush/class ──────────────

  it('merges @nextrush/decorators and @nextrush/controllers into one nextrush/class import', () => {
    const input = `import { Controller, Get } from '@nextrush/decorators';
import { registerControllers } from '@nextrush/controllers';`;
    const output = consolidateImports(input);
    // Should be one merged import with deduped, sorted names
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).not.toContain(`@nextrush/decorators`);
    expect(output).not.toContain(`@nextrush/controllers`);
    // All imports should be present
    expect(output).toContain('Controller');
    expect(output).toContain('Get');
    expect(output).toContain('registerControllers');
  });

  // ─── (d) import type preserved ───────────────────────────────────────

  it('preserves import type keyword', () => {
    const input = `import type { GuardContext } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain('import type');
    expect(output).toContain(`from 'nextrush/class'`);
  });

  it('preserves import type when mixed with value imports from same source', () => {
    const input = `import { Controller } from '@nextrush/decorators';
import type { CanActivate } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    // Value imports become regular import, type imports as import type
    expect(output).toContain('import {');
    expect(output).toContain('Controller');
    expect(output).toContain('nextrush/class');
  });

  // ─── (e) Aliased import preserved ────────────────────────────────────

  it('preserves aliased imports (X as Y)', () => {
    const input = `import { Controller as Ctrl } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain('Controller as Ctrl');
    expect(output).toContain(`from 'nextrush/class'`);
  });

  // ─── (f) @nextrush/di import left untouched ──────────────────────────

  it('leaves @nextrush/di imports untouched', () => {
    const input = `import { Service } from '@nextrush/di';
import { Controller } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain(`import { Service } from '@nextrush/di';`);
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).toContain('Controller');
  });

  // ─── (g) IDEMPOTENT ─────────────────────────────────────────────────

  it('is idempotent (second run produces no further change)', () => {
    const input = `import { Controller, Get } from '@nextrush/decorators';`;
    const once = consolidateImports(input);
    const twice = consolidateImports(once);
    expect(twice).toBe(once);
  });

  it('is idempotent with merged imports', () => {
    const input = `import { Controller, Get } from '@nextrush/decorators';
import { registerControllers } from '@nextrush/controllers';`;
    const once = consolidateImports(input);
    const twice = consolidateImports(once);
    expect(twice).toBe(once);
  });

  // ─── (h) Already consolidated merges cleanly ───────────────────────

  it('merges cleanly when a file already imports from nextrush/class', () => {
    const input = `import { Controller } from 'nextrush/class';
import { Get } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).toContain('Controller');
    expect(output).toContain('Get');
    expect(output).not.toContain(`@nextrush/decorators`);
  });

  // ─── Multi-line imports ──────────────────────────────────────────────

  it('handles multi-line imports', () => {
    const input = `import {
  Controller,
  Get,
  Post,
} from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).toContain('Controller');
    expect(output).toContain('Get');
    expect(output).toContain('Post');
  });

  // ─── Deduplication ──────────────────────────────────────────────────

  it('deduplicates identical imports from different sources', () => {
    const input = `import { Controller } from '@nextrush/decorators';
import { Controller } from '@nextrush/controllers';`;
    const output = consolidateImports(input);
    const matches = output.match(/Controller/g);
    // Should only have one Controller in the import
    expect(matches?.length).toBe(1);
  });

  it('sorts imports alphabetically', () => {
    const input = `import { Zebra, Apple, Monkey } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    const appleIdx = output.indexOf('Apple');
    const monkeyIdx = output.indexOf('Monkey');
    const zebraIdx = output.indexOf('Zebra');
    expect(appleIdx).toBeLessThan(monkeyIdx);
    expect(monkeyIdx).toBeLessThan(zebraIdx);
  });

  // ─── No change for unrelated imports ─────────────────────────────────

  it('leaves unrelated imports untouched', () => {
    const input = `import { foo } from 'some-library';
import { Controller } from '@nextrush/decorators';`;
    const output = consolidateImports(input);
    expect(output).toContain(`import { foo } from 'some-library';`);
    expect(output).toContain(`from 'nextrush/class'`);
  });

  // ─── Real-world example ──────────────────────────────────────────────

  it('handles real-world controller file', () => {
    const input = `import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuard,
} from '@nextrush/decorators';
import { registerControllers } from '@nextrush/controllers';
import type { Context } from 'nextrush';
import { Service } from '@nextrush/di';

@Controller('/users')
export class UserController {}`;
    const output = consolidateImports(input);
    expect(output).not.toContain(`@nextrush/decorators`);
    expect(output).not.toContain(`@nextrush/controllers`);
    expect(output).toContain(`import { Service } from '@nextrush/di';`);
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).toContain('Body');
    expect(output).toContain('registerControllers');
    expect(output).toContain('Delete');
  });

  // ─── (F-09) Header comment + non-target imports preserved in place ───

  it('preserves a leading license/header comment above the imports (F-09)', () => {
    const input = `/* @license MIT */
import { Get } from '@nextrush/decorators';
import { Controller } from '@nextrush/controllers';

export class X {}`;
    const output = consolidateImports(input);
    // Header stays at the very top — not relocated below the consolidated import.
    expect(output.startsWith('/* @license MIT */')).toBe(true);
    expect(output).toContain(`from 'nextrush/class'`);
    expect(output).not.toContain('@nextrush/decorators');
    expect(output.trimEnd().endsWith('export class X {}')).toBe(true);
  });
});
