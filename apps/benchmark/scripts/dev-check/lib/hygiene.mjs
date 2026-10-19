// Source-hygiene check: the framework's own source must stay self-describing.
//
// A source comment that points at a dated planning artifact ("see the audit at
// some/report/path", "the bug-brief id for this is X-01") is dead weight in the
// product: the artifact is prunable, the id means nothing to a reader who has
// never seen the planning tree, and six months later nobody can tell whether the
// comment is still true. The knowledge belongs in the commit message, the
// change's own artifacts, or the RFC — not in a comment the code will outlive.
//
// The check is deliberately narrow: it flags tokens appearing in a comment on a
// line this working tree ADDED, so pre-existing references elsewhere are not
// dragged into unrelated work, and a token used as data (a key in a probe
// registry, a regex in a checker) is never flagged — only prose that a reader of
// this source would have to go somewhere else to understand.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Comments pointing at a planning artifact tree or a brief/signal identifier. */
const FORBIDDEN_COMMENT_TOKENS = [
  { name: 'report path', pattern: /(^|[\s(`'"[])(report|reports)\/[a-z]/ },
  { name: 'brief path', pattern: /fix-briefs/ },
  { name: 'bug-brief id', pattern: /\bFB-\d+/ },
  { name: 'signal id', pattern: /\bGP-\d+/ },
];

/** Source extensions the check reads. Data files (`.json`) are excluded on purpose. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js'];

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * The comment text on one line, advancing the block-comment state across lines.
 *
 * A hand-rolled mini-lexer rather than a regex: `//` inside a string literal (a
 * URL, a format string) is not a comment, and treating it as one produces false
 * positives on exactly the lines most likely to mention a path.
 */
function commentTextOf(line, state) {
  let out = '';
  let i = 0;
  let quote = null;

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    if (state.inBlock) {
      const end = line.indexOf('*/', i);
      if (end === -1) return out + line.slice(i);
      out += line.slice(i, end);
      state.inBlock = false;
      i = end + 2;
      continue;
    }

    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') return out + line.slice(i + 2);
    if (ch === '/' && next === '*') {
      state.inBlock = true;
      i += 2;
      continue;
    }
    i += 1;
  }

  return out;
}

/** Files this working tree changed (tracked modifications + untracked additions). */
function changedFiles(repoRoot, scopes) {
  const args = ['diff', '--name-only', 'HEAD', '--', ...scopes];
  const modified = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', ...scopes],
    { cwd: repoRoot, encoding: 'utf8' }
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return { modified, untracked: untracked.filter(isSourceFile) };
}

/**
 * Added lines of one file, as `[lineNumber, text]` pairs, for both the modified
 * and the untracked case.
 */
function addedLines(repoRoot, file, isUntracked) {
  if (isUntracked) {
    return readFileSync(join(repoRoot, file), 'utf8')
      .split('\n')
      .map((text, i) => [i + 1, text]);
  }

  const diff = execFileSync('git', ['diff', '-U0', 'HEAD', '--', file], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const out = [];
  let newLine = 0;

  for (const raw of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+++') || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) {
      out.push([newLine, raw.slice(1)]);
      newLine += 1;
    }
  }
  return out;
}

/**
 * Scan the change's added source comments for planning-artifact references.
 *
 * @param {{ repoRoot: string, scopes?: string[] }} options
 * @returns {Array<{ file: string, line: number, token: string, text: string }>}
 */
export function scanAddedCommentTokens({ repoRoot, scopes = ['packages', 'apps'] }) {
  const { modified, untracked } = changedFiles(repoRoot, scopes);
  const violations = [];

  const files = [
    ...modified.filter(isSourceFile).map((file) => ({ file, isUntracked: false })),
    ...untracked.map((file) => ({ file, isUntracked: true })),
  ];

  for (const { file, isUntracked } of files) {
    const state = { inBlock: false };
    for (const [line, text] of addedLines(repoRoot, file, isUntracked)) {
      const comment = commentTextOf(text, state);
      if (!comment) continue;
      for (const { name, pattern } of FORBIDDEN_COMMENT_TOKENS) {
        if (pattern.test(comment)) {
          violations.push({ file, line, token: name, text: comment.trim().slice(0, 100) });
          break;
        }
      }
    }
  }

  return violations;
}
