/**
 * RuleTester fixtures for no-runtime-identity-capability.
 *
 * Run: node --test tools/eslint-rules/no-runtime-identity-capability.test.js
 */

import { RuleTester } from 'eslint';
import test from 'node:test';
import { noRuntimeIdentityCapability } from './no-runtime-identity-capability.mjs';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

test('no-runtime-identity-capability', () => {
  ruleTester.run('no-runtime-identity-capability', noRuntimeIdentityCapability, {
    valid: [
      // Capability-based decision — the correct pattern.
      { code: 'if (caps.fileSystem) { useFs(); }' },
      // Comparison to a non-runtime string is fine.
      { code: "if (mode === 'production') { optimize(); }" },
      // Annotated platform optimization / detection helper is allowed.
      {
        code: "// capability-exempt: detection helper, not a capability decision\nif (runtime === 'edge') { pickEdgePath(); }",
      },
      // Multi-line capability-exempt comment block, marker on the first
      // line, code directly after the LAST line — the end-line (not
      // start-line) proximity check must reach across the whole block
      // (regression: caught during authoring).
      {
        code: [
          'function detectPm(userAgent) {',
          '  // capability-exempt: package-manager choice, not a JS-runtime decision',
          '  // (spans two comment lines to test end-line proximity)',
          "  if (userAgent.startsWith('bun')) return 'bun';",
          '}',
        ].join('\n'),
      },
      // A switch on a non-runtime discriminant is unaffected.
      { code: "switch (mode) { case 'production': optimize(); break; }" },
      // capabilitiesFor-shaped producer switch: maps runtime -> capability
      // DATA via `return` in every arm, never calls an application function
      // with a side effect. Not a capability *decision* (ADR-R6's own
      // sanctioned exemption) — flagging this would break the exact function
      // this rule exists to protect.
      {
        code: `function capabilitiesFor(runtime) {
          switch (runtime) {
            case 'node': return { fileSystem: true };
            case 'edge': return { fileSystem: false };
            default: return probeCapabilities();
          }
        }`,
      },
      // getRuntimeVersion-shaped producer switch: case bodies wrapped in a
      // block to scope a local `const` before returning — must recurse into
      // the block, not just the flat case.consequent list, or this is
      // wrongly flagged as a decision (regression: caught during authoring).
      {
        code: `function getRuntimeVersion(runtime) {
          switch (runtime) {
            case 'node':
              return typeof process !== 'undefined' ? process.versions.node : undefined;
            case 'bun': {
              const bun = globalThis.Bun;
              return typeof bun !== 'undefined' ? bun.version : undefined;
            }
            default:
              return undefined;
          }
        }`,
      },
      // Annotated switch arm calling an application function is allowed.
      {
        code: `function buildArgs(runtime) {
          // capability-exempt: CLI arg builder, not a capability decision
          switch (runtime) {
            case 'bun': return buildBunArgs();
            case 'deno': return buildDenoArgs();
          }
        }`,
      },
    ],
    invalid: [
      {
        code: "if (runtime === 'node') { enableFsFeature(); }",
        errors: [{ messageId: 'runtimeIdentity' }],
      },
      {
        code: "const isEdge = getRuntime() === 'cloudflare-workers';",
        errors: [{ messageId: 'runtimeIdentity' }],
      },
      {
        code: "if (runtime !== 'deno') { doThing(); }",
        errors: [{ messageId: 'runtimeIdentity' }],
      },
      // A switch whose arms call an application function with a side effect
      // (not `return`-only data mapping) is a real capability decision.
      {
        code: `switch (runtime) {
          case 'node': enableFsFeature(); break;
          case 'edge': disableFsFeature(); break;
        }`,
        errors: [{ messageId: 'runtimeIdentity' }],
      },
      {
        code: "if (runtime.startsWith('deno')) { useDenoApi(); }",
        errors: [{ messageId: 'runtimeIdentity' }],
      },
      {
        code: "if (['bun', 'deno'].includes(runtime)) { skipNodeOnlyMiddleware(); }",
        errors: [{ messageId: 'runtimeIdentity' }],
      },
    ],
  });
});
