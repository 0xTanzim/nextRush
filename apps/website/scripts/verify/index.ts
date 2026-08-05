#!/usr/bin/env node
/**
 * NextRush docs verification harness — `pnpm docs:verify`.
 *
 * Runs all 4 checks (see README section "Verification harness" for the full
 * writeup of what each one does and its limitations) and prints one
 * consolidated report. Exit code is 0 only if every check has zero findings;
 * this is what CI should gate a docs PR on (PLAN.md T2 / T22).
 *
 * Checks:
 *   1. link-check        — internal /docs/* links resolve to a real page
 *   2. compile-check      — sampled ts/typescript code blocks typecheck for real
 *   3. lint-check          — forbidden words, generic headings, deprecated imports
 *   4. reference-match    — hand-written signatures exist in source (name-only, static)
 *   5. i18n-freshness      — localized pages older than their English source (stub until
 *                            a non-default locale is configured — see design.md D8)
 *   6. token-check         — no raw hex in components, no hand-set --color-fd-*, no blue rush
 *   7. token-values        — live global.css token values match DESIGN/TOKENS.md (orange spec)
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks } from './link-check.js';
import { checkCompile } from './compile-check.js';
import { checkLint } from './lint-check.js';
import { checkReferenceMatch } from './reference-match.js';
import { checkTranslationFreshness } from './i18n-freshness-check.js';
import { checkTokens } from './token-check.js';
import { checkTokenValues } from './token-values.js';
import { readMdxDocs } from './lib/fs-walk.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(__dirname, '../../content/docs');
const packagesRoot = join(__dirname, '../../../../packages');
const appRoot = join(__dirname, '../..');
const srcRoot = join(appRoot, 'src');
const cssPath = join(appRoot, 'src/app/global.css');

function section(title: string): void {
  console.log('\n' + '─'.repeat(70));
  console.log(title);
  console.log('─'.repeat(70));
}

async function main(): Promise<void> {
  const docs = readMdxDocs(contentRoot);
  let totalFindings = 0;

  section('1. Internal link check');
  const linkFindings = checkLinks(contentRoot, docs);
  for (const f of linkFindings) console.log(`  ✗ ${f.file}:${f.line} — ${f.reason} (${f.link})`);
  console.log(linkFindings.length === 0 ? '  ✓ No broken internal links.' : `  ${linkFindings.length} broken link(s).`);
  totalFindings += linkFindings.length;

  section('2. Code-example compile check (sampled)');
  const compileFindings = checkCompile({ contentRoot, packagesRoot });
  for (const f of compileFindings) console.log(`  ✗ ${f.file}:${f.startLine} — ${f.message}`);
  console.log(
    compileFindings.length === 0
      ? '  ✓ All sampled code examples typecheck.'
      : `  ${compileFindings.length} compile finding(s).`
  );
  totalFindings += compileFindings.length;

  section('3. Lint check (forbidden words, heading intent, import style)');
  const lintFindings = checkLint(contentRoot, docs);
  for (const f of lintFindings) console.log(`  ⚠ ${f.file}:${f.line} — [${f.rule}] ${f.message}`);
  console.log(lintFindings.length === 0 ? '  ✓ No lint findings.' : `  ${lintFindings.length} lint finding(s).`);
  totalFindings += lintFindings.length;

  section('4. Reference-match check (signature name existence, static)');
  const referenceFindings = checkReferenceMatch(contentRoot, packagesRoot, docs);
  for (const f of referenceFindings) console.log(`  ✗ ${f.file}:${f.line} — ${f.message}`);
  console.log(
    referenceFindings.length === 0
      ? '  ✓ All documented signatures resolve to real exports.'
      : `  ${referenceFindings.length} reference-match finding(s).`
  );
  totalFindings += referenceFindings.length;

  section('5. Translation-freshness check (stub — no non-default locale configured yet)');
  const i18nFindings = checkTranslationFreshness(contentRoot, docs);
  for (const f of i18nFindings) console.log(`  ✗ ${f.file} [${f.locale}] — ${f.reason}`);
  console.log(
    i18nFindings.length === 0
      ? '  ✓ No stale translations (or no non-default locale configured yet).'
      : `  ${i18nFindings.length} translation-freshness finding(s).`
  );
  totalFindings += i18nFindings.length;

  section('6. Design-token check (no raw hex in components, no hand-set fd, no blue rush)');
  const tokenFindings = checkTokens(srcRoot, contentRoot, cssPath);
  for (const f of tokenFindings) console.log(`  ✗ ${f.file}:${f.line} — [${f.rule}] ${f.message}`);
  console.log(tokenFindings.length === 0 ? '  ✓ No token-usage findings.' : `  ${tokenFindings.length} token finding(s).`);
  totalFindings += tokenFindings.length;

  section('7. Token-value check (live CSS matches DESIGN/TOKENS.md orange spec)');
  const valueFindings = checkTokenValues(cssPath);
  for (const f of valueFindings) console.log(`  ✗ ${f.file}${f.line ? ':' + f.line : ''} — [${f.token}] ${f.message}`);
  console.log(valueFindings.length === 0 ? '  ✓ Token values match the orange spec.' : `  ${valueFindings.length} token-value finding(s).`);
  totalFindings += valueFindings.length;

  console.log('\n' + '═'.repeat(70));
  console.log(`  TOTAL FINDINGS: ${totalFindings}`);
  console.log('═'.repeat(70) + '\n');

  process.exit(totalFindings > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('docs:verify crashed:', err);
  process.exit(1);
});
