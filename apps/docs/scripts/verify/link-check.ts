/**
 * Check 1 — Internal link check.
 *
 * Scans every .mdx file under content/docs for markdown links pointing at
 * `/docs/...` and verifies the target resolves to a real page.
 *
 * Resolution model (matches Fumadocs' file-based routing, including route
 * groups):
 *   /docs                          -> content/docs/index.mdx
 *   /docs/concepts                 -> content/docs/concepts/index.mdx
 *   /docs/concepts/context         -> content/docs/concepts/context.mdx
 *   /docs/reference/cors           -> content/docs/reference/(security)/cors.mdx
 *
 * A path segment wrapped in parentheses — `(security)` — is a Next.js/Fumadocs
 * ROUTE GROUP: it organizes files in the sidebar without contributing a URL
 * segment (see fumadocs-core `getSlugs`, which skips any `^\(.+\)$` segment).
 * So the real, served URL of `reference/(security)/cors.mdx` is
 * `/docs/reference/cors`, and this check must resolve it there — not treat the
 * group folder as part of the path.
 *
 * Anchors (`#section`) are stripped before resolution — this check verifies
 * the PAGE exists, not that the specific heading exists on it (that would
 * require rendering the MDX; out of scope for this static check).
 *
 * Limitation: does not follow redirects (none exist yet) and does not
 * validate external (http/https) links or mailto: links.
 */

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
const GROUP_SEGMENT_RE = /^\(.+\)$/;

function lineOf(raw: string, index: number): number {
  return raw.slice(0, index).split('\n').length;
}

/**
 * Convert an .mdx file's path (relative to content/docs) into the `/docs/...`
 * URL it is actually served at, applying the same rules as fumadocs-core's
 * `getSlugs`: drop the extension, skip route-group segments (`(name)`), and
 * drop a trailing `index`.
 */
function fileToDocsPath(relativePath: string): string {
  const noExt = relativePath.replace(/\.mdx$/, '');
  const segments = noExt
    .split('/')
    .filter((seg) => seg.length > 0 && !GROUP_SEGMENT_RE.test(seg));
  if (segments[segments.length - 1] === 'index') segments.pop();
  return segments.length > 0 ? `/docs/${segments.join('/')}` : '/docs';
}

export function checkLinks(contentRoot: string, docs: MdxDoc[] = readMdxDocs(contentRoot)): LinkFinding[] {
  const findings: LinkFinding[] = [];

  // Build the set of every URL that actually resolves to a served page,
  // derived the same way Fumadocs derives slugs (route groups stripped).
  const validPaths = new Set<string>(docs.map((doc) => fileToDocsPath(doc.relativePath)));

  for (const doc of docs) {
    let match: RegExpExecArray | null;
    const re = new RegExp(LINK_RE);
    while ((match = re.exec(doc.raw)) !== null) {
      const docsPath = match[1].replace(/\/$/, '') || '/docs';
      if (!validPaths.has(docsPath)) {
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
