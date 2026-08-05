/**
 * Check 6 — Design-token check.
 *
 * Enforces the design-system contract from `apps/website/DESIGN/TOKENS.md`
 * on the live site. Three independent rules:
 *
 *  1. no-literal-hex       — components under `src/` must consume Semantic
 *                            tokens (var(--surface-card), var(--brand-link)),
 *                            never a raw hex like `#f16913` or `#fff`. The
 *                            only place a literal hex may appear is
 *                            `global.css`'s Foundation/Semantic token
 *                            definitions themselves.
 *  2. no-handset-fd        — `--color-fd-*` must be *derived* from Semantic
 *                            tokens (TOKENS.md §6), never hand-set to a
 *                            literal hex inside `global.css`.
 *  3. no-blue-rush         — the blue Electric Rush identity is retired:
 *                            no `--rush-*` references and no Electric Rush
 *                            hexes (#3b82f6, #2563eb, #60a5fa, #1d4ed8,
 *                            #1e40af, #1e3a8a, #eff6ff, #dbeafe, #bfdbfe,
 *                            #93c5fd) anywhere in components or MDX.
 *
 * The token *values* themselves are verified separately (the token-value
 * check in `index.ts`) — this check guards *usage*.
 *
 * LIMITATION: this is a textual scan — it does not parse Tailwind class
 * semantics. A hex inside a Tailwind arbitrary value in a string is still
 * flagged (that's the point: components should use the token aliases).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFiles } from './lib/fs-walk.js';

export interface TokenFinding {
  file: string;
  line: number;
  rule: 'no-literal-hex' | 'no-handset-fd' | 'no-blue-rush' | 'learning-as-text';
  message: string;
}

// Electric Rush blue hexes (light ramp + semantic) that must not reappear.
const BLUE_RUSH_HEXES = new Set([
  '#3b82f6',
  '#2563eb',
  '#60a5fa',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
  '#172554',
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
]);

/**
 * Allowlist of intentional raw hexes that are NOT token violations:
 *  - `og/docs/[...slug]/route.tsx` uses `#f16913` as the brand mark in the
 *    generated OG image (the brand art itself, not a component surface).
 *  - `icons/package-manager-icons.tsx` hardcodes the third-party package
 *    managers' brand colors as SVG fills (pnpm/npm/yarn/bun marks) — those
 *    are literal brand logos, not design-system surfaces.
 *  - MDX reference pages' API tables show *color swatches* (e.g. status
 *    hues in `router.mdx`/`index.mdx`) — documentation OF colors, not
 *    component CSS.
 * Each entry is `file-suffix → set of allowed hexes` (case-insensitive).
 */
const LITERAL_HEX_ALLOWLIST: Record<string, Set<string>> = {
  'og/docs/[...slug]/route.tsx': new Set(['#f16913']),
  'src/components/logo.tsx': new Set(['#f16913', '#fee6ce']), // canonical brand mark fills
  'src/components/icons/package-manager-icons.tsx': new Set(['#f9ad00', '#fbf0df', '#febbd0', '#fff', '#c00', '#2c8ebb']),
  // Benchmark chart palettes (Okabe-Ito colorblind-safe data series) — these
  // are data-viz colors for competitor frameworks, not design-system surfaces.
  'src/components/mdx/doc-page.tsx': new Set(['#e69f00', '#56b4e9', '#009e73', '#d55e00', '#cc79a7', '#0072b2']),
  'src/components/mdx/benchmark-dashboard.tsx': new Set(['#e69f00', '#56b4e9', '#009e73', '#d55e00', '#cc79a7', '#0072b2']),
  // Package badges use AA-safe dark text shades of the learning/status accents
  // (the light learning hues fail 4.5:1 as small text — TOKENS.md §7).
  'src/components/packages/badges.tsx': new Set(['#057088', '#166534']),
  // MDX color-swatch documentation pages: only STATUS/NEUTRAL hexes are
  // allowed (they document the status palette). Brand blues (#3b82f6,
  // #2563eb, #1d4ed8) are NOT allowlisted — any occurrence is a live
  // diagram fill or stale brand reference and must be orange.
  '(core-routing)/router.mdx': new Set(['#fff', '#22c55e', '#16a34a', '#f59e0b', '#d97706', '#666']),
  'reference/index.mdx': new Set(['#fff', '#22c55e', '#16a34a', '#f59e0b', '#d97706', '#ec4899', '#db2777', '#666']),
  '(core-framework)/routing.mdx': new Set(['#fff', '#f59e0b', '#d97706']),
  'mounting-and-grouping-routes.mdx': new Set(['#fff', '#f59e0b', '#d97706']),
  'content/docs/index.mdx': new Set(['#fff', '#64748b', '#f59e0b', '#d97706', '#22c55e', '#16a34a', '#475569', '#666']),
  'content/docs/recipes/email/index.mdx': new Set(['#fff', '#475569', '#666']),
};

/** Git-short-SHA / non-color hexes that regex catches (e.g. "#8659" in code output). */
const NON_COLOR_HEX = new Set(['#8659']);

/**
 * Brand-orange + AA-shade hexes that are ALWAYS legitimate anywhere:
 * the orange identity ramp (#F16913/#DB5E10/#C5530E), the AA brand link
 * shades (#BC4E08/#8F3D08/#FF8A34/#FFA25C), and the AA-safe learning text
 * shades (#057088 dark-cyan, #166534 dark-green). These are the NEW brand —
 * not leaks to flag. Diagram fills, benchmark targets, and badge text use
 * them intentionally (Tailwind arbitrary values can't always be var()).
 */
const BRAND_ORANGE_HEXES = new Set([
  '#f16913',
  '#db5e10',
  '#c5530e',
  '#ff8a34',
  '#ffa25c',
  '#bc4e08',
  '#8f3d08',
  '#057088',
  '#166534',
]);

/** Whether a file's raw hex is allowlisted (by file-suffix match). */
function isAllowlistedHex(file: string, hex: string): boolean {
  const lower = hex.toLowerCase();
  for (const [suffix, allowed] of Object.entries(LITERAL_HEX_ALLOWLIST)) {
    if (file.endsWith(suffix)) {
      for (const a of allowed) if (a.toLowerCase() === lower) return true;
    }
  }
  return false;
}

/**
 * Classify whether a hex occurrence is a *design-system surface choice*
 * (violation) or *data / brand art* (allowed). The token rule exists so
 * components consume Semantic tokens for surfaces/text/borders; it is not
 * meant to force chart palettes, third-party brand marks, or status-data
 * constants through the token system.
 *
 * We approximate "styling context" by the 120 chars around the hex: if it
 * sits inside a `className`/`style`/CSS declaration we flag it; if it's a
 * bare data field (`color: '#...'` in a palette object, SVG `fill=`, a
 * standalone constant) we allow it.
 */
function isSurfaceHex(raw: string, index: number): boolean {
  const start = Math.max(0, index - 120);
  const end = Math.min(raw.length, index + 120);
  const ctx = raw.slice(start, end);
  // Styling contexts — flag these.
  if (/className|style=|\bstyle\b|background|border|color:\s*#/.test(ctx)) return true;
  // Data / brand-art contexts — allow these.
  if (/(color|fill|stroke):\s*'#/.test(ctx)) return false;
  if (/fill=|stroke=/.test(ctx)) return false;
  // Bare data-field hex (`color: '#E69F00'` in a palette object) — the
  // `color:` above catches it; otherwise default to flagging conservatively.
  return true;
}

/** Recursively collect every source file (tsx/ts/mdx/css) under a dir. */
function collectSources(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
    } else if (/\.(tsx|ts|mdx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Split file content into lines and return (line, text) for the given file. */
function linesOf(raw: string): Array<{ line: number; text: string }> {
  return raw.split('\n').map((text, i) => ({ line: i + 1, text }));
}

/** Find a regex match's 1-based line number within `raw`. */
function lineAt(raw: string, index: number): number {
  return raw.slice(0, index).split('\n').length;
}

/**
 * Check components + MDX for raw hex literals and retired rush/blue tokens.
 * `global.css` is excluded from the literal-hex rule (it defines the tokens).
 */
function checkComponentUsage(srcRoot: string, contentRoot: string): TokenFinding[] {
  const findings: TokenFinding[] = [];
  const targetDirs = [srcRoot, contentRoot];
  const scanned: string[] = [];

  for (const dir of targetDirs) {
    for (const abs of collectSources(dir)) {
      if (abs.endsWith('global.css')) continue;
      scanned.push(abs);
      const raw = readFileSync(abs, 'utf-8');
      const rel = relative(process.cwd(), abs);

      // Rule 1 — raw hex literals in components/content (surface contexts only).
      const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
      let m: RegExpExecArray | null;
      while ((m = hexRe.exec(raw)) !== null) {
        if (isAllowlistedHex(rel, m[0])) continue;
        if (NON_COLOR_HEX.has(m[0].toLowerCase())) continue;
        if (BRAND_ORANGE_HEXES.has(m[0].toLowerCase())) continue;
        if (!isSurfaceHex(raw, m.index)) continue;
        findings.push({
          file: rel,
          line: lineAt(raw, m.index),
          rule: 'no-literal-hex',
          message: `Raw hex "${m[0]}" in component/content — use a Semantic token (var(--surface-*), var(--text-*), var(--brand-*), var(--status-*)).`,
        });
      }

      // Rule 3 — retired rush/blue tokens.
      const rushRe = /--rush-[a-z-]+/g;
      while ((m = rushRe.exec(raw)) !== null) {
        findings.push({
          file: rel,
          line: lineAt(raw, m.index),
          rule: 'no-blue-rush',
          message: `Retired "--${m[0].slice(2)}" token — use the orange Semantic token instead.`,
        });
      }
      // Retired blue hexes — flagged in ANY file (components, content, MDX
      // diagram fills). The retired brand blues are never legitimate: a Mermaid
      // `fill:#3b82f6` is the NextRush node rendered as the old brand, and a
      // swatch-table occurrence is a stale reference. Only the explicit
      // allowlist entries (brand-art / data-viz) are exempt.
      for (const hex of BLUE_RUSH_HEXES) {
        let idx = raw.toLowerCase().indexOf(hex.toLowerCase());
        while (idx !== -1) {
          if (!isAllowlistedHex(rel, hex)) {
            findings.push({
              file: rel,
              line: lineAt(raw, idx),
              rule: 'no-blue-rush',
              message: `Electric Rush blue "${hex}" — use the orange identity tokens (diagram fills → #F16913 / #C5530E).`,
            });
          }
          idx = raw.toLowerCase().indexOf(hex.toLowerCase(), idx + 1);
        }
      }

      // Rule 4 — learning-token-as-text AA risk. Light learning hues that
      // FAIL 4.5:1 as small text (computed): application #F16913 3.10,
      // router #EA580C 3.56, context #0891B2 3.68, runtime #059669 3.77,
      // extension #CA8A04 2.94. Middleware #7C3AED 5.70 and di #9333EA 5.38
      // PASS — allowed. A text usage of a failing hue (the light value) is a
      // violation; icon elements (lucide icons, aria-hidden) are non-text
      // and exempt.
      const FAILING_LEARNING_AS_TEXT = new Set(['application', 'router', 'context', 'runtime', 'extension']);
      // Match the LIGHT-theme text usage only: the light text class is NOT
      // preceded by `dark:` (the dark value is AA-safe at or above 7:1).
      const learningTextRe = /(?<!dark:)text-\[var\(--learning-([a-z-]+)\)\]/g;
      while ((m = learningTextRe.exec(raw)) !== null) {
        const hue = m[1];
        if (!FAILING_LEARNING_AS_TEXT.has(hue)) continue;
        const lineStart = raw.lastIndexOf('\n', m.index - 1) + 1;
        const lineEnd = raw.indexOf('\n', m.index);
        const line = raw.slice(lineStart, lineEnd === -1 ? raw.length : lineEnd);
        // Icon elements carry no text content — skip.
        if (/<(Sparkles|Package|Rocket|Folder|FolderOpen|FileCode|Star|Shield|Globe|Puzzle|Lock|Zap|AlertTriangle|Check|X|ChevronRight|ArrowRight|Icon)\b/.test(line)) continue;
        findings.push({
          file: rel,
          line: lineAt(raw, m.index),
          rule: 'learning-as-text',
          message: `Learning token "--learning-${hue}" used as text — light hue fails 4.5:1 as small text (${hue === 'application' ? '3.10' : hue === 'router' ? '3.56' : hue === 'context' ? '3.68' : hue === 'runtime' ? '3.77' : '2.94'}:1); use a dark shade (e.g. #057088) or --text-secondary.`,
        });
      }
    }
  }

  return findings;
}

/**
 * Check global.css for hand-set --color-fd-* values (must derive from
 * Semantic tokens, TOKENS.md §6) and any remaining --rush-* definitions.
 */
function checkGlobalCss(cssPath: string): TokenFinding[] {
  const findings: TokenFinding[] = [];
  const raw = readFileSync(cssPath, 'utf-8');
  const rel = relative(process.cwd(), cssPath);

  const fdRe = /--color-fd-[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|color-mix\([^)]*#[0-9a-fA-F])/g;
  let m: RegExpExecArray | null;
  while ((m = fdRe.exec(raw)) !== null) {
    findings.push({
      file: rel,
      line: lineAt(raw, m.index),
      rule: 'no-handset-fd',
      message: `Hand-set --color-fd-* value — derive from a Semantic token instead (TOKENS.md §6).`,
    });
  }

  const rushRe = /--rush-[a-z-]+\s*:/g;
  while ((m = rushRe.exec(raw)) !== null) {
    findings.push({
      file: rel,
      line: lineAt(raw, m.index),
      rule: 'no-blue-rush',
      message: `Retired "--${m[0].slice(2)}" definition remains in global.css — remove or re-point to the orange ramp.`,
    });
  }

  return findings;
}

export function checkTokens(
  srcRoot: string,
  contentRoot: string,
  cssPath: string
): TokenFinding[] {
  return [...checkComponentUsage(srcRoot, contentRoot), ...checkGlobalCss(cssPath)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const appRoot = join(__dirname, '../..');
  const srcRoot = join(appRoot, 'src');
  const contentRoot = join(appRoot, 'content/docs');
  const cssPath = join(appRoot, 'src/app/global.css');

  const findings = checkTokens(srcRoot, contentRoot, cssPath);
  for (const f of findings) {
    console.log(`${f.file}:${f.line} — [${f.rule}] ${f.message}`);
  }
  console.log(`\n${findings.length} token finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}
