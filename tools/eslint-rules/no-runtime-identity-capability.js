/**
 * ESLint rule: no-runtime-identity-capability
 *
 * Forbids branching on runtime identity (`runtime === 'node'`, etc.) for
 * capability decisions. Capability decisions MUST query `RuntimeCapabilities`
 * via `getRuntimeCapabilities()` (RFC/ADR-R6) so unknown-but-capable runtimes
 * work with no code change.
 *
 * Genuine platform-specific *optimizations* (and detection helpers) are allowed
 * when annotated with a `capability-exempt:` comment on or above the line.
 *
 * @remarks
 * Deliberately narrow to keep false-positives low: only flags `===`/`!==`
 * comparisons against a known {@link RUNTIME_NAMES} string literal. `switch`/
 * `case` (e.g. the capability-*producing* matrix in `capabilitiesFor`) is not a
 * capability *decision* and is intentionally not flagged.
 */

const RUNTIME_NAMES = new Set([
  'node',
  'bun',
  'deno',
  'deno-deploy',
  'cloudflare-workers',
  'vercel-edge',
  'edge',
  'unknown',
]);

const EXEMPT_MARKER = 'capability-exempt';

/** @type {import('eslint').Rule.RuleModule} */
export const noRuntimeIdentityCapability = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow runtime-identity comparisons for capability decisions; use RuntimeCapabilities instead.',
    },
    schema: [],
    messages: {
      runtimeIdentity:
        "Do not branch on runtime identity ('{{value}}') for capability decisions — query RuntimeCapabilities via getRuntimeCapabilities(). If this is a genuine platform-specific optimization or a detection helper, annotate it with a `// capability-exempt: <reason>` comment.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** Is `node` covered by a capability-exempt comment on/above its line? */
    function isExempt(node) {
      const before = sourceCode.getCommentsBefore(node);
      if (before.some((c) => c.value.includes(EXEMPT_MARKER))) return true;
      const line = node.loc.start.line;
      return sourceCode
        .getAllComments()
        .some((c) => c.value.includes(EXEMPT_MARKER) && Math.abs(c.loc.start.line - line) <= 1);
    }

    function literalRuntimeName(operand) {
      return operand.type === 'Literal' &&
        typeof operand.value === 'string' &&
        RUNTIME_NAMES.has(operand.value)
        ? operand.value
        : undefined;
    }

    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return;
        const value = literalRuntimeName(node.right) ?? literalRuntimeName(node.left);
        if (value === undefined) return;
        if (isExempt(node)) return;
        context.report({ node, messageId: 'runtimeIdentity', data: { value } });
      },
    };
  },
};

export default { rules: { 'no-runtime-identity-capability': noRuntimeIdentityCapability } };
