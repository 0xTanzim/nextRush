/**
 * fix-benchmark-harness-integrity (secondary item, audit P2-001): NextRush's
 * benchmark servers rely on `@nextrush/adapter-node`'s own default accept-
 * queue backlog happening to equal the harness's `LISTEN_BACKLOG` constant,
 * rather than passing it explicitly — two independently-maintained literals
 * with no compile-time link. Changing `@nextrush/adapter-node`'s default is
 * a cross-package, RFC-gated public-API change out of this benchmark-only
 * change's scope; this test instead pins the CURRENTLY-TRUE equality so a
 * future divergence between the two constants fails a fast unit test rather
 * than surfacing only as a live `bench:validate` backlog-parity mismatch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';
import { LISTEN_BACKLOG } from '../../../config/constants.js';

test("the harness's LISTEN_BACKLOG matches @nextrush/adapter-node's own DEFAULT_LISTEN_BACKLOG", () => {
  const adapterSource = readFileSync(
    `${ROOT_DIR}/../../packages/adapters/node/src/adapter.ts`,
    'utf-8'
  );
  const match = adapterSource.match(/DEFAULT_LISTEN_BACKLOG\s*=\s*(\d+)/);
  assert.ok(match, 'DEFAULT_LISTEN_BACKLOG constant must still exist in the adapter source');

  const adapterDefault = Number(match[1]);
  assert.equal(
    LISTEN_BACKLOG,
    adapterDefault,
    'the harness assumes nextrush-v3 inherits this exact backlog from the adapter default ' +
      "without passing it explicitly — if the adapter's default ever changes, this benchmark's " +
      'backlog-parity claim (bench:validate) silently becomes false for NextRush specifically'
  );
});
