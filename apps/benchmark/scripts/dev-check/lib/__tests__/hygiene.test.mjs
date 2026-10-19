import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { scanAddedCommentTokens } from '../hygiene.mjs';

const DEFAULT_COMMITTED = 'export const committed = 1;\n';

/**
 * A throwaway git repo so the scanner's diff/ls-files paths run for real.
 *
 * `base` is committed first, then `changed` is written on top, so a test can
 * distinguish a line the working tree added from one it inherited.
 */
function withRepo({ base = DEFAULT_COMMITTED, changed = {} }, body) {
  const root = mkdtempSync(join(tmpdir(), 'dev-check-hygiene-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'committed.ts'), base);
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'base'], { cwd: root });
    for (const [rel, content] of Object.entries(changed)) {
      writeFileSync(join(root, rel), content);
    }
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const scan = (root) => scanAddedCommentTokens({ repoRoot: root, scopes: ['src'] });

test('flags a planning-artifact path in an added comment', () => {
  withRepo(
    {
      changed: {
        'src/a.ts': '// Derived from the audit at report/architecture/overview.md.\nexport const a = 1;\n',
      },
    },
    (root) => {
      const violations = scan(root);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].file, 'src/a.ts');
      assert.equal(violations[0].token, 'report path');
    }
  );
});

test('flags a signal identifier in an added block comment', () => {
  withRepo({ changed: { 'src/a.ts': '/* What the plan calls GP-02. */\nexport const a = 1;\n' } }, (root) => {
    assert.deepEqual(
      scan(root).map((v) => v.token),
      ['signal id']
    );
  });
});

test('never flags a token used as data rather than prose', () => {
  withRepo(
    { changed: { 'src/a.mjs': "export const ids = ['FB-01', 'FB-06'];\nexport const re = /FB-\\d+/;\n" } },
    (root) => {
      assert.deepEqual(scan(root), []);
    }
  );
});

test('never treats a // inside a string literal as the start of a comment', () => {
  // A URL is the commonest line to carry a path-like fragment, and it is not a
  // comment — the mini-lexer has to know the difference.
  withRepo(
    { changed: { 'src/a.mjs': "export const u = 'https://nextrush.dev/docs/reference/cookies';\n" } },
    (root) => {
      assert.deepEqual(scan(root), []);
    }
  );
});

test('flags a trailing comment after code on an added line', () => {
  withRepo({ changed: { 'src/a.mjs': 'export const a = 1; // see report/architecture/x.md\n' } }, (root) => {
    assert.deepEqual(
      scan(root).map((v) => v.token),
      ['report path']
    );
  });
});

test('does not flag a reference on a line this working tree did not add', () => {
  withRepo(
    {
      base: '// Inherited from report/architecture/old.md\nexport const committed = 1;\n',
      changed: { 'src/committed.ts': '// Inherited from report/architecture/old.md\nexport const committed = 2;\n' },
    },
    (root) => {
      assert.deepEqual(scan(root), []);
    }
  );
});

test('does flag a reference on a line the working tree did add to that same file', () => {
  withRepo(
    {
      base: 'export const committed = 1;\n',
      changed: { 'src/committed.ts': 'export const committed = 1;\n// added later: report/architecture/new.md\n' },
    },
    (root) => {
      assert.deepEqual(
        scan(root).map((v) => v.line),
        [2]
      );
    }
  );
});

test('ignores files outside the scanned extensions', () => {
  withRepo(
    {
      changed: {
        'src/notes.json': '{ "why": "report/architecture/x.md" }\n',
        'src/readme.md': 'see report/architecture/x.md\n',
      },
    },
    (root) => {
      assert.deepEqual(scan(root), []);
    }
  );
});
