/**
 * Check 1 — Internal link check.
 *
 * Scans every .mdx file under content/docs for markdown links pointing at
 * `/docs/...` and verifies the target resolves to a real page.
 *
 * Resolution model (matches Fumadocs' file-based routing):
 *   /docs                      -> content/docs/index.mdx
 *   /docs/concepts             -> content/docs/concepts/index.mdx
 *   /docs/concepts/context     -> content/docs/concepts/context.mdx
 *                                  (or content/docs/concepts/context/index.mdx)
 *
 * Anchors (`#section`) are stripped before resolution — this check verifies
 * the PAGE exists, not that the specific heading exists on it (that would
 * require rendering the MDX; out of scope for this static check).
 *
 * Limitation: does not follow redirects (none exist yet) and does not
 * validate external (http/https) links or mailto: links.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMdxDocs, type MdxDoc } from './lib/fs-walk.js';

export interface LinkFinding {
  file: string;
  line: number;
  link: string;
  reason: string;
}

const LINK_RE = /\]\((\/docs(?:\/[^)\s#]+)?)(#[^)\s]*)?\)/g;

function lineOf(raw: string, index: number): number {
  return raw.slice(0, index).split('\n').length;
}

/** Resolve a `/docs/...` path to a page under contentRoot; return true if it exists. */
function resolves(contentRoot: string, docsPath: string): boolean {
  // "/docs" -> "" ; "/docs/concepts/context" -> "concepts/context"
  const slug = docsPath.replace(/^\/docs\/?/, '');

  if (slug === '') {
    return existsSync(join(contentRoot, 'index.mdx'));
  }

  const direct = join(contentRoot, `${slug}.mdx`);
  const asIndex = join(contentRoot, slug, 'index.mdx');
  const asDir = join(contentRoot, slug); // directory-only link (rare, but exists() check)

  return existsSync(direct) || existsSync(asIndex) || existsSync(asDir);
}

export function checkLinks(contentRoot: string, docs: MdxDoc[] = readMdxDocs(contentRoot)): LinkFinding[] {
  const findings: LinkFinding[] = [];

  for (const doc of docs) {
    let match: RegExpExecArray | null;
    const re = new RegExp(LINK_RE);
    while ((match = re.exec(doc.raw)) !== null) {
      const docsPath = match[1];
      if (!resolves(contentRoot, docsPath)) {
        findings.push({
          file: doc.relativePath,
          line: lineOf(doc.raw, match.index),
          link: docsPath + (match[2] ?? ''),
          reason: `No page resolves to "${docsPath}"`,
        });
      }
    }
  }

  return findings;
}

// Allow running standalone: `tsx apps/docs/scripts/verify/link-check.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const contentRoot = join(__dirname, '../../content/docs');
  const findings = checkLinks(contentRoot);
  for (const f of findings) {
    console.log(`${f.file}:${f.line} — ${f.reason} (${f.link})`);
  }
  console.log(`\n${findings.length} broken internal link(s) found.`);
  process.exit(findings.length > 0 ? 1 : 0);
}
