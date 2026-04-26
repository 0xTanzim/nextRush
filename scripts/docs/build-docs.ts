#!/usr/bin/env node
/**
 * NextRush Documentation Build-Time Validator
 *
 * Scans all MDX files in content/docs/, validates against the documentation
 * contract (tier-based sections, word budgets, forbidden words, frontmatter).
 *
 * Usage:
 *   node --import tsx scripts/docs/build-docs.ts [--strict]
 *
 * Flags:
 *   --strict   Exit with code 1 on any violation (for CI enforcement)
 *              Default: warnings-only mode (exit 0)
 *
 * Exit codes:
 *   0 — All checks passed (or warnings-only mode)
 *   1 — Violations found in strict mode
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildForbiddenRegex,
  classifyTier,
  getRequiredSections,
  getWordBudget,
  REQUIRED_FRONTMATTER,
  type Tier,
} from './contracts.js';
import { scanMdxFiles, type MdxFile } from './mdx-scan.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateFrontmatter(file: MdxFile): Violation[] {
  const violations: Violation[] = [];

  for (const field of REQUIRED_FRONTMATTER) {
    if (!file.frontmatter[field]) {
      violations.push({
        file: file.relativePath,
        rule: 'frontmatter',
        message: `Missing required frontmatter field: "${field}"`,
        severity: 'error',
      });
    }
  }

  return violations;
}

function validateSections(file: MdxFile, tier: Tier): Violation[] {
  const violations: Violation[] = [];
  const required = getRequiredSections(tier);
  const headingSet = new Set(file.h2Headings.map((h) => h.toLowerCase()));

  for (const section of required) {
    if (!headingSet.has(section.toLowerCase())) {
      violations.push({
        file: file.relativePath,
        rule: `tier-${tier}-sections`,
        message: `Missing required section "## ${section}" (Tier ${tier})`,
        severity: 'warning',
      });
    }
  }

  return violations;
}

function validateWordBudget(file: MdxFile, tier: Tier): Violation[] {
  const violations: Violation[] = [];
  const budget = getWordBudget(tier);

  if (file.wordCount < budget.min) {
    violations.push({
      file: file.relativePath,
      rule: 'word-budget',
      message: `Word count ${file.wordCount} is below minimum ${budget.min} for Tier ${tier}`,
      severity: 'warning',
    });
  }

  if (file.wordCount > budget.max) {
    violations.push({
      file: file.relativePath,
      rule: 'word-budget',
      message: `Word count ${file.wordCount} exceeds maximum ${budget.max} for Tier ${tier}`,
      severity: 'warning',
    });
  }

  return violations;
}

function validateForbiddenWords(file: MdxFile): Violation[] {
  const violations: Violation[] = [];
  const regex = buildForbiddenRegex();

  // Strip code blocks before checking prose
  const prose = file.body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');

  let match: RegExpExecArray | null;
  const found = new Set<string>();
  while ((match = regex.exec(prose)) !== null) {
    const word = match[1].toLowerCase();
    if (!found.has(word)) {
      found.add(word);
      violations.push({
        file: file.relativePath,
        rule: 'forbidden-words',
        message: `Contains forbidden word: "${match[1]}"`,
        severity: 'warning',
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(violations: Violation[], fileCount: number, packageCount: number): void {
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');

  console.log('');
  console.log('━'.repeat(60));
  console.log('  NextRush Documentation Validator');
  console.log('━'.repeat(60));
  console.log(`  Files scanned:    ${fileCount}`);
  console.log(`  Package pages:    ${packageCount}`);
  console.log(`  Errors:           ${errors.length}`);
  console.log(`  Warnings:         ${warnings.length}`);
  console.log('━'.repeat(60));

  if (violations.length === 0) {
    console.log('\n  ✓ All checks passed.\n');
    return;
  }

  // Group by file
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byFile.get(v.file) ?? [];
    list.push(v);
    byFile.set(v.file, list);
  }

  for (const [file, fileViolations] of byFile) {
    console.log(`\n  ${file}`);
    for (const v of fileViolations) {
      const icon = v.severity === 'error' ? '✗' : '⚠';
      console.log(`    ${icon} [${v.rule}] ${v.message}`);
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const __dirname =
    typeof import.meta.dirname === 'string'
      ? import.meta.dirname
      : dirname(fileURLToPath(import.meta.url));
  const docsRoot = resolve(__dirname, '../../apps/docs/content/docs');

  console.log(`\nScanning: ${docsRoot}`);
  console.log(`Mode: ${strict ? 'STRICT (will fail on violations)' : 'WARNINGS-ONLY'}`);

  const files = await scanMdxFiles(docsRoot);
  const violations: Violation[] = [];
  let packageCount = 0;

  for (const file of files) {
    // Frontmatter validation applies to ALL files
    violations.push(...validateFrontmatter(file));

    // Tier-based validation only applies to package pages
    const tier = classifyTier(file.relativePath);
    if (tier !== null) {
      packageCount++;
      violations.push(...validateSections(file, tier));
      violations.push(...validateWordBudget(file, tier));
    }

    // Forbidden words apply to ALL files
    violations.push(...validateForbiddenWords(file));
  }

  printReport(violations, files.length, packageCount);

  const errors = violations.filter((v) => v.severity === 'error');
  if (strict && violations.length > 0) {
    console.log('  STRICT MODE: Build blocked due to violations.\n');
    process.exit(1);
  } else if (errors.length > 0) {
    console.log('  Errors found. Fix before proceeding.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Validator failed:', err);
  process.exit(1);
});
