/**
 * ESLint rule: no-runtime-identity-capability
 *
 * Forbids branching on runtime identity (`runtime === 'node'`, etc.) for
 * capability decisions. Capability decisions MUST query `RuntimeCapabilities`
 * via `getRuntimeCapabilities()` (RFC/ADR-R6) so unknown-but-capable runtimes
 * work with no code change.
 *
 * Detects three syntactic forms of runtime-identity branching, each anchored
 * to a known runtime-name string literal to keep false positives low:
 *   1. `===`/`!==` comparisons (the original, narrow form).
 *   2. `switch` on a runtime discriminant whose arms make an application
 *      decision (call a function / have a side effect) — but NOT a
 *      `switch` whose every arm is a bare `return` mapping the discriminant
 *      to data (the `capabilitiesFor()`/`getRuntimeVersion()` producer
 *      shape — legitimately exempt by design, see the "producer switch"
 *      check below; this is NOT the `capability-exempt` annotation path,
 *      it's structural).
 *   3. `.startsWith(...)`/`.includes(...)` prefix/membership tests against a
 *      runtime-name literal used in a branch condition.
 *
 * Genuine platform-specific *optimizations* (and detection helpers) are allowed
 * when annotated with a `capability-exempt:` comment on or above the line.
 *
 * @remarks
 * Deliberately narrow to keep false-positives low: only flags comparisons/
 * switches/calls anchored to a known {@link RUNTIME_NAMES} string literal.
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

    /**
     * `//` line comments are tokenized ONE PER PHYSICAL LINE — a 2-line `//`
     * block is two separate, adjacent comment tokens, never one multi-line
     * token. Group consecutive `Line` comments with no blank-line gap
     * between them into logical blocks, so a marker anywhere in the block
     * (commonly its first line, for readability) still counts as adjacent
     * to code directly after the block's LAST line (regression: caught
     * during authoring — checking each comment token individually missed
     * this whenever the marker wasn't on the line immediately before code).
     */
    function groupedCommentBlocks(comments) {
      const blocks = [];
      let current = [];
      for (const c of comments) {
        if (c.type !== 'Line') {
          if (current.length > 0) blocks.push(current);
          current = [];
          blocks.push([c]); // Block comments stand alone.
          continue;
        }
        if (current.length > 0 && c.loc.start.line !== current[current.length - 1].loc.end.line + 1) {
          blocks.push(current);
          current = [];
        }
        current.push(c);
      }
      if (current.length > 0) blocks.push(current);
      return blocks;
    }

    /**
     * Is `node` covered by a capability-exempt comment block directly
     * before it, or within 1 line? A block is a contiguous run of `//`
     * lines (or one `/* *\/` comment); the marker may appear on any line
     * within the block — proximity is measured from the block's LAST line.
     */
    function isExempt(node) {
      const before = sourceCode.getCommentsBefore(node);
      if (before.some((c) => c.value.includes(EXEMPT_MARKER))) return true;
      const line = node.loc.start.line;
      const blocks = groupedCommentBlocks(sourceCode.getAllComments());
      return blocks.some((block) => {
        const hasMarker = block.some((c) => c.value.includes(EXEMPT_MARKER));
        if (!hasMarker) return false;
        const blockEndLine = block[block.length - 1].loc.end.line;
        return Math.abs(blockEndLine - line) <= 1;
      });
    }

    function literalRuntimeName(operand) {
      return operand.type === 'Literal' &&
        typeof operand.value === 'string' &&
        RUNTIME_NAMES.has(operand.value)
        ? operand.value
        : undefined;
    }

    /**
     * A switch case consequent is "producer-shaped" if every statement in it
     * is a bare `return` (mapping the discriminant to a value), a local
     * `const`/`let`/`var` declaration used only to compute that return value,
     * or a `break` — no calls to *other* application functions, no side
     * effects. This is the `capabilitiesFor()`/`getRuntimeVersion()` shape:
     * legitimate by structure, not by annotation. Case bodies are commonly
     * wrapped in a block (`case 'x': { ...; return y; }`) to scope a local
     * variable — recurse into the block rather than only checking the
     * top-level statement list, or every block-wrapped producer case would
     * be misclassified as a decision.
     */
    function isProducerShapedStatements(statements) {
      return statements.every((stmt) => {
        if (stmt.type === 'ReturnStatement' || stmt.type === 'BreakStatement') return true;
        if (stmt.type === 'VariableDeclaration') return true;
        if (stmt.type === 'BlockStatement') return isProducerShapedStatements(stmt.body);
        return false;
      });
    }

    function isProducerShapedCase(caseNode) {
      return isProducerShapedStatements(caseNode.consequent);
    }

    /** True if every case in the switch is producer-shaped (whole switch is exempt-by-structure). */
    function isProducerSwitch(switchNode) {
      return switchNode.cases.every(isProducerShapedCase);
    }

    /** Does any case in this switch discriminate on a known runtime-name literal? */
    function switchHasRuntimeNameCase(switchNode) {
      return switchNode.cases.some((c) => c.test !== null && literalRuntimeName(c.test) !== undefined);
    }

    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return;
        const value = literalRuntimeName(node.right) ?? literalRuntimeName(node.left);
        if (value === undefined) return;
        if (isExempt(node)) return;
        context.report({ node, messageId: 'runtimeIdentity', data: { value } });
      },

      SwitchStatement(node) {
        if (!switchHasRuntimeNameCase(node)) return;
        if (isProducerSwitch(node)) return; // structural exemption — not a decision
        if (isExempt(node)) return;
        const value = node.cases.map((c) => (c.test ? literalRuntimeName(c.test) : undefined)).find(Boolean);
        context.report({ node, messageId: 'runtimeIdentity', data: { value: value ?? '?' } });
      },

      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        const method = callee.property.type === 'Identifier' ? callee.property.name : undefined;
        if (method !== 'startsWith' && method !== 'includes') return;

        // `runtime.startsWith('deno')` — literal is the argument.
        const argLiteral = node.arguments[0] ? literalRuntimeName(node.arguments[0]) : undefined;
        // `[...].includes(runtime)` — literal(s) are in the array the method is called on.
        const arrayLiterals =
          callee.object.type === 'ArrayExpression'
            ? callee.object.elements.map((el) => (el ? literalRuntimeName(el) : undefined)).find(Boolean)
            : undefined;

        const value = argLiteral ?? arrayLiterals;
        if (value === undefined) return;
        if (isExempt(node)) return;
        context.report({ node, messageId: 'runtimeIdentity', data: { value } });
      },
    };
  },
};

export default { rules: { 'no-runtime-identity-capability': noRuntimeIdentityCapability } };
