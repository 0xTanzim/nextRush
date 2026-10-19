// Static stages: no server, no timing, so they answer the same way every run and
// can be their own CI step. They guard the two artefacts around the gate itself —
// the exemption bookkeeping and the change's own comment hygiene.

import { declaredIds, findOrphanIds } from '../known-failures.mjs';
import { scanAddedCommentTokens } from '../hygiene.mjs';
import { registry } from '../probe-registry.mjs';

/**
 * Validate the exemption table and prove every id is still backed by a probe.
 *
 * Prevents an exemption from outliving the probe that justified it: an id with
 * no probe behind it will never be exercised again, so it can never be fixed and
 * never turn red.
 */
export function stageBookkeeping(ctx) {
  const knownFailures = ctx.budgets.knownFailures ?? {};
  const ids = declaredIds(knownFailures);
  const orphans = findOrphanIds(registry(), knownFailures);

  for (const [id, spec] of Object.entries(knownFailures)) {
    const valid = spec === '*' || (Array.isArray(spec) && spec.every((r) => ['bun', 'node'].includes(r)));
    if (!valid) {
      ctx.row('FAIL', `bookkeeping.${id}`, JSON.stringify(spec), "must be '*' or an array of runtime names");
    }
  }
  for (const id of orphans) {
    ctx.row('FAIL', `bookkeeping.${id}`, 'no probe references this id', 'remove the id, or add the probe it covers');
  }
  if (orphans.length === 0) {
    ctx.row('PASS', 'bookkeeping.knownFailures', `${String(ids.length)} id(s), each covered by a probe`);
  }
}

/**
 * A source comment must explain the code to a reader of the code. A comment that
 * points at a planning artifact ("see the report at …", "the brief id for this is
 * …") is unreadable once that artifact is pruned and cannot be kept true, so the
 * change is not allowed to add one. Only lines this working tree added are
 * scanned, so inherited references are never dragged into the diff.
 */
export function stageHygiene(ctx) {
  const violations = scanAddedCommentTokens({ repoRoot: ctx.repoRoot });
  if (violations.length === 0) {
    ctx.row('PASS', 'hygiene.added-comments', 'no planning-artifact reference in an added comment');
    return;
  }
  for (const v of violations) {
    ctx.row('FAIL', `hygiene.${v.file}:${String(v.line)}`, v.text, `remove the ${v.token} from the comment`);
  }
}
