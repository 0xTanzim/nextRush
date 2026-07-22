/**
 * Check 4 — Reference-match check (stub, per task scope).
 *
 * Full scope (future work, tracked as T4/T12 in ROADMAP.md): generated type
 * tables via `fumadocs-typescript`, verified for full structural equality
 * against source.
 *
 * THIS task's scope: a best-effort STATIC check — for every hand-written
 * bare function-signature declaration in `reference/**\/*.mdx`
 * (`function name(...): ReturnType;`, no body — the idiom this repo's
 * API reference pages already use for signatures, see
 * docs-api-reference.instructions.md), verify a symbol of that name is
 * actually exported from the corresponding package's `src/index.ts`.
 *
 * This is name-existence checking, NOT type equality — it will not catch a
 * parameter list or return type that has drifted from source, only a
 * function that plain doesn't exist (renamed, removed) or is misspelled.
 * Closing that gap is exactly what T4 (fumadocs-typescript pilot) replaces
 * this stub with.
 *
 * Package inference from file path (post B3 IA flattening — the reference
 * tree is flat at `reference/*.mdx`, with only `class/` and `platforms/` kept
 * as subfolders; see the docs-v4-rebuild wave-b3 mapping table):
 *   reference/cors.mdx                -> @nextrush/cors
 *   reference/class/di.mdx            -> @nextrush/di
 *   reference/class/decorators.mdx    -> @nextrush/class (former shim, removed)
 *   reference/class/controllers.mdx   -> @nextrush/class (former shim, removed)
 *   reference/websocket.mdx           -> @nextrush/websocket
 *   reference/platforms/node.mdx      -> @nextrush/adapter-node
 *   reference/core.mdx                -> @nextrush/core
 *   reference/nextrush.mdx            -> nextrush (bare meta-package)
 *   reference/dev.mdx                 -> @nextrush/dev
 * `index.mdx` and `packages.mdx` pages (catalog/index pages, not a single
 * package) are skipped — they have no 1:1 package to check against.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMdxDocs, type MdxDoc } from './lib/fs-walk.js';
import { resolveWorkspacePackages, type PackageEntry } from './lib/package-resolver.js';

export interface ReferenceFinding {
  file: string;
  line: number;
  symbol: string;
  message: string;
}

const SIGNATURE_RE = /^(?:export\s+)?(?:declare\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\(/gm;

/** Infer the npm package name a given reference/**\/*.mdx file documents. */
function inferPackageName(relativePath: string): string | null {
  // Two shapes post B3 flattening: a flat page (`reference/foo.mdx`) or a
  // page still nested one level under the two folders explicitly kept
  // (`reference/class/*.mdx`, `reference/platforms/*.mdx`).
  const nestedMatch = relativePath.match(/^reference\/([^/]+)\/([^/]+)\.mdx$/);
  const flatMatch = relativePath.match(/^reference\/([^/]+)\.mdx$/);
  if (!nestedMatch && !flatMatch) return null;

  const dirSlug = nestedMatch?.[1] ?? null;
  const fileSlug = nestedMatch ? nestedMatch[2] : flatMatch![1];

  if (fileSlug === 'index') return null; // catalog page, not a single package
  if (dirSlug === null && fileSlug === 'packages') return null; // A-Z index page

  if (fileSlug === 'nextrush') return 'nextrush';

  if (dirSlug === 'platforms') return `@nextrush/adapter-${fileSlug}`;

  // reference/class/di*.mdx documents @nextrush/di, not a "di" package under class/.
  if (dirSlug === 'class' && (fileSlug === 'di' || fileSlug === 'di-container' || fileSlug === 'di-errors')) {
    return '@nextrush/di';
  }
  // reference/class/modules.mdx documents @Module/registerModule, which are
  // exported directly from @nextrush/class (packages/class/src/index.ts) —
  // there is no standalone "@nextrush/modules" package.
  if (dirSlug === 'class' && fileSlug === 'modules') {
    return '@nextrush/class';
  }
  // reference/class/decorators.mdx and controllers.mdx document nextrush/class's
  // own decorator and registrar surface. The former standalone
  // @nextrush/decorators and @nextrush/controllers packages were removed
  // (T053/remove-deprecated-shims) — both pages now check against @nextrush/class.
  if (dirSlug === 'class' && (fileSlug === 'decorators' || fileSlug === 'controllers')) {
    return '@nextrush/class';
  }

  return `@nextrush/${fileSlug}`;
}

/** Parse the named exports declared in a package's src/index.ts barrel file. */
function parseExportedNames(entryFile: string): Set<string> {
  const source = readFileSync(entryFile, 'utf-8');
  const names = new Set<string>();

  // export { a, b as c } from '...'  /  export { a, b }
  const braceRe = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = braceRe.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Handle "a as b" — the locally-imported source name doesn't matter,
      // what's importable from this module is the name AFTER `as`.
      const asMatch = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      const name = asMatch ? asMatch[1] : trimmed.split(/\s+/)[0];
      if (name) names.add(name);
    }
  }

  // export function foo(...)  /  export class Foo  /  export const foo =
  const directRe = /export\s+(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/g;
  while ((match = directRe.exec(source)) !== null) {
    names.add(match[1]);
  }

  return names;
}

export function checkReferenceMatch(
  contentRoot: string,
  packagesRoot: string,
  docs: MdxDoc[] = readMdxDocs(contentRoot)
): ReferenceFinding[] {
  const findings: ReferenceFinding[] = [];
  const packages = resolveWorkspacePackages(packagesRoot);
  const byName = new Map<string, PackageEntry>(packages.map((p) => [p.name, p]));
  const exportCache = new Map<string, Set<string>>();

  for (const doc of docs) {
    if (!doc.relativePath.startsWith('reference/')) continue;

    const packageName = inferPackageName(doc.relativePath);
    if (!packageName) continue;

    const pkg = byName.get(packageName);
    if (!pkg) {
      findings.push({
        file: doc.relativePath,
        line: 1,
        symbol: packageName,
        message: `Could not resolve workspace package "${packageName}" for this reference page — skipped signature checks`,
      });
      continue;
    }

    if (!exportCache.has(pkg.name)) {
      exportCache.set(pkg.name, parseExportedNames(pkg.entryFile));
    }
    const exported = exportCache.get(pkg.name)!;

    const re = new RegExp(SIGNATURE_RE);
    let match: RegExpExecArray | null;
    while ((match = re.exec(doc.raw)) !== null) {
      const symbol = match[1];
      if (!exported.has(symbol)) {
        const line = doc.raw.slice(0, match.index).split('\n').length;
        findings.push({
          file: doc.relativePath,
          line,
          symbol,
          message: `Signature documents "${symbol}()" but it is not exported from ${pkg.name}'s src/index.ts`,
        });
      }
    }
  }

  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const contentRoot = join(__dirname, '../../content/docs');
  const packagesRoot = join(__dirname, '../../../../packages');

  const findings = checkReferenceMatch(contentRoot, packagesRoot);
  for (const f of findings) {
    console.log(`${f.file}:${f.line} — ${f.message}`);
  }
  console.log(`\n${findings.length} reference-match finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}
