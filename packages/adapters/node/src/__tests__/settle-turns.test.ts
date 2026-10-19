import { readFileSync } from 'node:fs';
import { SETTLE_TURNS } from '@nextrush/runtime';
import { describe, expect, it } from 'vitest';

const adapterSource = readFileSync(new URL('../adapter.ts', import.meta.url), 'utf8');

describe('Node adapter settle turns', () => {
  it('uses the runtime export instead of a local copy', () => {
    expect(SETTLE_TURNS).toBe(4);
    expect(adapterSource).not.toMatch(/const SETTLE_TURNS\s*=\s*\d/);
    expect(adapterSource).toMatch(/SETTLE_TURNS/);
  });
});
