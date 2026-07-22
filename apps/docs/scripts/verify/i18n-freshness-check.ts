/**
 * Check 5 — Translation-freshness check (stub, design.md D8).
 *
 * NextRush ships v4 i18n-*ready*, not i18n-*complete* — content stays English-first,
 * translated incrementally only once a locale has a committed maintainer (see
 * `apps/docs/src/lib/i18n.ts`). This check has no work to do today because
 * `i18n.languages` is English-only; it activates automatically the moment a second
 * locale is added and that locale's content directory exists.
 *
 * Model once activated: a localized page is "stale" if its source file's last-modified
 * commit is newer than the localized page's. Fumadocs' i18n content convention places a
 * locale's pages alongside the source under a `.<locale>.mdx` suffix (e.g.
 * `concepts/modules.cn.mdx` next to `concepts/modules.mdx`) — this check walks the
 * default-locale content tree, and for every page checks whether a sibling
 * `<slug>.<locale>.mdx` exists; if it does, it is flagged stale when the English
 * source's git mtime is newer than the localized file's.
 *
 * This is deliberately a stub, not a full implementation: there is no real localized
 * content to test the staleness comparison against yet, and writing untested comparison
 * logic against a hypothetical file layout risks shipping something that's subtly wrong
 * the day it's actually needed. The check runs, finds zero locale directories, and
 * reports zero findings — a real no-op, not a placeholder that silently always passes.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMdxDocs, type MdxDoc } from './lib/fs-walk.js';

export interface TranslationFreshnessFinding {
  file: string;
  locale: string;
  reason: string;
}

function defaultI18nSourcePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/i18n.ts');
}

/** Non-default locales configured in `lib/i18n.ts` — the ones this check watches for. */
export function getNonDefaultLocales(i18nSourcePath: string = defaultI18nSourcePath()): string[] {
  // Intentionally re-reads the same source of truth as the app rather than duplicating
  // the language list — if `i18n.ts` gains a locale, this check picks it up with no
  // separate config to keep in sync.
  if (!existsSync(i18nSourcePath)) return [];

  const source = readFileSync(i18nSourcePath, 'utf-8');
  const languagesMatch = source.match(/languages:\s*\[([^\]]*)\]/);
  const defaultMatch = source.match(/defaultLanguage:\s*['"]([^'"]+)['"]/);
  if (!languagesMatch || !defaultMatch) return [];

  const allLanguages = languagesMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  const defaultLanguage = defaultMatch[1];

  return allLanguages.filter((lang) => lang !== defaultLanguage);
}

/** Git's last-commit mtime for a file, in epoch seconds; null if not tracked. */
function gitLastModified(filePath: string): number | null {
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%ct', '--', filePath], {
      encoding: 'utf-8',
      cwd: dirname(filePath),
    }).trim();
    return output ? Number(output) : null;
  } catch {
    return null;
  }
}

export function checkTranslationFreshness(
  contentRoot: string,
  docs: MdxDoc[] = readMdxDocs(contentRoot),
  i18nSourcePath: string = defaultI18nSourcePath()
): TranslationFreshnessFinding[] {
  const locales = getNonDefaultLocales(i18nSourcePath);
  const findings: TranslationFreshnessFinding[] = [];

  // No non-default locale configured yet — genuine no-op, not a placeholder pass.
  if (locales.length === 0) return findings;

  for (const doc of docs) {
    const sourcePath = join(contentRoot, doc.relativePath);

    for (const locale of locales) {
      const localizedPath = sourcePath.replace(/\.mdx$/, `.${locale}.mdx`);
      if (!existsSync(localizedPath)) continue; // not translated yet — not a freshness defect

      const sourceModified = gitLastModified(sourcePath) ?? statSync(sourcePath).mtimeMs / 1000;
      const localizedModified = gitLastModified(localizedPath) ?? statSync(localizedPath).mtimeMs / 1000;

      if (sourceModified > localizedModified) {
        findings.push({
          file: doc.relativePath,
          locale,
          reason: `English source is newer than the ${locale} translation — re-check for drift.`,
        });
      }
    }
  }

  return findings;
}

// Allow running standalone: `tsx apps/docs/scripts/verify/i18n-freshness-check.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const contentRoot = join(__dirname, '../../content/docs');
  const findings = checkTranslationFreshness(contentRoot);
  for (const f of findings) {
    console.log(`${f.file} [${f.locale}] — ${f.reason}`);
  }
  console.log(`\n${findings.length} translation-freshness finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}
