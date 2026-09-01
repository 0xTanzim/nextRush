import { describe, expect, it } from 'vitest';
import { parseFlags } from '../migrate-github-releases.js';

describe('parseFlags — migration safety gating', () => {
  it('defaults to DRY RUN (apply=false) with no flags', () => {
    const flags = parseFlags([]);
    expect(flags.apply).toBe(false);
    expect(flags.yes).toBe(false);
    expect(flags.repo).toBe('0xTanzim/nextrush');
  });

  it('--apply is the ONLY flag that enables mutation', () => {
    expect(parseFlags(['--apply']).apply).toBe(true);
    expect(parseFlags(['--yes']).apply).toBe(false);
    expect(parseFlags(['--repo', 'acme/app']).apply).toBe(false);
  });

  it('--yes skips the confirmation prompt (only meaningful together with --apply)', () => {
    const flags = parseFlags(['--apply', '--yes']);
    expect(flags.apply).toBe(true);
    expect(flags.yes).toBe(true);
  });

  it('supports both --repo=owner/repo and --repo owner/repo forms', () => {
    expect(parseFlags(['--repo=acme/app']).repo).toBe('acme/app');
    expect(parseFlags(['--repo', 'acme/app']).repo).toBe('acme/app');
  });

  it('ignores unknown flags without error', () => {
    expect(parseFlags(['--help', '--verbose']).apply).toBe(false);
  });
});
