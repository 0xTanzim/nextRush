/**
 * Filesystem walking utilities for the docs verification harness.
 *
 * Kept dependency-free (Node built-ins only) so the harness has no extra
 * install step beyond what apps/website already has (tsx is a root devDependency).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Recursively collect all files matching `extension` under `dir`. */
export function findFiles(dir: string, extension: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      out.push(...findFiles(fullPath, extension));
    } else if (entry.endsWith(extension)) {
      out.push(fullPath);
    }
  }
  return out;
}

export interface MdxDoc {
  absolutePath: string;
  /** Path relative to content/docs, e.g. "concepts/context.mdx" */
  relativePath: string;
  raw: string;
}

/** Read every .mdx file under `contentRoot` (content/docs). */
export function readMdxDocs(contentRoot: string): MdxDoc[] {
  return findFiles(contentRoot, '.mdx').map((absolutePath) => ({
    absolutePath,
    relativePath: relative(contentRoot, absolutePath),
    raw: readFileSync(absolutePath, 'utf-8'),
  }));
}

/** Extract fenced code blocks of the given languages, with their starting line number (1-based). */
export function extractCodeBlocks(
  raw: string,
  languages: readonly string[]
): Array<{ lang: string; code: string; startLine: number }> {
  const blocks: Array<{ lang: string; code: string; startLine: number }> = [];
  const langPattern = languages.join('|');
  // Matches ```lang [meta] \n ... \n ``` — meta (e.g. title="x") is ignored.
  const re = new RegExp('```(' + langPattern + ')[^\\n]*\\n([\\s\\S]*?)```', 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const startLine = raw.slice(0, match.index).split('\n').length;
    blocks.push({ lang: match[1], code: match[2], startLine });
  }
  return blocks;
}

/** Strip fenced code blocks and inline code from prose (used by lint checks). */
export function stripCode(raw: string): string {
  return raw.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}
