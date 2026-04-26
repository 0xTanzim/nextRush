/**
 * MDX file scanning and parsing utilities.
 *
 * Parses frontmatter, extracts H2 headings, and counts words from MDX files.
 * Uses only Node.js built-ins — no external dependencies.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MdxFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Path relative to the content root (e.g. "packages/core/core.mdx") */
  relativePath: string;
  /** Parsed frontmatter key-value pairs */
  frontmatter: Record<string, string>;
  /** List of H2 heading texts found in the body */
  h2Headings: string[];
  /** Total word count of the body (excluding frontmatter and code blocks) */
  wordCount: number;
  /** Raw body text (frontmatter stripped) */
  body: string;
}

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const raw = match[1];
  const body = content.slice(match[0].length).trim();
  const frontmatter: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (key) frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// H2 extraction
// ---------------------------------------------------------------------------

/**
 * Extract all H2 heading texts from MDX body content.
 * Only matches ATX-style headings: `## Heading Text`
 */
function extractH2Headings(body: string): string[] {
  const headings: string[] = [];
  const re = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

// ---------------------------------------------------------------------------
// Word count
// ---------------------------------------------------------------------------

/**
 * Count words in the body text, excluding:
 * - Fenced code blocks (```...```)
 * - JSX/MDX component tags (<Component ... />)
 * - Import statements
 * - HTML comments
 */
function countWords(body: string): number {
  let text = body;
  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  text = text.replace(/`[^`]+`/g, '');
  // Remove JSX tags
  text = text.replace(/<[^>]+\/?>/g, '');
  // Remove import/export statements
  text = text.replace(/^(import|export)\s.+$/gm, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove markdown links, keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove headings markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

/**
 * Recursively find all .mdx files under a directory.
 */
async function findMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      files.push(...(await findMdxFiles(fullPath)));
    } else if (entry.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Scan a content directory, parse all MDX files, and return structured data.
 */
export async function scanMdxFiles(contentRoot: string): Promise<MdxFile[]> {
  const absolutePaths = await findMdxFiles(contentRoot);
  const results: MdxFile[] = [];

  for (const absolutePath of absolutePaths) {
    const raw = await readFile(absolutePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);

    results.push({
      absolutePath,
      relativePath: relative(contentRoot, absolutePath),
      frontmatter,
      h2Headings: extractH2Headings(body),
      wordCount: countWords(body),
      body,
    });
  }

  return results;
}
