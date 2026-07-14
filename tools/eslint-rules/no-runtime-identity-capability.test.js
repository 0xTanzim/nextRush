/**
 * RuleTester fixtures for no-runtime-identity-capability.
 *
 * Run: node --test tools/eslint-rules/no-runtime-identity-capability.test.js
 */

import { RuleTester } from 'eslint';
import test from 'node:test';
import { noRuntimeIdentityCapability } from './no-runtime-identity-capability.js';

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
    ],
  });
});
