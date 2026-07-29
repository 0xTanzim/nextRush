/**
 * Check 3 — Lint check.
 *
 * Three independent rules, all sourced from
 * `.kiro/steering/docs-standards.instructions.md`:
 *
 *  1. forbidden-words   — marketing/hedge words banned in prose (code blocks
 *                          and inline code are excluded before scanning).
 *  2. heading-intent     — generic, structure-not-intent H2/H3 headings
 *                          ("Details", "Overview", "More Information", ...).
 *  3. import-style       — code examples importing from the deprecated
 *                          `@nextrush/decorators` / `@nextrush/controllers`
 *                          packages instead of the consolidated `nextrush/class`.
 *
 * LIMITATION: import-style only flags import STATEMENTS textually — it does
 * not resolve whether the import is inside a "before" side of a migration
 * guide's before/after comparison (where showing the deprecated import is the
 * point). Migration/deprecation pages should expect findings here; that is
 * signal to be reviewed by a human, not a hard gate for those specific pages.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCodeBlocks, readMdxDocs, stripCode, type MdxDoc } from './lib/fs-walk.js';

export interface LintFinding {
  file: string;
  line: number;
  rule: 'forbidden-words' | 'heading-intent' | 'import-style';
  message: string;
}

// ---------------------------------------------------------------------------
// Rule 1 — forbidden words
// ---------------------------------------------------------------------------

export const FORBIDDEN_WORDS = [
  'simply',
  'just',
  'easy',
  'obviously',
  'straightforward',
  'powerful',
  'flexible',
  'robust',
  'enterprise-ready',
] as const;

function forbiddenWordsRegex(): RegExp {
  const escaped = FORBIDDEN_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function checkForbiddenWords(doc: MdxDoc): LintFinding[] {
  const findings: LintFinding[] = [];
  const prose = stripCode(doc.raw);
  const re = forbiddenWordsRegex();
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = re.exec(prose)) !== null) {
    const word = match[1].toLowerCase();
    const line = doc.raw.slice(0, match.index).split('\n').length;
    const key = `${word}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      file: doc.relativePath,
      line,
      rule: 'forbidden-words',
      message: `Forbidden word "${match[1]}"`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 2 — heading intent
// ---------------------------------------------------------------------------

const GENERIC_HEADINGS = new Set(
  [
    'details',
    'overview',
    'more information',
    'more info',
    'information',
    'misc',
    'miscellaneous',
    'notes',
    'other',
    'general',
  ].map((h) => h.toLowerCase())
);

function checkHeadingIntent(doc: MdxDoc): LintFinding[] {
  const findings: LintFinding[] = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(doc.raw)) !== null) {
    const heading = match[2].trim().toLowerCase();
    if (GENERIC_HEADINGS.has(heading)) {
      const line = doc.raw.slice(0, match.index).split('\n').length;
      findings.push({
        file: doc.relativePath,
        line,
        rule: 'heading-intent',
        message: `Generic heading "${match[2].trim()}" — describe intent, not structure`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 3 — import style (deprecated packages)
// ---------------------------------------------------------------------------

const DEPRECATED_IMPORT_RE = /from\s+['"](@nextrush\/(?:decorators|controllers))['"]/g;

function checkImportStyle(doc: MdxDoc): LintFinding[] {
  const findings: LintFinding[] = [];
  const blocks = extractCodeBlocks(doc.raw, ['ts', 'typescript', 'js', 'javascript']);
  for (const block of blocks) {
    const re = new RegExp(DEPRECATED_IMPORT_RE);
    let match: RegExpExecArray | null;
    while ((match = re.exec(block.code)) !== null) {
      const lineWithinBlock = block.code.slice(0, match.index).split('\n').length - 1;
      findings.push({
        file: doc.relativePath,
        line: block.startLine + lineWithinBlock,
        rule: 'import-style',
        message: `Imports from deprecated "${match[1]}" — use "nextrush/class" instead`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export function checkLint(contentRoot: string, docs: MdxDoc[] = readMdxDocs(contentRoot)): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const doc of docs) {
    findings.push(...checkForbiddenWords(doc));
    findings.push(...checkHeadingIntent(doc));
    findings.push(...checkImportStyle(doc));
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const contentRoot = join(__dirname, '../../content/docs');

  const findings = checkLint(contentRoot);
  for (const f of findings) {
    console.log(`${f.file}:${f.line} — [${f.rule}] ${f.message}`);
  }
  console.log(`\n${findings.length} lint finding(s).`);
  process.exit(0); // lint findings are warnings by default when run standalone
}
