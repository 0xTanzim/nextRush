/**
 * Token-value check — asserts `global.css` defines the orange design-system
 * values from `DESIGN/TOKENS.md` §3–§4 (the re-themed spec, commit 7b952738).
 *
 * This is the verification gate for the CSS re-theme: it fails while the live
 * site still carries the blue Electric Rush values, and passes only when the
 * Foundation + Semantic layers match the spec. Values below are the spec's
 * single source of truth — do not edit them here; edit TOKENS.md first.
 *
 * The check reads the *definitions* of each token inside `global.css`
 * (`--token: value;`) and flags any that differ from the spec, are missing,
 * or still point at a retired blue hex.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TokenValueFinding {
  file: string;
  line: number;
  token: string;
  message: string;
}

/** Expected Foundation values (theme-independent), from TOKENS.md §3. */
const FOUNDATION: Record<string, string> = {
  '--brand-50': '#FFF2E6',
  '--brand-100': '#FFE0C2',
  '--brand-200': '#FFC48A',
  '--brand-300': '#FFA04D',
  '--brand-500': '#F16913',
  '--brand-600': '#DB5E10',
  '--brand-700': '#C5530E',
  '--ink-page': '#0D1117',
  '--ink-sidebar': '#111827',
  '--ink-card': '#161B22',
  '--ink-elevated': '#1B2432',
  '--ink-code': '#0A0F1C',
  // Learning hues — application moved to brand orange (§5).
  '--hue-learning-application-light': '#F16913',
  '--hue-learning-application-dark': '#FF8A34',
  '--hue-learning-middleware-light': '#7C3AED',
  '--hue-learning-middleware-dark': '#A78BFA',
  '--hue-learning-router-light': '#EA580C',
  '--hue-learning-router-dark': '#FB923C',
  '--hue-learning-context-light': '#0891B2',
  '--hue-learning-context-dark': '#22D3EE',
};

/** Expected Semantic values per theme, from TOKENS.md §4. */
const LIGHT_SEMANTIC: Record<string, string> = {
  '--surface-page': '#FFFCF8',
  '--surface-sidebar': '#FFFCF9',
  '--surface-card': 'var(--neutral-0)',
  '--surface-elevated': '#F7EDE1',
  '--surface-code': '#FBF3EA',
  '--ds-text-primary': '#2A1208',
  '--ds-text-secondary': '#4E4038',
  '--ds-text-muted': '#7A6A60',
  '--ds-text-subtle': '#B4A79C',
  '--border-subtle': '#F6EBDD',
  '--border-default': '#EFE3D7',
  '--border-strong': '#E0CCBA',
  '--border-interactive': '#8A7568',
  '--brand-link': '#BC4E08',
  '--brand-hover': '#8F3D08',
  '--brand-solid': '#C5530E',
  '--brand-focus': '#DB5E10',
};

const DARK_SEMANTIC: Record<string, string> = {
  '--surface-page': 'var(--ink-page)',
  '--surface-sidebar': 'var(--ink-sidebar)',
  '--surface-card': 'var(--ink-card)',
  '--surface-elevated': 'var(--ink-elevated)',
  '--surface-code': 'var(--ink-code)',
  '--ds-text-primary': '#F5F7FA',
  '--ds-text-secondary': '#D4D7DD',
  '--ds-text-muted': '#99A2AF',
  '--ds-text-subtle': '#6B7280',
  '--border-subtle': '#273142',
  '--border-default': '#303B4C',
  '--border-strong': '#3A4A63',
  '--border-interactive': '#64748B',
  '--brand-link': '#FF8A34',
  '--brand-hover': '#FFA25C',
  '--brand-solid': '#C5530E',
  '--brand-focus': '#F16913',
};

/** Normalize a CSS value: lowercase hex, strip whitespace, drop trailing ; */
function norm(v: string): string {
  return v.replace(/;\s*$/, '').trim().replace(/#([0-9a-f]{6})/gi, '#$1').toLowerCase();
}

/**
 * Extract `--token: value;` pairs from a CSS block (given a block name like
 * `:root`, `.light`, `.dark`). Returns a map of token → {value, line}.
 */
function extractBlock(raw: string, blockSelector: string): Map<string, { value: string; line: number }> {
  const out = new Map<string, { value: string; line: number }>();
  // Match `selector { ... }` — naive but fine for the flat token blocks here.
  const re = new RegExp(`${blockSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\}`, 'g');
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = re.exec(raw)) !== null) {
    const block = blockMatch[1];
    const tokenRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(block)) !== null) {
      const line = raw.slice(0, blockMatch.index + m.index).split('\n').length;
      out.set(m[1], { value: m[2], line });
    }
  }
  return out;
}

export function checkTokenValues(cssPath: string): TokenValueFinding[] {
  const findings: TokenValueFinding[] = [];
  const raw = readFileSync(cssPath, 'utf-8');
  const rel = join('apps/website/src/app', 'global.css');

  const root = extractBlock(raw, ':root');
  const light = extractBlock(raw, '.light');
  const dark = extractBlock(raw, '.dark');

  const check = (map: Map<string, { value: string; line: number }>, expected: Record<string, string>, scope: string) => {
    for (const [token, want] of Object.entries(expected)) {
      const got = map.get(token);
      if (!got) {
        findings.push({ file: rel, line: 0, token, message: `Missing ${scope} token ${token} (expected ${want}).` });
      } else if (norm(got.value) !== norm(want)) {
        findings.push({
          file: rel,
          line: got.line,
          token,
          message: `${scope} token ${token} is ${got.value} — expected ${want} (per TOKENS.md).`,
        });
      }
    }
  };

  check(root, FOUNDATION, 'Foundation');
  check(light, LIGHT_SEMANTIC, 'Light');
  check(dark, DARK_SEMANTIC, 'Dark');

  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const cssPath = join(__dirname, '../../src/app/global.css');
  const findings = checkTokenValues(cssPath);
  for (const f of findings) {
    console.log(`${f.file}${f.line ? ':' + f.line : ''} — [${f.token}] ${f.message}`);
  }
  console.log(`\n${findings.length} token-value finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}
